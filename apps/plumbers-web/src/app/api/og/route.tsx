import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const city = searchParams.get("city") || "Your City";
  const state = searchParams.get("state") || "";
  const county = searchParams.get("county") || "";
  const type = searchParams.get("type") || "city"; // "city" or "blog"
  const title = searchParams.get("title") || "";

  if (type === "blog") {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "60px 80px",
            background: "linear-gradient(135deg, #1a365d 0%, #0f2440 100%)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                fontSize: "24px",
                color: "#fc8181",
                fontWeight: 700,
              }}
            >
              Fast Plumber Near Me
            </div>
          </div>
          <div
            style={{
              fontSize: "48px",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.2,
              maxWidth: "900px",
            }}
          >
            {title || "Plumbing Emergency Guide"}
          </div>
          <div
            style={{
              fontSize: "20px",
              color: "#93c5fd",
              marginTop: "16px",
            }}
          >
            fastplumbernearme.com/blog
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #1a365d 0%, #0f2440 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              fontSize: "22px",
              color: "#fc8181",
              fontWeight: 700,
            }}
          >
            Fast Plumber Near Me
          </div>
        </div>
        <div
          style={{
            fontSize: "56px",
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.1,
            textAlign: "center",
            maxWidth: "900px",
          }}
        >
          Emergency Plumbers in {city}
          {state ? `, ${state}` : ""}
        </div>
        {county && (
          <div
            style={{
              fontSize: "22px",
              color: "#93c5fd",
              marginTop: "12px",
            }}
          >
            {county} County
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: "24px",
            marginTop: "32px",
            fontSize: "18px",
            color: "#bfdbfe",
          }}
        >
          <span>Verified 24/7</span>
          <span>·</span>
          <span>AI-Tested Response</span>
          <span>·</span>
          <span>Licensed &amp; Insured</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
