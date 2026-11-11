import * as THREE from "three";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

/**
 * Draws a stylised Earth (Natural Earth coastlines, public domain) to a canvas texture.
 * It is a diagram of the planet, not imagery: no clouds, no city lights, nothing implied.
 */
export async function buildEarthTexture(): Promise<THREE.CanvasTexture> {
  const topology = (await import("world-atlas/land-50m.json")).default as unknown as Topology;
  const land = feature(topology, topology.objects.land as GeometryCollection);

  const width = 4096;
  const height = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");

  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, "#07132b");
  ocean.addColorStop(0.5, "#0a1d3f");
  ocean.addColorStop(1, "#07132b");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  const x = (lon: number) => ((lon + 180) / 360) * width;
  const y = (lat: number) => ((90 - lat) / 180) * height;

  // Graticule every 15 degrees.
  ctx.strokeStyle = "rgba(130, 175, 255, 0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let lon = -180; lon <= 180; lon += 15) {
    ctx.moveTo(x(lon), 0);
    ctx.lineTo(x(lon), height);
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    ctx.moveTo(0, y(lat));
    ctx.lineTo(width, y(lat));
  }
  ctx.stroke();

  const trace = (rings: number[][][]) => {
    for (const ring of rings) {
      ring.forEach(([lon, lat], i) => {
        if (lon === undefined || lat === undefined) return;
        if (i === 0) ctx.moveTo(x(lon), y(lat));
        else ctx.lineTo(x(lon), y(lat));
      });
      ctx.closePath();
    }
  };

  ctx.beginPath();
  for (const f of land.features) {
    const g = f.geometry;
    if (g.type === "Polygon") trace(g.coordinates);
    else if (g.type === "MultiPolygon") g.coordinates.forEach(trace);
  }
  ctx.fillStyle = "#1b3a6b";
  ctx.fill();
  ctx.strokeStyle = "rgba(140, 200, 255, 0.75)";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
