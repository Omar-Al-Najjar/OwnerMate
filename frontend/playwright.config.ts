import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npx next start -p 3001",
    url: "http://127.0.0.1:3001/en/sign-in",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
