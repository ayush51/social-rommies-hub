import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { audit, BASE, CODES, record, signInAs } from "./helpers";

// 1x1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

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

async function check(page: Page, name: string, project: string, problems: string[]) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const a = await audit(page);
  await page.screenshot({ path: `e2e/screens/${project}/pets_${name}.png` });
  record(project, { kind: "page", path: `pets:${name}`, overflowX: a.overflowX, small: a.small, unnamed: a.unnamed, covered: a.covered, tinyText: a.tinyText, problems });
  expect(a.overflowX, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  expect(problems, problems.join("\n")).toEqual([]);
  expect(a.covered, `${name}: covered ${a.covered.join("; ")}`).toEqual([]);
  expect(a.unnamed, `${name}: unnamed controls`).toEqual([]);
  expect(a.small.filter((s) => s.h < 32 || s.w < 32), `${name}: tiny tap targets`).toEqual([]);
}

// Clients cannot delete pets; remove photos through the storage API as the admin, rows through the CLI.
async function cleanup(prefix: string) {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  await s.auth.signInWithPassword({ email: "ayush@abingdon.example.com", password: CODES.ayush! });
  const { data: pets } = await s.from("pets").select("id, household_id").like("name", `${prefix}%`);
  for (const p of pets ?? []) {
    const dir = `${p.household_id}/${p.id}`;
    const { data: files } = await s.storage.from("pets").list(dir);
    if (files?.length) await s.storage.from("pets").remove(files.map((f) => `${dir}/${f.name}`));
  }
  execSync(`supabase db query --linked "delete from public.pets where name like '${prefix}%'"`, { stdio: "ignore" });
}

test("pets: admin adds a pet, a member feeds it, daily cap, cleanup @stateful", async ({ page, context }, info) => {
  // stateful (adds a pet, feeds it to the daily cap): one device runs it; page layouts are audited for every device in ui.spec.ts
  test.skip(info.project.name !== "iphone-portrait", "shared account and pet");
  const project = info.project.name;
  const name = `E2E Pet ${project}`;
  await cleanup(name);
  try {
    // admin creates a pet with a photo
    await signInAs(context, "ayush");
    let problems = watch(page);
    await page.goto("/admin/pets");
    await expect(page.getByRole("heading", { name: "Pets", exact: true })).toBeVisible({ timeout: 15_000 });
    const add = page.getByRole("form", { name: "Add a pet" });
    await add.getByLabel("Name").fill(name);
    await add.getByLabel("Species").fill("test goldfish");
    await add.getByLabel("Bio").fill("Created by the e2e suite.");
    await add.locator('input[type="file"]').setInputFiles({ name: "pet.png", mimeType: "image/png", buffer: PNG });
    await add.getByRole("button", { name: "Add pet" }).click();
    await expect(add.getByText("Added.")).toBeVisible({ timeout: 20_000 });
    const edit = page.getByRole("form", { name: `Edit ${name}` });
    await expect(edit).toBeVisible({ timeout: 15_000 });
    await expect(edit.getByRole("img", { name })).toBeVisible();
    await check(page, "admin", project, problems);

    // a member feeds it
    await context.clearCookies();
    await signInAs(context, "tyler");
    problems = watch(page);
    await page.goto("/pets");
    const card = page.getByRole("region", { name });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => card.locator("img").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 10_000 }).toBe(true);
    await expect(card.getByRole("progressbar", { name: "Hunger" })).toHaveAttribute("aria-valuenow", /^\d+$/);
    await expect(card.getByRole("progressbar", { name: "Happiness" })).toHaveAttribute("aria-valuenow", /^\d+$/);
    await check(page, "list", project, problems);
    const feed = card.getByRole("button", { name: /^Feed/ });
    await expect(feed).toContainText("2 left");
    await feed.click();
    await expect(card.getByText(`${name} is fed`)).toBeVisible({ timeout: 10_000 });
    await expect(feed).toContainText("1 left", { timeout: 10_000 });
    await feed.click();
    await expect(feed).toBeDisabled({ timeout: 10_000 });
    await expect(card.getByText("No feeds left today.")).toBeVisible({ timeout: 10_000 });
    await expect(card.getByText("Last fed by Tyler")).toBeVisible();

    // profile page
    await card.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Created by the e2e suite.")).toBeVisible();
    await expect(page.getByText(`Tyler fed ${name}`).first()).toBeVisible({ timeout: 10_000 });
    await check(page, "profile", project, problems);

    // admin deactivates: it leaves the member list
    await context.clearCookies();
    await signInAs(context, "ayush");
    await page.goto("/admin/pets");
    await page.getByRole("form", { name: `Edit ${name}` }).getByRole("button", { name: "Deactivate", exact: true }).click();
    await expect(page.getByRole("form", { name: `Edit ${name}` }).getByRole("button", { name: "Activate", exact: true })).toBeVisible({ timeout: 15_000 });
    await page.goto("/pets");
    await expect(page.getByRole("heading", { name: "Pets", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name })).toHaveCount(0);
  } finally {
    await cleanup(name);
  }
});

test("pets: non-admins get a 404 on /admin/pets", async ({ page, context }) => {
  await signInAs(context, "tyler");
  const res = await page.goto("/admin/pets");
  expect(res?.status()).toBe(404);
});
