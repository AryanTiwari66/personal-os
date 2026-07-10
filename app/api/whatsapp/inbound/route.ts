import twilio from "twilio";
   import Anthropic from "@anthropic-ai/sdk";
   import { db } from "@/lib/db";
   import { createAsanaTask } from "@/lib/asana";
   import { createCalendarEvent } from "@/lib/googleCalendar";
   import { logExpense, logRun, quickCapture } from "@/lib/googleSheets";

   const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
   const anthropic = new Anthropic();

   export async function POST(req: Request) {
     const formData = await req.formData();
     const body = formData.get("Body") as string;
     const from = formData.get("From") as string;

     const msg = await anthropic.messages.create({
       model: "claude-haiku-4-5-20251001",
       max_tokens: 300,
       messages: [{
         role: "user",
         content: `Extract JSON only, no other text, from this WhatsApp message.
         Today's date is ${new Date().toISOString().split("T")[0]}.
         Format: {"intent": "save_contact" | "create_task" | "schedule_event" | "log_expense" | "log_run" | "quick_capture" | "chat" | "unknown", "data": {"name":"", "company":"", "phone":"", "notes":"", "followUpDate":"YYYY-MM-DD or empty string", "title":"", "date":"YYYY-MM-DD", "time":"HH:MM in 24h format or empty string", "amount":"", "description":"", "category":"", "distance":"", "duration":"", "note":""}}
         For create_task, put the task description in "title".
         For schedule_event, put the event name in "title", the date in "date", and time in "time" (24h format like "14:30"). If no time mentioned, leave "time" empty.
         For log_expense, extract "amount" (number only), "description", and "category" (food/transport/shopping/bills/other).
         For log_run, extract "distance" (e.g. "5km") and "duration" (e.g. "30min").
         For quick_capture, put the note text in "note".
         Use "chat" for questions, requests for analysis, advice, or general conversation that don't fit other intents.
         Convert relative dates like "in 1 week", "tomorrow", "next Monday" into actual YYYY-MM-DD dates based on today.
         Message: "${body}"`,
       }],
     });

     const textBlock = msg.content[0];
     let parsed: { intent: string; data: { name?: string; company?: string; phone?: string; notes?: string; followUpDate?: string; title?: string; date?: string; time?: string; amount?: string; description?: string; category?: string; distance?: string; duration?: string; note?: string } } = { intent: "unknown", data: {} };
     if (textBlock.type === "text") {
       const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
       try {
         parsed = JSON.parse(cleaned);
       } catch (e) {
         console.log("Failed to parse:", textBlock.text);
       }
     }
     console.log("Parsed:", parsed);

     let replyText = "Sorry, I didn't understand that.";

     if (parsed.intent === "save_contact") {
       await db.contact.create({
         data: {
           name: parsed.data.name || "Unknown",
           company: parsed.data.company || null,
           phone: parsed.data.phone || null,
           notes: parsed.data.notes || null,
           followUpDate: parsed.data.followUpDate && !isNaN(Date.parse(parsed.data.followUpDate)) ? new Date(parsed.data.followUpDate) : null,
         },
       });
       replyText = `Saved contact: ${parsed.data.name || "Unknown"}${parsed.data.company ? " (" + parsed.data.company + ")" : ""}`;
     }

     if (parsed.intent === "create_task") {
       const taskTitle = parsed.data.title || "Untitled task";
       const asanaTask = await createAsanaTask(taskTitle);
       if (asanaTask) {
         await db.task.create({
           data: { title: taskTitle, asanaTaskId: asanaTask.gid },
         });
         replyText = `Created Asana task: ${taskTitle}`;
       } else {
         await db.task.create({ data: { title: taskTitle } });
         replyText = `Saved task locally but Asana sync failed: ${taskTitle}`;
       }
     }

     if (parsed.intent === "schedule_event") {
       const eventTitle = parsed.data.title || "Untitled event";
       const eventDate = parsed.data.date;
       if (eventDate && !isNaN(Date.parse(eventDate))) {
         const event = await createCalendarEvent(eventTitle, eventDate, parsed.data.time || undefined);
         if (event.id) {
           replyText = `Scheduled: ${eventTitle} on ${eventDate}${parsed.data.time ? " at " + parsed.data.time : ""}`;
         } else {
           replyText = `Failed to create calendar event. Check Google Calendar setup.`;
         }
       } else {
         replyText = `Couldn't parse the date for the event.`;
       }
     }

     if (parsed.intent === "log_expense") {
       const result = await logExpense(
         parsed.data.amount || "0",
         parsed.data.description || "No description",
         parsed.data.category || "other"
       );
       replyText = result.updates
         ? `Logged expense: ₹${parsed.data.amount} — ${parsed.data.description}`
         : `Failed to log expense. Check Sheets setup.`;
     }

     if (parsed.intent === "log_run") {
       const result = await logRun(
         parsed.data.distance || "unknown",
         parsed.data.duration || "unknown"
       );
       replyText = result.updates
         ? `Logged run: ${parsed.data.distance}, ${parsed.data.duration}`
         : `Failed to log run. Check Sheets setup.`;
     }

     if (parsed.intent === "quick_capture") {
       const result = await quickCapture(parsed.data.note || body);
       replyText = result.updates
         ? `Noted: ${parsed.data.note || body}`
         : `Failed to save note. Check Sheets setup.`;
     }

     if (parsed.intent === "chat" || parsed.intent === "unknown") {
       const chatMsg = await anthropic.messages.create({
         model: "claude-haiku-4-5-20251001",
         max_tokens: 500,
         system: `You are a helpful personal assistant replying via WhatsApp. Keep responses concise (under 300 chars). Today is ${new Date().toISOString().split("T")[0]}. The user's name is Aryan.`,
         messages: [{ role: "user", content: body }],
       });
       const chatBlock = chatMsg.content[0];
       if (chatBlock.type === "text") {
         replyText = chatBlock.text;
       }
     }

     await client.messages.create({
       from: "whatsapp:" + process.env.TWILIO_WHATSAPP_NUMBER,
       to: from,
       body: replyText,
     });

     return new Response("<Response></Response>", {
       headers: { "Content-Type": "text/xml" },
     });
   }