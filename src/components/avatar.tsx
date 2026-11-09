export function Avatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  const box = { width: size, height: size };
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" style={box} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span style={{ ...box, fontSize: size * 0.4 }} className="flex shrink-0 items-center justify-center rounded-full bg-violet-200 font-semibold text-violet-800 dark:bg-violet-900 dark:text-violet-100">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
