// app/api/whatsapp/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const META_API_VERSION = process.env.WHATSAPP_API_VERSION || "v25.0";
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "";
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

// Your live BodyLab production Phone Number ID.
// This is used only as a safety check and not as a secret.
const BODYLAB_PRODUCTION_PHONE_NUMBER_ID = "1160028520535064";

type LeadStep =
  | "first_name"
  | "surname"
  | "email"
  | "service"
  | "notes"
  | "completed";

type SendResult = {
  ok: boolean;
  status: number;
  data: any;
};

let supabaseClient: SupabaseClient | null = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  supabaseClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseClient;
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normalisePhone(phone: string) {
  return cleanText(phone).replace(/\D/g, "");
}

function isStartCommand(text: string) {
  const value = cleanText(text).toLowerCase();
  return [
    "hi",
    "hello",
    "start",
    "good day",
    "goodday",
    "hey",
    "hallo",
  ].includes(value);
}

function isResetCommand(text: string) {
  const value = cleanText(text).toLowerCase();
  return ["reset", "restart", "start again"].includes(value);
}

function extractIncomingText(messageObj: any) {
  if (!messageObj) return "";

  if (messageObj.type === "text") {
    return cleanText(messageObj?.text?.body);
  }

  if (messageObj.type === "button") {
    return cleanText(messageObj?.button?.text || messageObj?.button?.payload);
  }

  if (messageObj.type === "interactive") {
    return cleanText(
      messageObj?.interactive?.button_reply?.title ||
        messageObj?.interactive?.button_reply?.id ||
        messageObj?.interactive?.list_reply?.title ||
        messageObj?.interactive?.list_reply?.id
    );
  }

  return "";
}

async function saveWebhookEvent(body: any) {
  const supabase = getSupabase();
  const change = body?.entry?.[0]?.changes?.[0];
  const value = change?.value;
  const field = change?.field;

  const { error } = await supabase.from("webhook_events").insert({
    source: "whatsapp",
    event_type: field || "message",
    raw_payload: body,
    processed: false,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("WEBHOOK EVENT SAVE ERROR:", error);
  }

  if (field === "leadgen" || value?.leadgen_id || value?.form_id) {
    const { error: metaError } = await supabase
      .from("meta_lead_events")
      .insert({
        meta_lead_id: value?.leadgen_id || value?.id || null,
        page_id: value?.page_id || null,
        form_id: value?.form_id || null,
        raw_payload: body,
        created_at: new Date().toISOString(),
      });

    if (metaError) {
      console.error("META LEAD EVENT SAVE ERROR:", metaError);
    }
  }
}

async function callWhatsAppApi(payload: Record<string, unknown>): Promise<SendResult> {
  if (!WHATSAPP_TOKEN) {
    console.error("WHATSAPP_ACCESS_TOKEN IS MISSING");
    return {
      ok: false,
      status: 500,
      data: { error: "WHATSAPP_ACCESS_TOKEN is missing." },
    };
  }

  if (!PHONE_NUMBER_ID) {
    console.error("WHATSAPP_PHONE_NUMBER_ID IS MISSING");
    return {
      ok: false,
      status: 500,
      data: { error: "WHATSAPP_PHONE_NUMBER_ID is missing." },
    };
  }

  if (PHONE_NUMBER_ID !== BODYLAB_PRODUCTION_PHONE_NUMBER_ID) {
    console.warn(
      "WARNING: Vercel is not using the expected BodyLab production Phone Number ID.",
      {
        configuredPhoneNumberId: PHONE_NUMBER_ID,
        expectedPhoneNumberId: BODYLAB_PRODUCTION_PHONE_NUMBER_ID,
      }
    );
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await response.json().catch(async () => ({
    raw: await response.text().catch(() => ""),
  }));

  console.log("META RESPONSE:", {
    ok: response.ok,
    status: response.status,
    phoneNumberId: PHONE_NUMBER_ID,
    data,
  });

  if (!response.ok) {
    console.error("META SEND ERROR:", {
      status: response.status,
      data,
    });
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function markMessageAsRead(messageId: string) {
  if (!messageId) return;

  await callWhatsAppApi({
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });
}

async function sendWhatsAppText(phone: string, message: string) {
  return callWhatsAppApi({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalisePhone(phone),
    type: "text",
    text: {
      preview_url: false,
      body: message,
    },
  });
}

async function saveMessage(
  phone: string,
  messageText: string,
  direction: "inbound" | "outbound",
  leadId?: string | null,
  rawPayload?: any
) {
  const supabase = getSupabase();

  const { error } = await supabase.from("whatsapp_messages").insert({
    phone: normalisePhone(phone),
    lead_id: leadId || null,
    message_text: messageText,
    direction,
    raw_payload: rawPayload || null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("WHATSAPP MESSAGE SAVE ERROR:", error);
  }
}

async function reply(phone: string, message: string, leadId?: string | null) {
  const result = await sendWhatsAppText(phone, message);

  if (result.ok) {
    await saveMessage(phone, message, "outbound", leadId);
  } else {
    console.error("OUTBOUND MESSAGE WAS NOT SAVED AS SENT:", {
      phone,
      leadId,
      metaStatus: result.status,
      metaResponse: result.data,
    });
  }

  return result;
}

async function getSession(phone: string) {
  const supabase = getSupabase();
  const cleanedPhone = normalisePhone(phone);

  const { data, error } = await supabase
    .from("whatsapp_lead_sessions")
    .select("*")
    .eq("phone", cleanedPhone)
    .maybeSingle();

  if (error) {
    console.error("GET SESSION ERROR:", error);
  }

  return data;
}

async function upsertSession(phone: string, updates: Record<string, unknown>) {
  const supabase = getSupabase();
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

  if (result.error) {
    console.error("UPSERT SESSION ERROR:", result.error);
  }

  return result.data;
}

async function createNewLead(phone: string, incomingText: string) {
  const supabase = getSupabase();
  const cleanedPhone = normalisePhone(phone);
  const leadReference = crypto.randomUUID();

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

async function updateLeadById(
  leadId: string | null,
  updates: Record<string, unknown>
) {
  if (!leadId) {
    console.error("NO LEAD ID PROVIDED FOR UPDATE");
    return null;
  }

  const supabase = getSupabase();

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

  if (error) {
    console.error("UPDATE LEAD BY ID ERROR:", error);
  }

  return data;
}

function getService(input: string) {
  const value = cleanText(input).toLowerCase();

  if (value === "1" || value.includes("gp")) {
    return "GP Weight Loss Consultation";
  }

  if (
    value === "2" ||
    value.includes("glp") ||
    value.includes("treatment programme")
  ) {
    return "GLP-treatment programme";
  }

  return "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(value));
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

async function beginNewSession(phone: string, incomingText: string, rawPayload: any) {
  const newLead = await createNewLead(phone, incomingText);
  const leadId = newLead?.id || null;

  await saveMessage(phone, incomingText, "inbound", leadId, rawPayload);

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

  return reply(phone, startMessage(), leadId);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!VERIFY_TOKEN) {
    console.error("WHATSAPP_VERIFY_TOKEN IS MISSING");
    return NextResponse.json(
      { error: "Webhook verify token is not configured." },
      { status: 500 }
    );
  }

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge || "", {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("WHATSAPP WEBHOOK RECEIVED:", JSON.stringify(body));

    await saveWebhookEvent(body);

    const change = body?.entry?.[0]?.changes?.[0];
    const value = change?.value;
    const messageObj = value?.messages?.[0];

    // Delivery/read/status events do not contain an inbound message.
    if (!messageObj) {
      console.log("WHATSAPP STATUS OR NON-MESSAGE EVENT:", {
        statuses: value?.statuses || null,
        field: change?.field || null,
      });

      return NextResponse.json({
        success: true,
        message: "Status or non-message event received.",
      });
    }

    const phone = normalisePhone(messageObj.from);
    const incomingText = extractIncomingText(messageObj);
    const incomingMessageId = cleanText(messageObj.id);

    if (incomingMessageId) {
      await markMessageAsRead(incomingMessageId);
    }

    if (!phone) {
      return NextResponse.json({
        success: true,
        message: "No sender phone number.",
      });
    }

    if (!incomingText) {
      await reply(
        phone,
        "Thank you for contacting BodyLab. Please send a text message such as Hi to begin.",
        null
      );

      return NextResponse.json({
        success: true,
        message: "Unsupported message type.",
      });
    }

    let session = await getSession(phone);
    const wantsStart = isStartCommand(incomingText);
    const wantsReset = isResetCommand(incomingText);

    // RESET always starts a new lead and a fresh questionnaire.
    if (wantsReset) {
      await beginNewSession(phone, incomingText, body);
      return NextResponse.json({ success: true });
    }

    // New user or completed questionnaire:
    // "Hi" starts a fresh questionnaire immediately.
    if (!session || session.step === "completed") {
      await beginNewSession(phone, incomingText, body);
      return NextResponse.json({ success: true });
    }

    const leadId = session.lead_id || null;

    // If an active questionnaire exists, repeat the current prompt instead of
    // creating duplicate leads.
    if (wantsStart) {
      await saveMessage(phone, incomingText, "inbound", leadId, body);

      const promptByStep: Record<LeadStep, string> = {
        first_name: startMessage(),
        surname: surnameMessage(),
        email: emailMessage(),
        service: serviceMessage(),
        notes: notesMessage(),
        completed: startMessage(),
      };

      await reply(
        phone,
        `Your BodyLab lead form is already in progress.

${promptByStep[session.step as LeadStep] || startMessage()}

Type RESET to start again.`,
        leadId
      );

      return NextResponse.json({ success: true });
    }

    await saveMessage(phone, incomingText, "inbound", leadId, body);

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
      if (!isValidEmail(incomingText)) {
        await reply(
          phone,
          `That email address does not look valid.

Please enter it again, for example:
name@gmail.com`,
          leadId
        );

        return NextResponse.json({ success: true });
      }

      await upsertSession(phone, {
        lead_id: leadId,
        step: "service",
        email: incomingText.toLowerCase(),
        completed: false,
      });

      await updateLeadById(leadId, {
        email: incomingText.toLowerCase(),
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

    // Recover from an unexpected or missing step.
    console.warn("UNKNOWN SESSION STEP. RESETTING SESSION:", {
      phone,
      step,
    });

    await beginNewSession(phone, incomingText, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WHATSAPP WEBHOOK ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Webhook failed",
      },
      { status: 500 }
    );
  }
}
