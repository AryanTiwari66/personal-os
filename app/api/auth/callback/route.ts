import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=https://www.googleapis.com/auth/calendar.events&access_type=offline&prompt=consent`;
    return new Response(
      `<h1>Google Calendar Setup</h1>
       <p>1. <a href="${authUrl}" target="_blank">Click here to authorize</a></p>
       <p>2. Copy the authorization code Google gives you</p>
       <p>3. Come back and visit:<br><code>/api/auth/callback?code=PASTE_CODE_HERE</code></p>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
      grant_type: "authorization_code",
    }),
  });

  const json = await res.json();

  if (json.refresh_token) {
    return new Response(
      `<h1>Success!</h1>
       <p>Copy this refresh token and add it as <code>GOOGLE_REFRESH_TOKEN</code> in your .env and Vercel:</p>
       <pre style="background:#111;color:#0f0;padding:16px;word-break:break-all">${json.refresh_token}</pre>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  return new Response(
    `<h1>Error</h1><pre>${JSON.stringify(json, null, 2)}</pre>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
