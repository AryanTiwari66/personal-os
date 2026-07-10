import twilio from "twilio";
import { db } from "@/lib/db";
import { getAccessToken } from "@/lib/googleAuth";
import type { Contact } from "@/app/generated/prisma/client";

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

async function getTodaysEvents(): Promise<string[]> {
  try {
    const accessToken = await getAccessToken();
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startOfDay}&timeMax=${endOfDay}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const json = await res.json();
    if (!json.items) return [];

    return json.items.map((e: { summary?: string; start?: { dateTime?: string; date?: string } }) => {
      const time = e.start?.dateTime
        ? new Date(e.start.dateTime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })
        : "All day";
      return `- ${time}: ${e.summary || "No title"}`;
    });
  } catch {
    return ["(Could not fetch calendar)"];
  }
}

export async function GET() {
  const due = await db.contact.findMany({
    where: { followUpDate: { lte: new Date() }, status: "open" },
  });

  const followUps = due.map((c: Contact) =>
    `- ${c.name}${c.company ? " (" + c.company + ")" : ""}`
  ).join("\n") || "None today!";

  const events = await getTodaysEvents();
  const calendarSection = events.length > 0 ? events.join("\n") : "No events today.";

  const today = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "short" });

  const message = `☀️ Good morning, Aryan!\n\n📅 *${today}*\n\n*Calendar:*\n${calendarSection}\n\n*Follow-ups due:*\n${followUps}`;

  await client.messages.create({
    from: "whatsapp:" + process.env.TWILIO_WHATSAPP_NUMBER,
    to: "whatsapp:" + process.env.MY_PHONE_NUMBER,
    body: message,
  });

  return new Response("ok");
}
