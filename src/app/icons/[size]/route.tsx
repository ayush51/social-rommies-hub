import { ImageResponse } from "next/og";

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "512" ? 512 : size === "180" ? 180 : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#7c3aed", color: "white", fontSize: px * 0.55, fontWeight: 800 }}>
        AB
      </div>
    ),
    { width: px, height: px },
  );
}
