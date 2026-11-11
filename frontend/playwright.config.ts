import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run the real stack: FastAPI in snapshot mode (archived CelesTrak capture, so
 * results are deterministic and no network is needed) and a production build of the frontend.
 */
const API_PORT = 8010;
const WEB_PORT = 3010;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  workers: 3,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "off",
    launchOptions: {
      // Software WebGL so the globe renders in headless CI. Set PLAYWRIGHT_CHROMIUM_PATH to use a
      // system Chromium instead of the build Playwright downloads.
      args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: `../backend/.venv/bin/uvicorn app.main:app --port ${API_PORT}`,
      cwd: "../backend",
      env: { ABOVEUS_DATA_MODE: "snapshot", ABOVEUS_DB_PATH: "var/e2e.sqlite3" },
      url: `http://127.0.0.1:${API_PORT}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx next build && npx next start -p ${WEB_PORT}`,
      env: { ABOVEUS_API_URL: `http://127.0.0.1:${API_PORT}`, NEXT_DIST_DIR: ".next-e2e" },
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
