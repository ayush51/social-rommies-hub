import { appendFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { BrowserContext, Page } from "@playwright/test";

export const BASE = process.env.BASE_URL ?? "https://abingdon-bros.vercel.app";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const CODES: Record<string, string | undefined> = { ayush: process.env.E2E_AYUSH, tyler: process.env.E2E_TYLER };

// One sign-in per user per worker (tokens last an hour), so the suite stays well under auth rate limits.
const sessions = new Map<string, Promise<{ session: Awaited<ReturnType<ReturnType<typeof createClient>["auth"]["signInWithPassword"]>>["data"]["session"]; userId: string }>>();
function session(who: "ayush" | "tyler") {
  if (!sessions.has(who)) {
    sessions.set(
      who,
      (async () => {
        const s = createClient(URL_, KEY, { auth: { persistSession: false } });
        const { data, error } = await s.auth.signInWithPassword({ email: `${who}@abingdon.example.com`, password: CODES[who]! });
        if (error) throw error;
        return { session: data.session, userId: data.user.id };
      })(),
    );
  }
  return sessions.get(who)!;
}

// Installs the same cookie the app sets, so page tests skip the login form.
export async function signInAs(context: BrowserContext, who: "ayush" | "tyler") {
  const { session: sess, userId } = await session(who);
  const ref = new URL(URL_).hostname.split(".")[0];
  const value = "base64-" + Buffer.from(JSON.stringify(sess)).toString("base64url");
  const parts = value.match(/.{1,3180}/g)!;
  await context.addCookies(parts.map((p, i) => ({ name: `sb-${ref}-auth-token${parts.length > 1 ? "." + i : ""}`, value: p, url: BASE })));
  return { userId };
}

export async function userIdOf(who: "ayush" | "tyler") {
  return (await session(who)).userId;
}

export function record(project: string, entry: Record<string, unknown>) {
  mkdirSync("e2e/report", { recursive: true });
  appendFileSync("e2e/report/metrics.jsonl", JSON.stringify({ project, ...entry }) + "\n");
}

export type Audit = {
  overflowX: number;
  small: { tag: string; text: string; w: number; h: number }[];
  unnamed: string[];
  covered: string[];
  tinyText: string[];
};

// Runs inside the page: layout + accessibility checks.
export async function audit(page: Page): Promise<Audit> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = { overflowX: document.documentElement.scrollWidth - vw, small: [] as Audit["small"], unnamed: [] as string[], covered: [] as string[], tinyText: [] as string[] };
    const sel = "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]";
    const visible = (el: Element) => {
      if (el.tagName !== "SUMMARY" && el.closest("details:not([open])")) return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !(el as HTMLElement).hidden && cs.opacity !== "0";
    };
    const label = (el: Element) =>
      ((el as HTMLElement).innerText || (el as HTMLInputElement).placeholder || el.getAttribute("aria-label") || el.getAttribute("title") || (el as HTMLInputElement).name || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
    const els = [...document.querySelectorAll(sel)].filter(visible);
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const isTextLink = el.tagName === "A" && el.closest("p, li") && getComputedStyle(el).display === "inline";
      if (!isTextLink && (r.height < 44 || r.width < 44) && !(el as HTMLInputElement).type?.match(/checkbox|radio/)) {
        out.small.push({ tag: el.tagName.toLowerCase(), text: label(el), w: Math.round(r.width), h: Math.round(r.height) });
      }
      const name = (el as HTMLElement).innerText?.trim() || el.getAttribute("aria-label") || el.getAttribute("title") || (el as HTMLInputElement).placeholder || el.closest("label")?.textContent?.trim();
      if (!name && !(el as HTMLInputElement).type?.match(/file/)) out.unnamed.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 30)}`);
    }
    // tap targets hidden behind fixed UI (the bottom nav) once scrolled to the end
    window.scrollTo(0, document.body.scrollHeight);
    for (const el of els.slice(-12)) {
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const top = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, innerHeight - 1));
      if (top && top !== el && !el.contains(top) && !top.contains(el)) out.covered.push(`${label(el)} (covered by ${top.tagName.toLowerCase()}.${(top.className || "").toString().slice(0, 25)})`);
    }
    window.scrollTo(0, 0);
    for (const el of document.querySelectorAll("p, span, li, label, h1, h2, h3, button, a")) {
      if (!visible(el) || el.closest("[role=img]") || !(el as HTMLElement).innerText?.trim() || el.children.length > 0) continue;
      if (parseFloat(getComputedStyle(el).fontSize) < 11) out.tinyText.push(label(el));
    }
    return out;
  });
}

export async function timings(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ ttfb: number; dcl: number; load: number; lcp: number | null }>((resolve) => {
        const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        const base = { ttfb: Math.round(n.responseStart), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) };
        try {
          let lcp: number | null = null;
          new PerformanceObserver((l) => { const e = l.getEntries(); lcp = Math.round(e[e.length - 1].startTime); }).observe({ type: "largest-contentful-paint", buffered: true });
          setTimeout(() => resolve({ ...base, lcp }), 300);
        } catch {
          resolve({ ...base, lcp: null });
        }
      }),
  );
}
