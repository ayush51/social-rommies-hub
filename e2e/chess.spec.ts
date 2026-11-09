import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { audit, BASE, CODES, record, signInAs } from "./helpers";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function client(who: "ayush" | "tyler") {
  const s = createClient(URL_, KEY, { auth: { persistSession: false } });
  const { error } = await s.auth.signInWithPassword({ email: `${who}@abingdon.example.com`, password: CODES[who]! });
  if (error) throw error;
  return s;
}

// Free game only (no bingdons move). Ayush hosts as white, Tyler joins. Retries if another project holds the single open-lobby slot.
async function newGame(a: SupabaseClient, t: SupabaseClient) {
  for (let i = 0; i < 20; i++) {
    const { data, error } = await a.rpc("chess_create", { p_buy_in: 0, p_color: "white" });
    if (!error) {
      const id = (data as { game: string }).game;
      const j = await t.rpc("chess_join", { p_game: id });
      if (j.error) throw j.error;
      return id;
    }
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
  }
  throw new Error("could not open a lobby");
}

function cleanup(id: string) {
  const sql = `delete from push_events where url = '/games/chess/${id}'; delete from chess_games where id = '${id}';`;
  execFileSync("supabase", ["db", "query", "--linked", sql], { stdio: "ignore" });
}

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

async function check(page: Page, project: string, path: string, problems: string[]) {
  const a = await audit(page);
  record(project, { kind: "chess", path, overflowX: a.overflowX, small: a.small, unnamed: a.unnamed, covered: a.covered, problems });
  expect(a.overflowX, `horizontal overflow ${a.overflowX}px`).toBeLessThanOrEqual(1);
  expect(problems, problems.join("\n")).toEqual([]);
  expect(a.covered, `covered: ${a.covered.join("; ")}`).toEqual([]);
  expect(a.unnamed, `unnamed controls: ${a.unnamed.join("; ")}`).toEqual([]);
  const tiny = a.small.filter((s) => s.h < 32 || s.w < 32);
  expect(tiny, `tiny tap targets: ${JSON.stringify(tiny)}`).toEqual([]);
}

test("chess lobby page", async ({ page, context }, info) => {
  await signInAs(context, "ayush");
  const problems = watch(page);
  await page.goto("/games/chess", { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: "Chess", exact: true })).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: `e2e/screens/${info.project.name}/chess_lobby.png` });
  await check(page, info.project.name, "/games/chess", problems);
});

test("chess game: board audit and play e4", async ({ browser, page, context }, info) => {
  const a = await client("ayush");
  const t = await client("tyler");
  const id = await newGame(a, t);
  try {
    await signInAs(context, "ayush");
    const problems = watch(page);
    await page.goto(`/games/chess/${id}`, { waitUntil: "load" });
    await expect(page.getByRole("button", { name: "e2, white pawn" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Your move").first()).toBeVisible();
    await page.waitForLoadState("networkidle").catch(() => {});

    const sq = await page.getByRole("button", { name: "e2, white pawn" }).boundingBox();
    record(info.project.name, { kind: "chess-square", w: sq?.width, h: sq?.height });
    if (info.project.name === "iphone-portrait") expect(sq!.width).toBeGreaterThanOrEqual(40);
    expect(sq!.width).toBeGreaterThanOrEqual(34);

    // out-of-turn / forged calls are refused
    const forged = await t.rpc("chess_apply_move", { p_secret: "guess", p_game: id, p_san: "e5", p_fen: "x b", p_pgn: "1. e5", p_outcome: "none" });
    expect(forged.error?.message).toContain("forbidden");
    const forged2 = await a.rpc("chess_apply_move", { p_secret: "guess", p_game: id, p_san: "e4", p_fen: "x b", p_pgn: "1. e4", p_outcome: "none" });
    expect(forged2.error?.message).toContain("forbidden");

    await page.screenshot({ path: `e2e/screens/${info.project.name}/chess_game.png` });
    await check(page, info.project.name, "/games/chess/[id]", problems);

    if (info.project.name !== "iphone-portrait") return;

    // tap e2 -> destinations shown -> tap e4
    await page.getByRole("button", { name: "e2, white pawn" }).click();
    await expect(page.getByRole("button", { name: "e4, empty, legal move" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^e5, empty$/ })).toBeVisible();
    await page.screenshot({ path: `e2e/screens/${info.project.name}/chess_selected.png` });
    await page.getByRole("button", { name: "e4, empty, legal move" }).click();
    await expect(page.getByRole("button", { name: "e4, white pawn" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("list", { name: "Move list" })).toContainText("e4");
    await expect(page.getByText("to move").first()).toBeVisible();
    // not my turn any more: board is locked
    await expect(page.getByRole("button", { name: "d2, white pawn" })).toBeDisabled();

    // Tyler sees the move, may move, and Ayush cannot move out of turn through the DB either
    const tctx = await browser.newContext({ ...info.project.use });
    await signInAs(tctx, "tyler");
    const tp = await tctx.newPage();
    await tp.goto(`/games/chess/${id}`, { waitUntil: "load" });
    await expect(tp.getByRole("button", { name: "e4, white pawn" })).toBeVisible({ timeout: 15_000 });
    await expect(tp.getByText("Your move").first()).toBeVisible();
    await expect(tp.getByRole("button", { name: "e7, black pawn" })).toBeEnabled();
    await expect(tp.getByRole("button", { name: "e2, empty" })).toBeVisible(); // black player: board flipped, still labelled
    const top = await tp.getByRole("button", { name: "a1, white rook" }).boundingBox();
    const bottom = await tp.getByRole("button", { name: "a8, black rook" }).boundingBox();
    expect(bottom!.y, "black sits at the bottom").toBeGreaterThan(top!.y);
    await tp.screenshot({ path: `e2e/screens/${info.project.name}/chess_black.png` });
    await tctx.close();
    const row = await a.from("chess_games").select("turn, pgn").eq("id", id).single();
    expect(row.data).toMatchObject({ turn: "b", pgn: expect.stringContaining("1. e4") });
  } finally {
    cleanup(id);
  }
});
