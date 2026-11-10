import { expect, test, type Page } from "@playwright/test";
import { audit, BASE, CODES, record, signInAs, timings, userIdOf } from "./helpers";

const PAGES: [string, string][] = [
  ["/", "The Couch"],
  ["/daily", "Daily"],
  ["/daily/memories", "Memories"],
  ["/plans", "Plans"],
  ["/plans/new", "New plan"],
  ["/games", "Games"],
  ["/games/monopoly", "Abingdon Street"],
  ["/chat", "Chat"],
  ["/wallet", "Wallet"],
  ["/leaderboard", "Leaderboard"],
  ["/predictions", "Predictions"],
  ["/predictions/new", "New prediction"],
  ["/thursday", "Thirsty Thursday"],
  ["/features", "Feature ideas"],
  ["/profile", "Ayush"],
  ["/admin", "Admin"],
  ["/admin/features", "Feature requests"],
  ["/admin/questions", "Suggested questions"],
  ["/admin/roommates", "People"],
  ["/admin/settings", "Settings"],
  ["/admin/moderation", "Moderate"],
  ["/admin/stats", "Stats"],
  ["/admin/pets", "Pets"],
  ["/pets", "Pets"],
  ["/games/chess", "Chess"],
  ["/location", "Location"],
];

function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of (401|404)/.test(m.text())) problems.push(`console: ${m.text().slice(0, 160)}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.url().replace(BASE, "")}`);
  });
  return problems;
}

test.describe("pages", () => {
  for (const [path, heading] of PAGES) {
    test(`${path}`, async ({ page, context }, info) => {
      await signInAs(context, "ayush");
      const problems = watch(page);
      const started = Date.now();
      const res = await page.goto(path, { waitUntil: "load" });
      expect(res?.status(), "status").toBeLessThan(400);
      await expect(page.getByRole("heading", { name: heading, exact: false }).first()).toBeVisible({ timeout: 15_000 });
      const visibleMs = Date.now() - started;
      await page.waitForLoadState("networkidle").catch(() => {});
      const t = await timings(page);
      const a = await audit(page);
      const shot = `e2e/screens/${info.project.name}${path === "/" ? "/home" : path.replace(/\//g, "_")}.png`;
      await page.screenshot({ path: shot.replace("/_", "/"), fullPage: false });
      record(info.project.name, { kind: "page", path, visibleMs, ...t, overflowX: a.overflowX, small: a.small, unnamed: a.unnamed, covered: a.covered, tinyText: a.tinyText, problems });

      expect(a.overflowX, `horizontal overflow ${a.overflowX}px`).toBeLessThanOrEqual(1);
      expect(problems, problems.join("\n")).toEqual([]);
      expect(a.covered, `covered tap targets: ${a.covered.join("; ")}`).toEqual([]);
      expect(a.small.filter((s) => s.h < 32 || s.w < 32), `tiny tap targets: ${JSON.stringify(a.small.filter((s) => s.h < 32 || s.w < 32))}`).toEqual([]);
      expect(visibleMs, "time until the heading is visible").toBeLessThan(8000);
    });
  }
});

test("bottom nav: every tab opens, fast", async ({ page, context }, info) => {
  await signInAs(context, "ayush");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The Couch" })).toBeVisible();
  await page.waitForLoadState("networkidle"); // a person can't tap before the page has painted and started up
  const results: Record<string, number> = {};
  for (const [label, heading] of [["Daily", "Daily"], ["Plans", "Plans"], ["Games", "Games"], ["Chat", "Chat"], ["Home", "The Couch"]] as const) {
    const nav = page.getByRole("navigation").getByRole("link", { name: label, exact: true });
    await expect(nav).toBeVisible();
    const box = await nav.boundingBox();
    expect(box!.height, `${label} tab height`).toBeGreaterThanOrEqual(40);
    const t0 = Date.now();
    await nav.click();
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible({ timeout: 10_000 });
    results[label] = Date.now() - t0;
  }
  record(info.project.name, { kind: "nav", ...results });
  for (const [k, v] of Object.entries(results)) expect(v, `${k} tab took ${v}ms`).toBeLessThan(5000);
});

test("login form: name tiles, 6-digit limit, wrong code, right code", async ({ page }, info) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "The Couch" })).toBeVisible();
  const tiles = page.getByRole("button").filter({ hasText: /^(Jay|Micah|Tyler|Ayush|Jesse|Kelly)$/ });
  await expect(tiles).toHaveCount(6);
  for (const b of await tiles.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await audit(page).then((a) => a.overflowX)).toBeLessThanOrEqual(1);
  await tiles.filter({ hasText: "Ayush" }).click();
  const pin = page.locator('input[name="pin"]');
  await expect(pin).toBeFocused();
  await pin.fill("12345678");
  expect((await pin.inputValue()).length, "PIN field must stop at 6 digits").toBe(6);
  await pin.fill("000000");
  await page.getByRole("button", { name: "Let me in" }).click();
  await expect(page.getByText("Wrong PIN.")).toBeVisible({ timeout: 10_000 });
  await pin.fill(CODES.ayush!);
  const t0 = Date.now();
  await page.getByRole("button", { name: "Let me in" }).click();
  await page.waitForURL(BASE + "/", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "The Couch" })).toBeVisible();
  record(info.project.name, { kind: "login", loginMs: Date.now() - t0 });
});

test("status: select does nothing until Set status; set and clear @stateful", async ({ page, context }, info) => {
  // every device project shares one account, so only one runs this to avoid racing itself
  test.skip(info.project.name !== "iphone-portrait", "mutates the shared account's status");
  await signInAs(context, "ayush");
  await page.goto("/");
  const set = page.getByRole("button", { name: /^Set status/ });
  await expect(set).toBeDisabled();
  await page.locator("section", { hasText: "What are you up to?" }).getByRole("button", { name: "Cooking" }).click();
  await expect(set).toBeEnabled();
  await expect(set).toContainText("Cooking");
  const t0 = Date.now();
  await set.click();
  await expect(page.getByText("Right now: Cooking")).toBeVisible({ timeout: 10_000 });
  record(info.project.name, { kind: "status-set", ms: Date.now() - t0 });
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByText("Right now:")).toBeHidden({ timeout: 10_000 });
});

test("chat: DM chips, composer tray, reply UI, emoji bar", async ({ page, context }) => {
  const { userId } = await signInAs(context, "ayush");
  const tyler = await userIdOf("tyler");
  await page.goto("/chat");
  await expect(page.getByRole("heading", { name: "Chat" })).toBeVisible();
  await expect(page.locator('a[href^="/chat/dm/"]')).toHaveCount(5);
  // composer stays usable, not hidden behind the nav
  const input = page.getByPlaceholder("Message");
  await expect(input).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); // landscape phones scroll the page
  await page.waitForTimeout(150);
  // the tallest control in the composer row is the Send button: all of it must clear the bottom nav
  const send = await page.getByRole("button", { name: "Send", exact: true }).boundingBox();
  const nav = await page.getByRole("navigation").boundingBox();
  expect(send!.y + send!.height, "Send button must sit above the bottom nav").toBeLessThanOrEqual(nav!.y + 1);
  await page.getByRole("button", { name: "Add a photo" }).click();
  await expect(page.getByRole("button", { name: /Camera/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Photo library/ })).toBeVisible();
  // pick an image from the "library": preview appears, nothing is sent
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.locator('input[type=file]').nth(1).setInputFiles({ name: "t.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("button", { name: "Remove photo" })).toBeVisible();
  await page.getByRole("button", { name: "Remove photo" }).click();
  await input.fill("typing only, never sent");
  expect(await input.inputValue()).toContain("never sent");
  // a message's action bar
  const first = page.getByRole("button", { name: "React or reply" }).first();
  if (await first.count()) {
    await first.click();
    await expect(page.getByRole("button", { name: "Reply", exact: true }).first()).toBeVisible();
    for (const b of await page.locator("button", { hasText: /^(👍|😂|❤️|🔥|😮|😢|🙏|🎉)$/ }).all()) {
      const bb = await b.boundingBox();
      expect(bb!.width, "emoji button width").toBeGreaterThanOrEqual(28);
    }
    await page.getByRole("button", { name: "Reply", exact: true }).first().click();
    await expect(page.getByText(/^Replying to/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel reply" }).click();
  }
  // DM page
  await page.goto(`/chat/dm/${tyler}`);
  await expect(page.getByRole("heading", { name: "Tyler" })).toBeVisible();
  await expect(page.getByPlaceholder("Message")).toBeVisible();
  void userId;
});

test("games: Abingdon Street lobby form is usable", async ({ page, context }) => {
  await signInAs(context, "ayush");
  await page.goto("/games");
  await page.getByRole("link", { name: /Abingdon Street/ }).click();
  await expect(page.getByRole("heading", { name: "Abingdon Street" })).toBeVisible();
  const selects = page.locator("select");
  await expect(selects).toHaveCount(2);
  for (const s of await selects.all()) expect((await s.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await selects.first().selectOption("10");
  await expect(page.getByRole("button", { name: "Open lobby" })).toBeEnabled();
});

test("admin area: member gets 404, admin gets in", async ({ page, context, browser }) => {
  await signInAs(context, "ayush");
  const ok = await page.goto("/admin");
  expect(ok?.status()).toBe(200);
  const memberCtx = await browser.newContext();
  await signInAs(memberCtx, "tyler");
  const mp = await memberCtx.newPage();
  for (const p of ["/admin", "/admin/features", "/admin/questions"]) {
    const res = await mp.goto(p);
    expect(res?.status(), `${p} for a member`).toBe(404);
    await expect(mp.getByText("Admin mode")).toHaveCount(0);
  }
  await memberCtx.close();
  const anon = await browser.newContext();
  const ap = await anon.newPage();
  await ap.goto("/admin");
  expect(ap.url()).toContain("/login");
  await anon.close();
});

test("rotate: portrait to landscape and back keeps the layout intact", async ({ page, context }, info) => {
  test.skip(!info.project.name.startsWith("iphone-portrait"), "orientation flip is exercised from the portrait phone project");
  await signInAs(context, "ayush");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The Couch" })).toBeVisible();
  for (const size of [{ width: 844, height: 390 }, { width: 390, height: 844 }, { width: 667, height: 375 }, { width: 375, height: 667 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(300);
    const a = await audit(page);
    const navBox = await page.getByRole("navigation").boundingBox();
    expect(a.overflowX, `${size.width}x${size.height} overflow`).toBeLessThanOrEqual(1);
    expect(navBox!.y + navBox!.height, `nav stays on screen at ${size.width}x${size.height}`).toBeLessThanOrEqual(size.height + 1);
    // nav must not take more than a third of a landscape screen
    expect(navBox!.height, `nav height at ${size.width}x${size.height}`).toBeLessThan(size.height / 3);
    record(info.project.name, { kind: "rotate", size: `${size.width}x${size.height}`, navHeight: Math.round(navBox!.height), overflowX: a.overflowX, covered: a.covered });
  }
});
