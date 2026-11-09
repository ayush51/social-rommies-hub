import { defineConfig, devices } from "@playwright/test";

// Run against production by default:  E2E_AYUSH=<code> E2E_TYLER=<code> pnpm exec playwright test
// Codes come from the environment so they never land in the repo.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  workers: 3,
  reporter: [["list"]],
  use: { baseURL: process.env.BASE_URL ?? "https://abingdon-bros.vercel.app", trace: "off" },
  projects: [
    { name: "iphone-portrait", use: { ...devices["iPhone 14"] } },
    { name: "iphone-landscape", use: { ...devices["iPhone 14 landscape"] } },
    { name: "iphone-se", use: { ...devices["iPhone SE"] } },
    { name: "pixel", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
});
