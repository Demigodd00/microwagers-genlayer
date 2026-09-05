import { ImageResponse } from "next/og";

export const alt = "MicroWagers by demigodd00 — source-bound predictions on GenLayer StudioNet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0b0912", color: "#f6f2ff", padding: "76px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 34 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 18, background: "#a879ff", color: "#0b0912", fontWeight: 800 }}>M</div>
        <div style={{ display: "flex" }}>MicroWagers <span style={{ color: "#948da2", marginLeft: 12 }}>by demigodd00</span></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
        <div style={{ color: "#55e6d1", fontSize: 24, letterSpacing: 5, textTransform: "uppercase" }}>GenLayer StudioNet</div>
        <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -4, fontWeight: 750, marginTop: 24 }}>Make a call. Name the source.</div>
        <div style={{ color: "#aaa3b7", fontSize: 28, marginTop: 28 }}>Independent validators resolve each test prediction.</div>
      </div>
    </div>,
    size,
  );
}
