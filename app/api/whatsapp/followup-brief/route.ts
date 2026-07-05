import twilio from "twilio";
   import { db } from "@/lib/db";
import type { Contact } from "@prisma/client"

   const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

   export async function POST() {
     const due = await db.contact.findMany({
       where: { followUpDate: { lte: new Date() }, status: "open" },
     });

     const list = due.map((c: Contact) => `- ${c.name}${c.company ? " (" + c.company + ")" : ""}`).join("\n") || "None today!";

     await client.messages.create({
       from: "whatsapp:" + process.env.TWILIO_WHATSAPP_NUMBER,
       to: "whatsapp:" + process.env.MY_PHONE_NUMBER,
       body: `Follow-ups due today:\n${list}`,
     });

     return new Response("ok");
   }