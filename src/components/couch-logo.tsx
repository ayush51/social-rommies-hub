// The Couch logo mark. Keep in sync with the app icon (src/app/icons/[size]/route.tsx).
export function CouchMark({ size = 72, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="The Couch" className={className}>
      <rect width="512" height="512" rx="112" fill="#7c3aed" />
      <g transform="translate(0 -20)">
        <rect x="128" y="150" width="256" height="130" rx="44" fill="#fff" />
        <rect x="84" y="214" width="76" height="150" rx="34" fill="#fff" stroke="#7c3aed" strokeWidth="10" />
        <rect x="352" y="214" width="76" height="150" rx="34" fill="#fff" stroke="#7c3aed" strokeWidth="10" />
        <rect x="140" y="270" width="232" height="84" rx="30" fill="#fff" stroke="#7c3aed" strokeWidth="10" />
        <rect x="112" y="364" width="26" height="40" rx="8" fill="#fff" />
        <rect x="374" y="364" width="26" height="40" rx="8" fill="#fff" />
        <rect x="170" y="226" width="62" height="62" rx="18" fill="#fbbf24" transform="rotate(-12 201 257)" />
      </g>
    </svg>
  );
}
