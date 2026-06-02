import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendWhatsAppMessage(phone: string, message: string) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v25.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: {
            preview_url: false,
            body: message,
          },
        }),
      }
    );

    const result = await response.json();
    console.log("META STATUS:", response.status);
    console.log("META RESPONSE:", result);

    return result;
  } catch (error) {
    console.error("SEND WHATSAPP ERROR:", error);
  }
}

function isStartMessage(text: string) {
  const t = text.toLowerCase().trim();

  return (
    t === "hi" ||
    t === "hello" ||
    t === "help" ||
    t === "register" ||
    t.includes("want to register") ||
    t.includes("i want to register")
  );
}

function getService(text: string) {
  const t = text.toLowerCase().trim();

  if (t === "1" || t.includes("weight")) return "GP Weight Loss Consultation";
  if (t === "2" || t.includes("medical cannabis")) return "Medical Cannabis";
  if (t === "3" || t.includes("longevity")) return "Longevity Assessment";
  if (t === "4" || t.includes("general")) return "General Enquiry";

  return "";
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge || "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("WHATSAPP WEBHOOK RECEIVED");

    await supabase.from("webhook_events").insert({
      source: "whatsapp",
      event_type: "message",
      raw_payload: body,
    });

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    if (!message) {
      return NextResponse.json({ success: true });
    }

    const phone = message?.from || "";
    const incomingText = message?.text?.body?.trim() || "";
    const profileName = contact?.profile?.name || "";

    let { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lead) {
      const { data: newLead, error } = await supabase
        .from("leads")
        .insert({
          first_name: profileName || "WhatsApp",
          surname: "Lead",
          full_name: null,
          phone,
          email: null,
          service_interest: null,
          source: "WhatsApp",
          status: "Awaiting Full Name",
          notes: incomingText || null,
        })
        .select()
        .single();

      if (error) console.error("LEAD CREATE ERROR:", error);

      lead = newLead;
    }

    await supabase.from("whatsapp_messages").insert({
      lead_id: lead?.id || null,
      phone,
      direction: "inbound",
      message_text: incomingText,
    });

    if (isStartMessage(incomingText)) {
      await supabase
        .from("leads")
        .update({
          status: "Awaiting Full Name",
          service_interest: null,
          notes: null,
        })
        .eq("id", lead.id);

      await sendWhatsAppMessage(
        phone,
        `👋 Welcome to BodyLab.

Let's complete your lead form via WhatsApp.

Question 1 of 4:
What is your full name?`
      );

      return NextResponse.json({ success: true });
    }

    if (lead.status === "Awaiting Full Name") {
      const parts = incomingText.split(" ");
      const firstName = parts[0] || incomingText;
      const surname = parts.slice(1).join(" ") || "Lead";

      await supabase
        .from("leads")
        .update({
          first_name: firstName,
          surname,
          full_name: incomingText,
          status: "Awaiting Email",
        })
        .eq("id", lead.id);

      await sendWhatsAppMessage(
        phone,
        `Thank you, ${firstName}.

Question 2 of 4:
Please provide your email address.`
      );

      return NextResponse.json({ success: true });
    }

    if (lead.status === "Awaiting Email") {
      await supabase
        .from("leads")
        .update({
          email: incomingText,
          status: "Awaiting Service Interest",
        })
        .eq("id", lead.id);

      await sendWhatsAppMessage(
        phone,
        `Question 3 of 4:
Which service are you interested in?

1. GP Weight Loss Consultation
2. Medical Cannabis
3. Longevity Assessment
4. General Enquiry

Reply with 1, 2, 3 or 4.`
      );

      return NextResponse.json({ success: true });
    }

    if (lead.status === "Awaiting Service Interest") {
      const service = getService(incomingText);

      if (!service) {
        await sendWhatsAppMessage(
          phone,
          `Please reply with one option:

1. GP Weight Loss Consultation
2. Medical Cannabis
3. Longevity Assessment
4. General Enquiry`
        );

        return NextResponse.json({ success: true });
      }

      await supabase
        .from("leads")
        .update({
          service_interest: service,
          status: "Awaiting Notes",
        })
        .eq("id", lead.id);

      await sendWhatsAppMessage(
        phone,
        `Thank you.

Question 4 of 4:
Please briefly tell us how we can help you.`
      );

      return NextResponse.json({ success: true });
    }

    if (lead.status === "Awaiting Notes") {
      await supabase
        .from("leads")
        .update({
          notes: incomingText,
          status: "Qualified Lead",
          last_message: incomingText,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", lead.id);

      await sendWhatsAppMessage(
        phone,
        `✅ Thank you.

Your lead form has been completed successfully.

A BodyLab consultant will contact you shortly.`
      );

      return NextResponse.json({ success: true });
    }

    await sendWhatsAppMessage(
      phone,
      `Thank you for your message.

To start a new enquiry, please type:

Register`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WEBHOOK ERROR:", error);

    return NextResponse.json({
      success: true,
      warning: String(error),
    });
  }
}
