// app/api/whatsapp/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "bodylab_verify_token";
const WHATSAPP_TOKEN =
  process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

type LeadStep =
  | "first_name"
  | "surname"
  | "service"
  | "notes"
  | "completed";

function cleanText(value: any) {
  return String(value || "").trim();
}

function normalisePhone(phone: string) {
  return cleanText(phone).replace(/\D/g, "");
}

async function sendWhatsAppMessage(phone: string, message: string) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error("Missing WhatsApp env vars", {
      hasToken: !!WHATSAPP_TOKEN,
      hasPhoneNumberId: !!PHONE_NUMBER_ID,
    });
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: {
          preview_url: false,
          body: message,
        },
      }),
    }
  );

  const result = await response.json().catch(() => null);

  console.log("META RESPONSE:", result);

  if (!response.ok) {
    console.error("META SEND ERROR:", result);
  }

  return result;
}

async function saveIncomingMessage(phone: string, message: string) {
  const { error } = await supabase.from("whatsapp_messages").insert({
    phone,
    direction: "inbound",
    message,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("WHATSAPP MESSAGE SAVE ERROR:", error);
  }
}

async function saveOutboundMessage(phone: string, message: string) {
  const { error } = await supabase.from("whatsapp_messages").insert({
    phone,
    direction: "outbound",
    message,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("OUTBOUND MESSAGE SAVE ERROR:", error);
  }
}

async function reply(phone: string, message: string) {
  await sendWhatsAppMessage(phone, message);
  await saveOutboundMessage(phone, message);
}

async function getSession(phone: string) {
  const { data, error } = await supabase
    .from("whatsapp_lead_sessions")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    console.error("GET SESSION ERROR:", error);
  }

  return data;
}

async function upsertSession(phone: string, updates: any) {
  const { data: existing } = await supabase
    .from("whatsapp_lead_sessions")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  const payload = {
    phone,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  let result;

  if (existing) {
    result = await supabase
      .from("whatsapp_lead_sessions")
      .update(payload)
      .eq("phone", phone)
      .select()
      .single();
  } else {
    result = await supabase
      .from("whatsapp_lead_sessions")
      .insert({
        ...payload,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
  }

  if (result.error) {
    console.error("UPSERT SESSION ERROR:", result.error);
  }

  return result.data;
}

async function upsertLead(phone: string, updates: any) {
  const { data: existing } = await supabase
    .from("leads")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  const payload = {
    phone,
    ...updates,
    last_message_at: new Date().toISOString(),
  };

  let result;

  if (existing) {
    result = await supabase
      .from("leads")
      .update(payload)
      .eq("phone", phone)
      .select()
      .single();
  } else {
    result = await supabase
      .from("leads")
      .insert({
        ...payload,
        source: "WhatsApp",
        status: updates.status || "WhatsApp lead",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
  }

  if (result.error) {
    console.error("UPSERT LEAD ERROR:", result.error);
  }

  return result.data;
}

function serviceText(input: string) {
  const value = cleanText(input).toLowerCase();

  if (value === "1" || value.includes("gp")) {
    return "GP Weight Loss Consultation";
  }

  if (
    value === "2" ||
    value.includes("glp") ||
    value.includes("treatment")
  ) {
    return "GLP-treatment programme";
  }

  return "";
}

function startMessage() {
  return `👋 Welcome to BodyLab.

Let's complete your lead form via WhatsApp.

Question 1 of 5:
What is your first name?`;
}

function surnameMessage() {
  return `Thank you.

Question 2 of 5:
What is your surname?`;
}

function serviceMessage() {
  return `Thank you.

Question 3 of 5:
Which service are you interested in?

1. GP Weight Loss Consultation
2. GLP-treatment programme

Reply with 1 or 2.`;
}

function notesMessage() {
  return `Thank you.

Question 4 of 5:
Please briefly tell us how we can help you.`;
}

function finalMessage() {
  return `✅ Thank you.

Your lead form has been completed successfully.

A BodyLab consultant will contact you shortly.`;
}

// Meta webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// WhatsApp incoming webhook
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("WHATSAPP WEBHOOK RECEIVED:", JSON.stringify(body));

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const messageObj = value?.messages?.[0];

    if (!messageObj) {
      return NextResponse.json({ success: true, message: "No message" });
    }

    const phone = normalisePhone(messageObj.from);
    const incomingText = cleanText(messageObj?.text?.body);

    if (!phone || !incomingText) {
      return NextResponse.json({ success: true, message: "No text message" });
    }

    await saveIncomingMessage(phone, incomingText);

    let session = await getSession(phone);

    const restartWords = ["hi", "hello", "start", "restart", "reset"];
    const wantsRestart = restartWords.includes(incomingText.toLowerCase());

    if (!session || wantsRestart || session.step === "completed") {
      await upsertSession(phone, {
        step: "first_name",
        first_name: null,
        surname: null,
        service_interest: null,
        notes: null,
      });

      await upsertLead(phone, {
        status: "Awaiting first name",
        last_message: incomingText,
      });

      await reply(phone, startMessage());

      return NextResponse.json({ success: true });
    }

    const step = session.step as LeadStep;

    if (step === "first_name") {
      const firstName = incomingText;

      await upsertSession(phone, {
        step: "surname",
        first_name: firstName,
      });

      await upsertLead(phone, {
        first_name: firstName,
        full_name: firstName,
        status: "Awaiting surname",
        last_message: incomingText,
      });

      await reply(phone, surnameMessage());

      return NextResponse.json({ success: true });
    }

    if (step === "surname") {
      const surname = incomingText;
      const firstName = session.first_name || "";
      const fullName = `${firstName} ${surname}`.trim();

      await upsertSession(phone, {
        step: "service",
        surname,
      });

      await upsertLead(phone, {
        first_name: firstName,
        surname,
        full_name: fullName,
        status: "Awaiting service",
        last_message: incomingText,
      });

      await reply(phone, serviceMessage());

      return NextResponse.json({ success: true });
    }

    if (step === "service") {
      const selectedService = serviceText(incomingText);

      if (!selectedService) {
        await reply(
          phone,
          `Please reply with one option:

1. GP Weight Loss Consultation
2. GLP-treatment programme`
        );

        return NextResponse.json({ success: true });
      }

      await upsertSession(phone, {
        step: "notes",
        service_interest: selectedService,
      });

      await upsertLead(phone, {
        service_interest: selectedService,
        status: "Awaiting notes",
        last_message: incomingText,
      });

      await reply(phone, notesMessage());

      return NextResponse.json({ success: true });
    }

    if (step === "notes") {
      const notes = incomingText;

      await upsertSession(phone, {
        step: "completed",
        notes,
      });

      const firstName = session.first_name || "";
      const surname = session.surname || "";
      const fullName = `${firstName} ${surname}`.trim();

      await upsertLead(phone, {
        first_name: firstName,
        surname,
        full_name: fullName,
        service_interest: session.service_interest,
        notes,
        status: "Completed",
        last_message: incomingText,
      });

      await reply(phone, finalMessage());

      return NextResponse.json({ success: true });
    }

    await reply(phone, startMessage());

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WHATSAPP WEBHOOK ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Webhook failed" },
      { status: 500 }
    );
  }
}
