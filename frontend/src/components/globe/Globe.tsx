"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
  EARTH_RADIUS_KM,
  eciPosition,
  gmst,
  orbitRing,
  satrecFromTle,
  sunDirectionEci,
  type Vec3,
} from "@/lib/orbit";

import { buildEarthTexture } from "./earthTexture";

export interface GlobeSatellite {
  id: number;
  name: string;
  tle1: string;
  tle2: string;
}

export interface GlobeObserver {
  latitudeDeg: number;
  longitudeDeg: number;
  label: string;
}

interface Props {
  satellites: GlobeSatellite[];
  selectedId: number | null;
  onSelect?: (id: number) => void;
  observer?: GlobeObserver | null;
  /** Simulation start (UTC). The clock then advances at `speed` × real time. */
  startTime: Date;
  speed: number;
  paused: boolean;
  onClock?: (time: Date) => void;
  /** Camera distance in Earth radii. */
  distance?: number;
  autoRotate?: boolean;
  label: string;
  className?: string;
}

/** Inertial (x, y, z) in km → three.js scene units (Earth radius = 1, y up). */
function toScene([x, y, z]: Vec3): THREE.Vector3 {
  return new THREE.Vector3(x / EARTH_RADIUS_KM, z / EARTH_RADIUS_KM, -y / EARTH_RADIUS_KM);
}

function surfacePoint(latDeg: number, lonDeg: number, r = 1): THREE.Vector3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), -r * Math.cos(lat) * Math.sin(lon));
}

const EARTH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const EARTH_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 sunDir;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 n = normalize(vNormalW);
    float d = dot(n, sunDir);
    float day = smoothstep(-0.12, 0.22, d);
    vec3 tex = texture2D(map, vUv).rgb;
    vec3 color = tex * mix(0.5, 1.45, day);
    color += vec3(0.05, 0.11, 0.22) * day * max(d, 0.0);
    float rim = pow(1.0 - max(dot(n, normalize(cameraPosition - vPosW)), 0.0), 3.4);
    color += vec3(0.24, 0.52, 1.0) * rim * (0.2 + 0.5 * day);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 sunDir;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 view = normalize(cameraPosition - vPosW);
    float glow = pow(clamp(0.78 + dot(n, view), 0.0, 1.0), 5.0);
    float lit = 0.35 + 0.65 * smoothstep(-0.4, 0.5, dot(-n, sunDir));
    gl_FragColor = vec4(vec3(0.30, 0.62, 1.0) * glow * lit, glow);
  }
`;

export default function Globe({
  satellites,
  selectedId,
  onSelect,
  observer,
  startTime,
  speed,
  paused,
  onClock,
  distance = 3.6,
  autoRotate = true,
  label,
  className,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // Live values read inside the render loop without re-creating the scene.
  const live = useRef({ satellites, selectedId, onSelect, observer, speed, paused, onClock, autoRotate });
  live.current = { satellites, selectedId, onSelect, observer, speed, paused, onClock, autoRotate };
  const sceneVersion = useRef(0);
  const satKey = satellites.map((s) => s.id).join(",");
  const observerKey = observer ? `${observer.latitudeDeg},${observer.longitudeDeg}` : "";
  const startMs = startTime.getTime();

  useEffect(() => {
    sceneVersion.current += 1;
  }, [satKey, selectedId, observerKey]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      setFailed("3D rendering is not available in this browser. Use the list to choose a spacecraft.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
    camera.position.set(distance * 0.72, distance * 0.42, distance * 0.56);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 1.5;
    controls.maxDistance = 14;
    controls.rotateSpeed = 0.5;
    controls.autoRotateSpeed = 0.25;
    let userActive = false;
    controls.addEventListener("start", () => {
      userActive = true;
    });

    // Stars: decorative backdrop, uniformly random on a sphere.
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1800;
    const starPositions = new Float32Array(starCount * 3);
    let seed = 20260311;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < starCount; i += 1) {
      const u = random() * 2 - 1;
      const phi = random() * Math.PI * 2;
      const r = 90;
      const s = Math.sqrt(1 - u * u);
      starPositions.set([r * s * Math.cos(phi), r * u, r * s * Math.sin(phi)], i * 3);
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: 0x9fbcff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.55 }),
    );
    scene.add(stars);

    const sunDir = new THREE.Vector3(1, 0, 0);
    const earthMaterial = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, sunDir: { value: sunDir } },
      vertexShader: EARTH_VERTEX,
      fragmentShader: EARTH_FRAGMENT,
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), earthMaterial);
    earth.visible = false;
    scene.add(earth);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.16, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: { sunDir: { value: sunDir } },
        vertexShader: EARTH_VERTEX,
        fragmentShader: ATMOSPHERE_FRAGMENT,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    scene.add(atmosphere);

    let disposed = false;
    buildEarthTexture()
      .then((texture) => {
        if (disposed) return texture.dispose();
        earthMaterial.uniforms.map!.value = texture;
        earth.visible = true;
        mount.dataset.ready = "true";
      })
      .catch(() => setFailed("The Earth model could not be loaded. Use the list to choose a spacecraft."));

    // Observer marker lives on the Earth mesh so it turns with the planet.
    const marker = new THREE.Group();
    const markerDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd08a }),
    );
    const markerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.03, 0.036, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    marker.add(markerDot, markerRing);
    marker.visible = false;
    earth.add(marker);

    // Satellites.
    const orbits = new THREE.Group();
    scene.add(orbits);
    const dotGeometry = new THREE.BufferGeometry();
    const discCanvas = document.createElement("canvas");
    discCanvas.width = discCanvas.height = 32;
    const discCtx = discCanvas.getContext("2d");
    if (discCtx) {
      discCtx.fillStyle = "#fff";
      discCtx.beginPath();
      discCtx.arc(16, 16, 13, 0, Math.PI * 2);
      discCtx.fill();
    }
    const dotMaterial = new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(discCanvas),
      alphaTest: 0.4,
      size: 7,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    const dots = new THREE.Points(dotGeometry, dotMaterial);
    dots.frustumCulled = false;
    scene.add(dots);
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.035, 0.042, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false }),
    );
    halo.visible = false;
    scene.add(halo);

    type Tracked = { id: number; rec: ReturnType<typeof satrecFromTle>; line: THREE.Line; position: THREE.Vector3; ok: boolean };
    let tracked: Tracked[] = [];
    let builtVersion = -1;
    let ringsBuiltAt = 0;

    const rebuild = (now: Date) => {
      for (const t of tracked) {
        orbits.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
      }
      const { satellites: sats, selectedId: selected, observer: obs } = live.current;
      tracked = sats.map((s) => {
        const rec = satrecFromTle(s.tle1, s.tle2);
        const isSelected = s.id === selected;
        const line = new THREE.Line(
          new THREE.BufferGeometry(),
          new THREE.LineBasicMaterial({
            color: isSelected ? 0xbfe0ff : 0x4f86d9,
            transparent: true,
            opacity: isSelected ? 0.95 : selected === null ? 0.3 : 0.14,
          }),
        );
        line.renderOrder = isSelected ? 2 : 1;
        orbits.add(line);
        return { id: s.id, rec, line, position: new THREE.Vector3(), ok: false };
      });
      dotGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tracked.length * 3), 3));
      const colors = new Float32Array(tracked.length * 3);
      tracked.forEach((t, i) => {
        const c = t.id === selected ? [1, 1, 1] : [0.55, 0.78, 1];
        colors.set(c, i * 3);
      });
      dotGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      if (obs) {
        marker.position.copy(surfacePoint(obs.latitudeDeg, obs.longitudeDeg, 1.002));
        marker.lookAt(surfacePoint(obs.latitudeDeg, obs.longitudeDeg, 2));
        marker.visible = true;
      } else {
        marker.visible = false;
      }
      rebuildRings(now);
    };

    const rebuildRings = (now: Date) => {
      for (const t of tracked) {
        const points = orbitRing(t.rec, now, 220).map(toScene);
        t.line.geometry.setFromPoints(points);
      }
      ringsBuiltAt = now.getTime();
    };

    // Simulation clock.
    let simMs = startMs;
    let lastFrame = performance.now();
    let lastClockEmit = 0;
    let raf = 0;
    const projected = new THREE.Vector3();

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Keep the whole planet in view on narrow screens.
      camera.fov = w / h < 0.8 ? 52 : 38;
      camera.updateProjectionMatrix();
    };
    const observerResize = new ResizeObserver(resize);
    observerResize.observe(mount);
    resize();

    const frame = (nowPerf: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(nowPerf - lastFrame, 100);
      lastFrame = nowPerf;
      const state = live.current;
      if (!state.paused) simMs += dt * state.speed;
      const now = new Date(simMs);

      if (builtVersion !== sceneVersion.current) {
        builtVersion = sceneVersion.current;
        rebuild(now);
      } else if (Math.abs(simMs - ringsBuiltAt) > 20 * 60_000) {
        rebuildRings(now); // orbits precess slowly; keep the drawn ring current
      }

      earth.rotation.y = gmst(now);
      sunDir.copy(toScene(sunDirectionEci(now).map((v) => v * EARTH_RADIUS_KM) as Vec3)).normalize();

      const positions = dotGeometry.getAttribute("position") as THREE.BufferAttribute | undefined;
      let selected: Tracked | undefined;
      tracked.forEach((t, i) => {
        const eci = eciPosition(t.rec, now);
        t.ok = eci !== null;
        if (eci) t.position.copy(toScene(eci));
        positions?.setXYZ(i, t.position.x, t.position.y, t.position.z);
        if (t.id === state.selectedId) selected = t;
      });
      if (positions) positions.needsUpdate = true;

      controls.autoRotate = state.autoRotate && !userActive && !state.paused;
      controls.update();

      const labelEl = labelRef.current;
      if (selected?.ok) {
        halo.visible = true;
        halo.position.copy(selected.position);
        halo.quaternion.copy(camera.quaternion);
        const scale = camera.position.distanceTo(selected.position) / 3.2;
        halo.scale.setScalar(scale);
        if (labelEl) {
          projected.copy(selected.position).project(camera);
          const behind = projected.z > 1;
          const lx = (projected.x * 0.5 + 0.5) * mount.clientWidth;
          const ly = (-projected.y * 0.5 + 0.5) * mount.clientHeight;
          labelEl.style.opacity = behind ? "0" : "1";
          const flip = lx + 22 + labelEl.offsetWidth > mount.clientWidth;
          labelEl.style.transform = `translate(${flip ? lx - 16 - labelEl.offsetWidth : lx + 14}px, ${ly - 10}px)`;
        }
      } else {
        halo.visible = false;
        if (labelEl) labelEl.style.opacity = "0";
      }

      renderer.render(scene, camera);

      if (state.onClock && nowPerf - lastClockEmit > 250) {
        lastClockEmit = nowPerf;
        state.onClock(now);
      }
    };
    raf = requestAnimationFrame(frame);

    // Picking: nearest satellite to the pointer in screen space, ignoring ones behind Earth.
    let downAt: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      let best: Tracked | null = null;
      let bestDistance = 22;
      const v = new THREE.Vector3();
      const ray = new THREE.Ray();
      const sphere = new THREE.Sphere(new THREE.Vector3(), 0.99);
      const hit = new THREE.Vector3();
      for (const t of tracked) {
        if (!t.ok) continue;
        v.copy(t.position).project(camera);
        if (v.z > 1) continue;
        const d = Math.hypot((v.x * 0.5 + 0.5) * rect.width - px, (-v.y * 0.5 + 0.5) * rect.height - py);
        if (d >= bestDistance) continue;
        ray.origin.copy(camera.position);
        ray.direction.copy(t.position).sub(camera.position).normalize();
        const occluded = ray.intersectSphere(sphere, hit) !== null &&
          hit.distanceTo(camera.position) < t.position.distanceTo(camera.position);
        if (occluded) continue;
        best = t;
        bestDistance = d;
      }
      if (best) live.current.onSelect?.(best.id);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observerResize.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
      (earthMaterial.uniforms.map!.value as THREE.Texture | null)?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [distance, startMs]);

  const selectedName = satellites.find((s) => s.id === selectedId)?.name;

  return (
    <div className={`globe ${className ?? ""}`}>
      <div ref={mountRef} className="globe__canvas" role="img" aria-label={label} data-testid="globe-canvas" />
      <div ref={labelRef} className="globe__label" aria-hidden="true">
        {selectedName}
      </div>
      {failed && (
        <p className="globe__fallback" role="status">
          {failed}
        </p>
      )}
    </div>
  );
}
