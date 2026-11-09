import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { signInAs, userIdOf } from "./helpers";

// A DM that arrives while you are on another tab must show up when you come back to the (cached) thread.
test("cached chat never hides a message that arrived while you were away @stateful", async ({ page, context }, info) => {
  test.skip(info.project.name !== "iphone-portrait", "sends a private test DM between the two test accounts");
  await signInAs(context, "ayush");
  const tylerId = await userIdOf("tyler");
  const ayushId = await userIdOf("ayush");
  const t = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  await t.auth.signInWithPassword({ email: "tyler@abingdon.example.com", password: process.env.E2E_TYLER! });
  const hid = (await t.from("household_members").select("household_id").eq("user_id", tylerId).single()).data!.household_id;
  const marker = `automated test ${Date.now()}`;
  const nav = (label: string) => page.getByRole("navigation").getByRole("link", { name: label, exact: true });
  try {
    await page.goto("/");
    await nav("Chat").click();
    await page.locator(`a[href="/chat/dm/${tylerId}"]`).click();        // first visit caches the DM thread
    await expect(page.getByRole("heading", { name: "Tyler" })).toBeVisible();
    await nav("Home").click();
    await expect(page.getByRole("heading", { name: "Abingdon Bros" })).toBeVisible();
    const { error } = await t.from("messages").insert({ household_id: hid, user_id: tylerId, recipient_id: ayushId, body: marker });
    expect(error).toBeNull();
    await nav("Chat").click();
    await page.locator(`a[href="/chat/dm/${tylerId}"]`).click();        // revisit within the cache window
    await expect(page.getByText(marker)).toBeVisible({ timeout: 5000 });
  } finally {
    execFileSync("supabase", ["db", "query", "--linked", `delete from public.messages where body = '${marker}'; delete from public.chat_reads where thread = '${tylerId}' and user_id = '${ayushId}'`], { stdio: "ignore" });
  }
});
