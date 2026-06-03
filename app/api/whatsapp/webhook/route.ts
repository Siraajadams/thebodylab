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
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

type LeadStep =
  | "first_name"
  | "surname"
  | "email"
  | "service"
  | "notes"
  | "completed";

function cleanText(value: any) {
  return String(value || "").trim();
}

function normalisePhone(phone: string) {
  return cleanText(phone).replace(/\D/g, "");
}

function isStartCommand(text: string) {
  const value = cleanText(text).toLowerCase();
  return ["hi", "hello", "start", "good day", "goodday"].includes(value);
}

function isResetCommand(text: string) {
  const value = cleanText(text).toLowerCase();
  return ["reset", "restart"].includes(value);
}

async function saveWebhookEvent(body: any) {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const field = body?.entry?.[0]?.changes?.[0]?.field;

  const { error } = await supabase.from("webhook_events").insert({
    source: "whatsapp",
    event_type: field || "message",
    raw_payload: body,
    processed: false,
    created_at: new Date().toISOString(),
  });

  if (error) console.error("WEBHOOK EVENT SAVE ERROR:", error);

  if (field === "leadgen" || value?.leadgen_id || value?.form_id) {
    const { error: metaError } = await supabase.from("meta_lead_events").insert({
      meta_lead_id: value?.leadgen_id || value?.id || null,
      page_id: value?.page_id || null,
      form_id: value?.form_id || null,
      raw_payload: body,
      created_at: new Date().toISOString(),
    });

    if (metaError) console.error("META LEAD EVENT SAVE ERROR:", metaError);
  }
}

async function sendWhatsAppMessage(phone: string, message: string) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error("WHATSAPP TOKEN OR PHONE_NUMBER_ID MISSING");
    return null;
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

async function saveMessage(
  phone: string,
  messageText: string,
  direction: string,
  leadId?: string | null
) {
  const { error } = await supabase.from("whatsapp_messages").insert({
    phone,
    lead_id: leadId || null,
    message_text: messageText,
    direction,
    raw_payload: null,
    created_at: new Date().toISOString(),
  });

  if (error) console.error("WHATSAPP MESSAGE SAVE ERROR:", error);
}

async function reply(phone: string, message: string, leadId?: string | null) {
  await sendWhatsAppMessage(phone, message);
  await saveMessage(phone, message, "outbound", leadId);
}

async function getSession(phone: string) {
  const cleanedPhone = normalisePhone(phone);

  const { data, error } = await supabase
    .from("whatsapp_lead_sessions")
    .select("*")
    .eq("phone", cleanedPhone)
    .maybeSingle();

  if (error) console.error("GET SESSION ERROR:", error);

  return data;
}

async function upsertSession(phone: string, updates: any) {
  const cleanedPhone = normalisePhone(phone);
  const existing = await getSession(cleanedPhone);

  const payload = {
    phone: cleanedPhone,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const result = existing
    ? await supabase
        .from("whatsapp_lead_sessions")
        .update(payload)
        .eq("phone", cleanedPhone)
        .select()
        .single()
    : await supabase
        .from("whatsapp_lead_sessions")
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

  if (result.error) console.error("UPSERT SESSION ERROR:", result.error);

  return result.data;
}

async function createNewLead(phone: string, incomingText: string) {
  const cleanedPhone = normalisePhone(phone);
  const leadReference =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  const { data, error } = await supabase
    .from("leads")
    .insert({
      phone: cleanedPhone,
      whatsapp_id: cleanedPhone,
      lead_reference: leadReference,
      source: "WhatsApp",
      status: "In Progress",
      priority: "Normal",
      last_message: incomingText,
      last_message_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("CREATE NEW LEAD ERROR:", error);
    return null;
  }

  return data;
}

async function updateLeadById(leadId: string | null, updates: any) {
  if (!leadId) {
    console.error("NO LEAD ID PROVIDED FOR UPDATE");
    return null;
  }

  const { data, error } = await supabase
    .from("leads")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .select()
    .single();

  if (error) console.error("UPDATE LEAD BY ID ERROR:", error);

  return data;
}

function getService(input: string) {
  const value = cleanText(input).toLowerCase();

  if (value === "1" || value.includes("gp")) {
    return "GP Weight Loss Consultation";
  }

  if (value === "2" || value.includes("glp")) {
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

function emailMessage() {
  return `Thank you.

Question 3 of 5:
What is your email address?`;
}

function serviceMessage() {
  return `Thank you.

Question 4 of 5:
Which service are you interested in?

1. GP Weight Loss Consultation
2. GLP-treatment programme

Reply with 1 or 2.`;
}

function notesMessage() {
  return `Thank you.

Question 5 of 5:
Please briefly tell us how we can help you.`;
}

function finalMessage(fullName: string, email: string, service: string) {
  return `✅ Thank you.

Your lead form has been completed successfully.

Name: ${fullName}
Email: ${email}
Service: ${service}

A BodyLab consultant will contact you shortly.`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge || "", { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("WHATSAPP WEBHOOK RECEIVED:", JSON.stringify(body));

    await saveWebhookEvent(body);

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const messageObj = value?.messages?.[0];

    if (!messageObj) {
      return NextResponse.json({ success: true, message: "No message" });
    }

    const phone = normalisePhone(messageObj.from);
    const incomingText = cleanText(messageObj?.text?.body);

    if (!phone || !incomingText) {
      return NextResponse.json({ success: true, message: "No text" });
    }

    let session = await getSession(phone);
    const wantsStart = isStartCommand(incomingText);
    const wantsReset = isResetCommand(incomingText);

    if (wantsReset) {
      const newLead = await createNewLead(phone, incomingText);
      const leadId = newLead?.id || null;

      await saveMessage(phone, incomingText, "inbound", leadId);

      await upsertSession(phone, {
        lead_id: leadId,
        step: "first_name",
        first_name: null,
        surname: null,
        email: null,
        service_interest: null,
        notes: null,
        completed: false,
      });

      await reply(phone, startMessage(), leadId);
      return NextResponse.json({ success: true });
    }

    if (!session || session.step === "completed") {
      const newLead = await createNewLead(phone, incomingText);
      const leadId = newLead?.id || null;

      await saveMessage(phone, incomingText, "inbound", leadId);

      await upsertSession(phone, {
        lead_id: leadId,
        step: "first_name",
        first_name: null,
        surname: null,
        email: null,
        service_interest: null,
        notes: null,
        completed: false,
      });

      await reply(phone, startMessage(), leadId);
      return NextResponse.json({ success: true });
    }

    const leadId = session.lead_id || null;

    if (wantsStart) {
      await saveMessage(phone, incomingText, "inbound", leadId);

      await reply(
        phone,
        `You already have an active lead form in progress.

Please answer the current question, or type RESET to start again.`,
        leadId
      );

      return NextResponse.json({ success: true });
    }

    await saveMessage(phone, incomingText, "inbound", leadId);

    const step = session.step as LeadStep;

    if (step === "first_name") {
      await upsertSession(phone, {
        lead_id: leadId,
        step: "surname",
        first_name: incomingText,
        completed: false,
      });

      await updateLeadById(leadId, {
        first_name: incomingText,
        full_name: incomingText,
        status: "In Progress",
        source: "WhatsApp",
        phone,
        whatsapp_id: phone,
        last_message: incomingText,
      });

      await reply(phone, surnameMessage(), leadId);
      return NextResponse.json({ success: true });
    }

    if (step === "surname") {
      const firstName = session.first_name || "";
      const surname = incomingText;
      const fullName = `${firstName} ${surname}`.trim();

      await upsertSession(phone, {
        lead_id: leadId,
        step: "email",
        surname,
        completed: false,
      });

      await updateLeadById(leadId, {
        first_name: firstName,
        surname,
        full_name: fullName,
        status: "In Progress",
        source: "WhatsApp",
        phone,
        whatsapp_id: phone,
        last_message: incomingText,
      });

      await reply(phone, emailMessage(), leadId);
      return NextResponse.json({ success: true });
    }

    if (step === "email") {
      await upsertSession(phone, {
        lead_id: leadId,
        step: "service",
        email: incomingText,
        completed: false,
      });

      await updateLeadById(leadId, {
        email: incomingText,
        status: "In Progress",
        source: "WhatsApp",
        phone,
        whatsapp_id: phone,
        last_message: incomingText,
      });

      await reply(phone, serviceMessage(), leadId);
      return NextResponse.json({ success: true });
    }

    if (step === "service") {
      const selectedService = getService(incomingText);

      if (!selectedService) {
        await reply(
          phone,
          `Please reply with one option:

1. GP Weight Loss Consultation
2. GLP-treatment programme`,
          leadId
        );

        return NextResponse.json({ success: true });
      }

      await upsertSession(phone, {
        lead_id: leadId,
        step: "notes",
        service_interest: selectedService,
        completed: false,
      });

      await updateLeadById(leadId, {
        service_interest: selectedService,
        status: "In Progress",
        source: "WhatsApp",
        phone,
        whatsapp_id: phone,
        last_message: incomingText,
      });

      await reply(phone, notesMessage(), leadId);
      return NextResponse.json({ success: true });
    }

    if (step === "notes") {
      const firstName = session.first_name || "";
      const surname = session.surname || "";
      const email = session.email || "";
      const serviceInterest = session.service_interest || "";
      const notes = incomingText;
      const fullName = `${firstName} ${surname}`.trim();

      await updateLeadById(leadId, {
        first_name: firstName,
        surname,
        full_name: fullName,
        email,
        phone,
        whatsapp_id: phone,
        service_interest: serviceInterest,
        notes,
        status: "New Lead",
        source: "WhatsApp",
        priority: "Normal",
        last_message: notes,
      });

      await upsertSession(phone, {
        lead_id: leadId,
        step: "completed",
        first_name: firstName,
        surname,
        email,
        service_interest: serviceInterest,
        notes,
        completed: true,
      });

      await reply(phone, finalMessage(fullName, email, serviceInterest), leadId);
      return NextResponse.json({ success: true });
    }

    await reply(phone, startMessage(), leadId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WHATSAPP WEBHOOK ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Webhook failed" },
      { status: 500 }
    );
  }
}
