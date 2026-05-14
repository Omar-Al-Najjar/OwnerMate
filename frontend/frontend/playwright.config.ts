import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const useLocalServer = process.env.PLAYWRIGHT_USE_LOCAL_SERVER === "true";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  outputDir: "./test-results",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: useLocalServer
    ? {
        command: "npm run build && node .next/standalone/server.js",
        env: {
          HOSTNAME: "127.0.0.1",
          PORT: "3001",
        },
        url: "http://127.0.0.1:3001/en/sign-in",
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : undefined,
});
