import { ImageResponse } from "next/og";

import { loadGoogleFont } from "@/lib/og-fonts";
import { getSetupSeoData } from "@/lib/supabase/setups";
import { SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `Sim racing setup — ${SITE_NAME}`;

const conditionStyle: Record<string, { color: string; border: string }> = {
  Dry: { color: "#c4c9d0", border: "rgba(255,255,255,0.16)" },
  Wet: { color: "#38bdf8", border: "rgba(56,189,248,0.35)" },
  Mixed: { color: "#f0ad15", border: "rgba(240,173,21,0.35)" },
};

function chip(label: string, color: string, border: string) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: 22,
        fontFamily: "Inter",
        fontWeight: 500,
        color,
        border: `1px solid ${border}`,
        borderRadius: 999,
        padding: "7px 18px",
      }}
    >
      {label}
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [setup, inter600, inter500, inter400, jetbrainsMono600] = await Promise.all([
    getSetupSeoData(id),
    loadGoogleFont("Inter", 600),
    loadGoogleFont("Inter", 500),
    loadGoogleFont("Inter", 400),
    loadGoogleFont("JetBrains Mono", 600),
  ]);

  // Google Fonts can hiccup -- loadGoogleFont() returns null rather than
  // throwing, so a failed font is just dropped and satori falls back to
  // its default sans-serif for that role instead of failing the image.
  const fonts = [
    inter600 && { name: "Inter", data: inter600, weight: 600 as const, style: "normal" as const },
    inter500 && { name: "Inter", data: inter500, weight: 500 as const, style: "normal" as const },
    inter400 && { name: "Inter", data: inter400, weight: 400 as const, style: "normal" as const },
    jetbrainsMono600 && { name: "JetBrains Mono", data: jetbrainsMono600, weight: 600 as const, style: "normal" as const },
  ].filter((font): font is Exclude<typeof font, null> => font !== null);

  // satori has no built-in font when every custom font fails to load --
  // passing an empty `fonts` array throws ("No fonts are loaded"), so
  // the key has to be omitted entirely to fall back to its default.
  const imageOptions = fonts.length > 0 ? { ...size, fonts } : size;

  if (!setup) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#090a0c",
            fontFamily: "Inter",
            fontSize: 56,
            fontWeight: 600,
            color: "#81868f",
          }}
        >
          Setup not found — {SITE_NAME}
        </div>
      ),
      imageOptions
    );
  }

  const condition = conditionStyle[setup.condition] ?? conditionStyle.Dry;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          flexDirection: "column",
          padding: "56px 64px",
          backgroundColor: "#090a0c",
          backgroundImage:
            "radial-gradient(circle at 78% 15%, rgba(226,73,71,0.14), rgba(9,10,12,0) 55%)",
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

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg viewBox="0 0 24 24" width={30} height={30} fill="#e24947">
            <polygon points="17.5,5 17.5,10.5 3.4,19 3.4,13.7" fillOpacity={0.55} transform="translate(3.2,2.8)" />
            <polygon points="17.5,5 17.5,10.5 3.4,19 3.4,13.7" />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontFamily: "Inter",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            <span style={{ color: "#f0f2f4" }}>Setup</span>
            <span style={{ color: "#e24947" }}>Sheet</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 64 }}>
          <div style={{ display: "flex", fontSize: 24, fontFamily: "Inter", color: "#81868f" }}>
            {setup.game}
          </div>
          <div style={{ display: "flex", width: 4, height: 4, borderRadius: 999, backgroundColor: "#81868f" }} />
          {chip(setup.condition, condition.color, condition.border)}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              fontFamily: "Inter",
              fontWeight: 600,
              color: "#f0f2f4",
              letterSpacing: -0.5,
            }}
          >
            {setup.car}
          </div>
          <div style={{ display: "flex", fontSize: 40, fontFamily: "Inter", fontWeight: 600, color: "#81868f" }}>
            @ {setup.track}
          </div>
        </div>

        {setup.lapTime && (
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 14,
              marginTop: 40,
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: "18px 28px",
              alignSelf: "flex-start",
            }}
          >
            <div style={{ display: "flex", fontSize: 56, fontFamily: "JetBrains Mono", fontWeight: 600, color: "#00a4b3" }}>
              {setup.lapTime}
            </div>
            <div style={{ display: "flex", fontSize: 22, fontFamily: "Inter", color: "#81868f" }}>
              lap time
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {setup.tags.slice(0, 3).map((tag) => chip(tag, "#e24947", "rgba(226,73,71,0.35)"))}
          </div>
          <div style={{ display: "flex", fontSize: 26, fontFamily: "Inter", color: "#81868f" }}>
            shared by {setup.author}
          </div>
        </div>
      </div>
    ),
    imageOptions
  );
}
