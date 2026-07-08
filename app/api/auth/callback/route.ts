import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return new Response("No code provided", { status: 400 });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: "https://personal-os-gamma-ten.vercel.app/api/auth/callback",
      grant_type: "authorization_code",
    }),
  });

  const json = await res.json();

  if (json.refresh_token) {
    return new Response(
      `<h1>Success!</h1>
       <p>Copy this refresh token and add it as <code>GOOGLE_REFRESH_TOKEN</code> in your .env and Vercel:</p>
       <pre style="background:#111;color:#0f0;padding:16px;word-break:break-all">${json.refresh_token}</pre>
       <p>Access token (temporary): <code>${json.access_token}</code></p>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  return new Response(
    `<h1>Error</h1><pre>${JSON.stringify(json, null, 2)}</pre>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
