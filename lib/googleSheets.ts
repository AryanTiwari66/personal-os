import { getAccessToken } from "@/lib/googleAuth";

async function appendRow(sheetName: string, values: string[]) {
  const accessToken = await getAccessToken();
  const sheetId = process.env.GOOGLE_SHEET_ID!;
  const range = encodeURIComponent(`${sheetName}!A:Z`);

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [values] }),
    }
  );

  const json = await res.json();
  console.log("Sheets response:", JSON.stringify(json));
  return json;
}

export async function logExpense(amount: string, description: string, category: string) {
  const date = new Date().toISOString().split("T")[0];
  return appendRow("Expenses", [date, amount, description, category]);
}

export async function logRun(distance: string, duration: string) {
  const date = new Date().toISOString().split("T")[0];
  return appendRow("Runs", [date, distance, duration]);
}

export async function quickCapture(note: string) {
  const date = new Date().toISOString().split("T")[0];
  const time = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
  return appendRow("Notes", [date, time, note]);
}
