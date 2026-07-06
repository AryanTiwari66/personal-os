import twilio from "twilio";
   import Anthropic from "@anthropic-ai/sdk";
   import { db } from "@/lib/db";

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
         Format: {"intent": "save_contact" or "unknown", "data": {"name":"", "company":"", "phone":"", "notes":"", "followUpDate":""}}
         Message: "${body}"`,
       }],
     });

     const textBlock = msg.content[0];
     let parsed = { intent: "unknown", data: {} };
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
           followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null,
         },
       });
       replyText = `Saved contact: ${parsed.data.name || "Unknown"}${parsed.data.company ? " (" + parsed.data.company + ")" : ""}`;
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