import { expect, test, type Page } from "@playwright/test";
import { audit, BASE, record, signInAs } from "./helpers";

// Uses mocked coordinates only. Every test ends by stopping the share so no mock location stays in the database.
test.use({ geolocation: { latitude: 42.36, longitude: -71.06 }, permissions: [] });

function watch(page: Page) {
  const problems: string[] = [];
  // WebKit reports cancelled router prefetches as page errors
  page.on("pageerror", (e) => !/access control checks/.test(e.message) && problems.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|access control checks|WebSocket connection|Failed to load resource: the server responded with a status of (401|404)/.test(m.text())) problems.push(`console: ${m.text().slice(0, 160)}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.url().replace(BASE, "")}`);
  });
  return problems;
}

async function stopIfSharing(page: Page) {
  await page.goto("/location");
  const stop = page.getByRole("button", { name: "Stop", exact: true });
  await expect(stop.or(page.getByRole("heading", { name: "Start sharing" }))).toBeVisible({ timeout: 15_000 });
  if (await stop.isVisible()) await stop.click();
  await expect(page.getByRole("heading", { name: "Start sharing" })).toBeVisible({ timeout: 10_000 });
}

test("location page: audit, no geolocation before the tap, start -> pill -> pause -> stop @stateful", async ({ page, context }, info) => {
  // both tests share one user's single location row, so only one device runs them (layouts are audited for all devices in ui.spec.ts)
  test.skip(info.project.name !== "iphone-portrait", "shared account and row");
  await signInAs(context, "ayush");
  await page.addInitScript(() => {
    const w = window as unknown as { __geoCalls: number };
    w.__geoCalls = 0;
    const g = navigator.geolocation;
    for (const m of ["getCurrentPosition", "watchPosition"] as const) {
      const orig = g[m].bind(g) as (...a: unknown[]) => unknown;
      (g as unknown as Record<string, unknown>)[m] = (...a: unknown[]) => {
        w.__geoCalls++;
        return orig(...a);
      };
    }
  });
  const problems = watch(page);
  try {
    await page.goto("/location");
    await stopIfSharing(page);
    await expect(page.getByRole("heading", { name: "Location" })).toBeVisible();
    await page.waitForLoadState("networkidle").catch(() => {});
    expect(await page.evaluate(() => (window as unknown as { __geoCalls: number }).__geoCalls), "geolocation touched before the tap").toBe(0);
    await expect(page.getByText("Sharing your location")).toHaveCount(0);

    const a = await audit(page);
    await page.screenshot({ path: `e2e/screens/${info.project.name}/location.png` });
    record(info.project.name, { kind: "page", path: "/location", overflowX: a.overflowX, small: a.small, unnamed: a.unnamed, covered: a.covered, tinyText: a.tinyText, problems });
    expect(a.overflowX).toBeLessThanOrEqual(1);
    expect(a.small.filter((s) => s.h < 32 || s.w < 32), JSON.stringify(a.small)).toEqual([]);
    expect(a.unnamed).toEqual([]);
    expect(a.covered, a.covered.join("; ")).toEqual([]);

    // explicit tap: now geolocation is allowed
    await context.grantPermissions(["geolocation"]);
    await page.getByRole("button", { name: "Precise" }).click();
    await page.getByLabel("For how long?").selectOption("15");
    await page.getByRole("button", { name: "Start sharing" }).click();
    const pill = page.getByRole("button", { name: "Stop sharing your location" });
    await expect(pill).toBeVisible({ timeout: 15_000 });
    expect((await pill.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => (window as unknown as { __geoCalls: number }).__geoCalls)).toBeGreaterThan(0);
    await expect(page.getByText("You are sharing")).toBeVisible();
    await page.screenshot({ path: `e2e/screens/${info.project.name}/location_sharing.png` });
    const a2 = await audit(page);
    expect(a2.small.filter((s) => s.h < 32 || s.w < 32), JSON.stringify(a2.small)).toEqual([]);

    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByText("Sharing is paused")).toBeVisible({ timeout: 10_000 });
    await expect(pill).toBeHidden({ timeout: 10_000 });
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(pill).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Start sharing" })).toBeVisible({ timeout: 10_000 });
    await expect(pill).toBeHidden();
    expect(problems, problems.join("\n")).toEqual([]);
  } finally {
    await stopIfSharing(page).catch(() => {});
  }
});

test("pill stop works from another page @stateful", async ({ page, context }, info) => {
  test.skip(info.project.name !== "iphone-portrait", "shared account and row");
  await signInAs(context, "ayush");
  try {
    await stopIfSharing(page);
    await context.grantPermissions(["geolocation"]);
    await page.getByRole("button", { name: "Start sharing" }).click();
    const pill = page.getByRole("button", { name: "Stop sharing your location" });
    await expect(pill).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("You are sharing")).toBeVisible(); // the post-start refresh has landed
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.goto("/wallet");
    await expect(pill).toBeVisible({ timeout: 10_000 });
    await pill.click();
    await expect(pill).toBeHidden({ timeout: 10_000 });
  } finally {
    await stopIfSharing(page).catch(() => {});
  }
});
