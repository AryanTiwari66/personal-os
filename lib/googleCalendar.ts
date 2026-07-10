import { getAccessToken } from "@/lib/googleAuth";

export async function createCalendarEvent(
  title: string,
  date: string,
  time?: string
) {
  const accessToken = await getAccessToken();

  let start: { dateTime?: string; date?: string; timeZone?: string };
  let end: { dateTime?: string; date?: string; timeZone?: string };

  if (time) {
    const dateTime = `${date}T${time}:00`;
    const [h, m] = time.split(":").map(Number);
    const endH = h + 1;
    const endTime = `${date}T${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    start = { dateTime, timeZone: "Asia/Kolkata" };
    end = { dateTime: endTime, timeZone: "Asia/Kolkata" };
  } else {
    start = { date };
    end = { date };
  }

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ summary: title, start, end }),
    }
  );

  const json = await res.json();
  console.log("Calendar response:", JSON.stringify(json));
  return json;
}
