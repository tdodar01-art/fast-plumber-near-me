import { ImageResponse } from "next/og";

/**
 * PWA/app icon renderer — serves the /icon-192.png and /icon-512.png paths the
 * manifest has always referenced (they 404'd before; spec checklist E ships
 * them). Rebuild palette: ink navy tile + white droplet. No badge/check marks
 * (nothing that reads as a "verified" seal — hard rule 1 adjacent).
 */
export function appIconResponse(size: number) {
  const radius = Math.round(size * 0.1875);
  const glyph = Math.round(size * 0.72);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#17293e",
          borderRadius: radius,
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 512 512">
          <path
            d="M256 96 C 300 172 332 210 332 250 a 76 76 0 1 1 -152 0 C 180 210 212 172 256 96 Z"
            fill="#ffffff"
          />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
