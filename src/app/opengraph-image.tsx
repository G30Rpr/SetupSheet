import { ImageResponse } from "next/og";

import { loadGoogleFont } from "@/lib/og-fonts";
import { SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — Free community sim racing setups`;

const FEATURED_GAMES = ["iRacing", "ACC", "Le Mans Ultimate", "F1 25"];

export default async function Image() {
  const [oswald700, plexSans400, plexMono500] = await Promise.all([
    loadGoogleFont("Oswald", 700),
    loadGoogleFont("IBM Plex Sans", 400),
    loadGoogleFont("IBM Plex Mono", 500),
  ]);

  // Google Fonts can hiccup -- loadGoogleFont() returns null rather than
  // throwing, so a failed font is just dropped and satori falls back to
  // its default sans-serif for that role instead of failing the image.
  const fonts = [
    oswald700 && { name: "Oswald", data: oswald700, weight: 700 as const, style: "normal" as const },
    plexSans400 && { name: "IBM Plex Sans", data: plexSans400, weight: 400 as const, style: "normal" as const },
    plexMono500 && { name: "IBM Plex Mono", data: plexMono500, weight: 500 as const, style: "normal" as const },
  ].filter((font): font is Exclude<typeof font, null> => font !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#090a0c",
          backgroundImage:
            "radial-gradient(circle at 50% 35%, rgba(42,196,92,0.16), rgba(9,10,12,0) 60%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            display: "flex",
            backgroundColor: "#2ac45c",
            opacity: 0.7,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg viewBox="0 0 24 24" width={72} height={72} fill="none" stroke="#2ac45c" strokeWidth={2}>
            <path d="M9 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" />
            <rect x={9} y={2} width={6} height={3} rx={1} />
            <line x1={7} y1={10.5} x2={17} y2={10.5} strokeWidth={1.4} />
            <circle cx={10} cy={10.5} r={1.4} fill="#2ac45c" stroke="none" />
            <line x1={7} y1={14.5} x2={17} y2={14.5} strokeWidth={1.4} />
            <circle cx={14.5} cy={14.5} r={1.4} fill="#2ac45c" stroke="none" />
            <line x1={7} y1={18.2} x2={17} y2={18.2} strokeWidth={1.4} />
            <circle cx={12} cy={18.2} r={1.4} fill="#2ac45c" stroke="none" />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 104,
              fontFamily: "Oswald",
              fontWeight: 700,
              color: "#f0f2f4",
              textTransform: "uppercase",
              letterSpacing: -1,
            }}
          >
            <span>Setup</span>
            <span style={{ color: "#2ac45c" }}>Sheet</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 22,
            fontSize: 34,
            fontFamily: "IBM Plex Sans",
            color: "#81868f",
          }}
        >
          Free community sim racing setups
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 40 }}>
          {FEATURED_GAMES.map((game) => (
            <div
              key={game}
              style={{
                display: "flex",
                fontSize: 22,
                fontFamily: "IBM Plex Mono",
                fontWeight: 500,
                color: "#2ac45c",
                border: "1px solid rgba(42,196,92,0.35)",
                borderRadius: 999,
                padding: "8px 20px",
              }}
            >
              {game}
            </div>
          ))}
        </div>
      </div>
    ),
    // satori has no built-in font when every custom font fails to load --
    // passing an empty `fonts` array throws ("No fonts are loaded"), so
    // the key has to be omitted entirely to fall back to its default.
    fonts.length > 0 ? { ...size, fonts } : size
  );
}
