import { defineConfig, devices } from "@playwright/test";
import { leaseSeconds, modelTimeoutMs, serverLog } from "./tests/server-timing";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  webServer: [
    {
      command: "npx tsx tests/external-services.ts",
      url: "http://127.0.0.1:3101/health",
      reuseExistingServer: false,
    },
    {
      // The server log is copied to a file so tests can check what processing failures record.
      command: `npm run db:setup -- --seed && mkdir -p .local && npm run dev -- --port 3100 2>&1 | tee ${serverLog} 1>&2`,
      env: {
        APP_ORIGIN: "http://127.0.0.1:3100",
        SUPABASE_URL: "http://127.0.0.1:3101",
        SUPABASE_PUBLISHABLE_KEY: "external-fixture-publishable-key",
        NEBIUS_BASE_URL: "http://127.0.0.1:3101/v1",
        NEBIUS_API_KEY: "external-fixture-key",
        NEBIUS_MODEL: "nvidia/test-nemotron-fixture",
        NEARHOOD_LEASE_SECONDS: String(leaseSeconds),
        NEARHOOD_MODEL_TIMEOUT_MS: String(modelTimeoutMs),
        NEARHOOD_DISCOVERY_PER_MINUTE: "1000",
        TAVILY_BASE_URL: "http://127.0.0.1:3101/tavily",
        TAVILY_API_KEY: "external-fixture-tavily-key",
        DATABASE_URL:
          process.env.TEST_DATABASE_URL ??
          "postgresql://127.0.0.1:55432/nearhood_test",
      },
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
