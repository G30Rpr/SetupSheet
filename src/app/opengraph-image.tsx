import { ImageResponse } from "next/og";

import { loadGoogleFont } from "@/lib/og-fonts";
import { SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — Free community sim racing setups`;

const FEATURED_GAMES = ["iRacing", "ACC", "Le Mans Ultimate", "F1 25"];

export default async function Image() {
  const [inter700, inter400, jetbrainsMono500] = await Promise.all([
    loadGoogleFont("Inter", 700),
    loadGoogleFont("Inter", 400),
    loadGoogleFont("JetBrains Mono", 500),
  ]);

  // Google Fonts can hiccup -- loadGoogleFont() returns null rather than
  // throwing, so a failed font is just dropped and satori falls back to
  // its default sans-serif for that role instead of failing the image.
  const fonts = [
    inter700 && { name: "Inter", data: inter700, weight: 700 as const, style: "normal" as const },
    inter400 && { name: "Inter", data: inter400, weight: 400 as const, style: "normal" as const },
    jetbrainsMono500 && { name: "JetBrains Mono", data: jetbrainsMono500, weight: 500 as const, style: "normal" as const },
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
            "radial-gradient(circle at 50% 35%, rgba(226,73,71,0.16), rgba(9,10,12,0) 60%)",
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
            backgroundColor: "#e24947",
            opacity: 0.7,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg viewBox="0 0 24 24" width={72} height={72} fill="#e24947">
            <polygon points="17.5,5 17.5,10.5 3.4,19 3.4,13.7" fillOpacity={0.55} transform="translate(3.2,2.8)" />
            <polygon points="17.5,5 17.5,10.5 3.4,19 3.4,13.7" />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 104,
              fontFamily: "Inter",
              fontWeight: 700,
              color: "#f0f2f4",
              textTransform: "uppercase",
              letterSpacing: -1,
            }}
          >
            <span>Setup</span>
            <span style={{ color: "#e24947" }}>Sheet</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 22,
            fontSize: 34,
            fontFamily: "Inter",
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
                fontFamily: "JetBrains Mono",
                fontWeight: 500,
                color: "#e24947",
                border: "1px solid rgba(226,73,71,0.35)",
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
