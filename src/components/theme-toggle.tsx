"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";
const OPTIONS: { value: Mode; label: string }[] = [{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }];

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    let saved: Mode = "system";
    try { saved = (localStorage.getItem("theme") as Mode) || "system"; } catch { /* storage blocked */ }
    const t = setTimeout(() => setMode(saved), 0);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => { if ((localStorage.getItem("theme") ?? "system") === "system") apply("system"); };
    mq.addEventListener("change", onSystem);
    return () => { clearTimeout(t); mq.removeEventListener("change", onSystem); };
  }, []);

  const choose = (m: Mode) => {
    setMode(m);
    try { localStorage.setItem("theme", m); } catch { /* storage blocked */ }
    apply(m);
  };

  return (
    <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-2">
      {OPTIONS.map((o) => (
        <button key={o.value} role="radio" aria-checked={mode === o.value} onClick={() => choose(o.value)} className={`min-h-11 rounded-2xl text-sm font-semibold ${mode === o.value ? "bg-violet-600 text-white" : "bg-neutral-100 dark:bg-neutral-900"}`}>{o.label}</button>
      ))}
    </div>
  );
}
