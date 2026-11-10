import { ImageResponse } from "next/og";

// App icon: a white couch with an amber pillow on violet. Sizes: 180 (iOS), 192/512 (Android/PWA), 'maskable' (512, extra margin).
export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const maskable = size === "maskable";
  const px = maskable || size === "512" ? 512 : size === "180" ? 180 : 192;
  const scale = maskable ? 0.78 : 1;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#7c3aed" }}>
        <svg width={px} height={px} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <g transform={`translate(256 256) scale(${scale}) translate(-256 -257)`}>
            <rect x="128" y="150" width="256" height="130" rx="44" fill="#ffffff" />
            <rect x="84" y="214" width="76" height="150" rx="34" fill="#ffffff" stroke="#7c3aed" strokeWidth="10" />
            <rect x="352" y="214" width="76" height="150" rx="34" fill="#ffffff" stroke="#7c3aed" strokeWidth="10" />
            <rect x="140" y="270" width="232" height="84" rx="30" fill="#ffffff" stroke="#7c3aed" strokeWidth="10" />
            <rect x="112" y="364" width="26" height="40" rx="8" fill="#ffffff" />
            <rect x="374" y="364" width="26" height="40" rx="8" fill="#ffffff" />
            <rect x="170" y="226" width="62" height="62" rx="18" fill="#fbbf24" transform="rotate(-12 201 257)" />
          </g>
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
