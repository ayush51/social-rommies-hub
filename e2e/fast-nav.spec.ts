import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { signInAs, userIdOf } from "./helpers";

// Prefetched, cached tab pages must stay correct: no lost taps while data changes, and changes made while you were away show up.
test("rapid tab taps while a roommate's status keeps changing: none lost, changes appear @stateful", async ({ page, context }, info) => {
  test.skip(info.project.name !== "iphone-portrait", "changes a roommate's visible status for ~40s; one device runs it");
  test.setTimeout(180_000);
  await signInAs(context, "ayush");
  const tylerId = await userIdOf("tyler");
  const t = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  await t.auth.signInWithPassword({ email: "tyler@abingdon.example.com", password: process.env.E2E_TYLER! });
  const hid = (await t.from("household_members").select("household_id").eq("user_id", tylerId).single()).data!.household_id;
  let stop = false, i = 0;
  const spam = (async () => { while (!stop) { await t.from("statuses").upsert({ user_id: tylerId, household_id: hid, kind: "custom", label: `automated test ${i++}`, updated_at: new Date().toISOString() }); await new Promise((r) => setTimeout(r, 600)); } })();
  const nav = (label: string) => page.getByRole("navigation").getByRole("link", { name: label, exact: true });
  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "The Couch" })).toBeVisible();
    await page.waitForTimeout(2500);
    let lost = 0, total = 0;
    for (let round = 0; round < 8; round++) {
      for (const [label, heading] of [["Daily", "Daily"], ["Plans", "Plans"], ["Games", "Games"], ["Chat", "Chat"], ["Home", "The Couch"]] as const) {
        await nav(label).click();
        total++;
        try { await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible({ timeout: 4000 }); }
        catch { lost++; await nav(label).click().catch(() => {}); await page.waitForTimeout(1500); }
        await page.waitForTimeout(250);                      // quick human taps
      }
    }
    expect(lost, `${lost} of ${total} taps did not navigate`).toBe(0);

    // freshness: leave Home, change the status, come back: the new status must show (cached page revalidates)
    stop = true; await spam;
    await nav("Daily").click();
    await expect(page.getByRole("heading", { name: "Daily" }).first()).toBeVisible();
    const marker = `automated test fresh ${Date.now()}`;
    await t.from("statuses").upsert({ user_id: tylerId, household_id: hid, kind: "custom", label: marker, updated_at: new Date().toISOString() });
    await nav("Home").click();
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 5000 });
  } finally {
    stop = true; await spam;
    execFileSync("supabase", ["db", "query", "--linked", `delete from public.statuses where user_id = '${tylerId}'`], { stdio: "ignore" });
  }
});
