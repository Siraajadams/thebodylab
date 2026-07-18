// app/api/whatsapp/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const META_API_VERSION = process.env.WHATSAPP_API_VERSION || "v25.0";
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "";
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

type LeadStep =
  | "first_name"
  | "surname"
  | "email"
  | "service"
  | "notes"
  | "completed";

type SessionRow = {
  id: string;
  phone: string;
  lead_id: string | null;
  step: LeadStep;
  first_name: string | null;
  surname: string | null;
  email: string | null;
  service_interest: string | null;
  notes: string | null;
  completed: boolean;
  created_at?: string;
  updated_at?: string;
};

type MetaSendResult = {
  ok: boolean;
  status: number;
  data: any;
};

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
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

function nowIso(): string {
  return new Date().toISOString();
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalisePhone(value: unknown): string {
  return cleanText(value).replace(/\D/g, "");
}

function normaliseStep(value: unknown): LeadStep {
  const step = cleanText(value).toLowerCase();

  if (
    step === "first_name" ||
    step === "surname" ||
    step === "email" ||
    step === "service" ||
    step === "notes" ||
    step === "completed"
  ) {
    return step;
  }

  return "first_name";
}

function isStartCommand(text: string): boolean {
  return [
    "hi",
    "hello",
    "hey",
    "hallo",
    "start",
    "good day",
    "goodday",
  ].includes(cleanText(text).toLowerCase());
}

function isResetCommand(text: string): boolean {
  return ["reset", "restart", "start again"].includes(
    cleanText(text).toLowerCase()
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(value));
}

function getService(value: string): string {
  const answer = cleanText(value).toLowerCase();

  if (answer === "1" || answer.includes("gp")) {
    return "GP Weight Loss Consultation";
  }

  if (
    answer === "2" ||
    answer.includes("glp") ||
    answer.includes("treatment programme")
  ) {
    return "GLP-treatment programme";
  }

  return "";
}

function extractIncomingText(message: any): string {
  if (!message) return "";

  if (message.type === "text") {
    return cleanText(message?.text?.body);
  }

  if (message.type === "button") {
    return cleanText(message?.button?.text || message?.button?.payload);
  }

  if (message.type === "interactive") {
    return cleanText(
      message?.interactive?.button_reply?.title ||
        message?.interactive?.button_reply?.id ||
        message?.interactive?.list_reply?.title ||
        message?.interactive?.list_reply?.id
    );
  }

  return "";
}

function startMessage(): string {
  return `👋 Welcome to BodyLab.

Let's complete your lead form via WhatsApp.

Question 1 of 5:
What is your first name?`;
}

function surnameMessage(): string {
  return `Thank you.

Question 2 of 5:
What is your surname?`;
}

function emailMessage(): string {
  return `Thank you.

Question 3 of 5:
What is your email address?`;
}

function serviceMessage(): string {
  return `Thank you.

Question 4 of 5:
Which service are you interested in?

1. GP Weight Loss Consultation
2. GLP-treatment programme

Reply with 1 or 2.`;
}

function notesMessage(): string {
  return `Thank you.

Question 5 of 5:
Please briefly tell us how we can help you.`;
}

function completedMessage(
  fullName: string,
  email: string,
  service: string
): string {
  return `✅ Thank you.

Your lead form has been completed successfully.

Name: ${fullName}
Email: ${email}
Service: ${service}

A BodyLab consultant will contact you shortly.`;
}

function promptForStep(step: LeadStep): string {
  switch (step) {
    case "surname":
      return surnameMessage();
    case "email":
      return emailMessage();
    case "service":
      return serviceMessage();
    case "notes":
      return notesMessage();
    case "completed":
    case "first_name":
    default:
      return startMessage();
  }
}

async function saveWebhookEvent(body: any): Promise<void> {
  try {
    const supabase = getSupabase();
    const change = body?.entry?.[0]?.changes?.[0];

    const { error } = await supabase.from("webhook_events").insert({
      source: "whatsapp",
      event_type: change?.field || "messages",
      raw_payload: body,
      processed: false,
      created_at: nowIso(),
    });

    if (error) {
      console.error("WEBHOOK EVENT SAVE ERROR:", error);
    }
  } catch (error) {
    console.error("WEBHOOK EVENT SAVE EXCEPTION:", error);
  }
}

async function callMeta(payload: Record<string, unknown>): Promise<MetaSendResult> {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    return {
      ok: false,
      status: 500,
      data: {
        error:
          "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured.",
      },
    };
  }

  const response = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  const data = await response.json().catch(async () => ({
    raw: await response.text().catch(() => ""),
  }));

  console.log("META API RESULT:", {
    ok: response.ok,
    status: response.status,
    data,
  });

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function markMessageRead(messageId: string): Promise<void> {
  if (!messageId) return;

  const result = await callMeta({
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });

  if (!result.ok) {
    console.error("MARK MESSAGE READ FAILED:", result);
  }
}

async function saveMessage(params: {
  phone: string;
  direction: "inbound" | "outbound";
  messageText: string;
  leadId?: string | null;
  whatsappMessageId?: string | null;
  status?: string;
  rawPayload?: any;
}): Promise<void> {
  try {
    const supabase = getSupabase();

    const { error } = await supabase.from("whatsapp_messages").insert({
      phone: normalisePhone(params.phone),
      lead_id: params.leadId || null,
      direction: params.direction,
      message_text: params.messageText,
      whatsapp_message_id: params.whatsappMessageId || null,
      status:
        params.status ||
        (params.direction === "outbound" ? "sent" : "received"),
      raw_payload: params.rawPayload || null,
      created_at: nowIso(),
    });

    if (error && error.code !== "23505") {
      console.error("WHATSAPP MESSAGE SAVE ERROR:", {
        params,
        error,
      });
    }
  } catch (error) {
    console.error("WHATSAPP MESSAGE SAVE EXCEPTION:", error);
  }
}

async function sendReply(
  phone: string,
  messageText: string,
  leadId?: string | null
): Promise<MetaSendResult> {
  const result = await callMeta({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalisePhone(phone),
    type: "text",
    text: {
      preview_url: false,
      body: messageText,
    },
  });

  const sentMessageId = cleanText(result?.data?.messages?.[0]?.id) || null;

  await saveMessage({
    phone,
    direction: "outbound",
    messageText,
    leadId,
    whatsappMessageId: sentMessageId,
    status: result.ok ? "sent" : "failed",
    rawPayload: result.data,
  });

  if (!result.ok) {
    console.error("OUTBOUND WHATSAPP SEND FAILED:", {
      phone,
      leadId,
      status: result.status,
      data: result.data,
    });
  }

  return result;
}

async function inboundMessageAlreadyProcessed(
  whatsappMessageId: string
): Promise<boolean> {
  if (!whatsappMessageId) return false;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("whatsapp_message_id", whatsappMessageId)
    .eq("direction", "inbound")
    .limit(1);

  if (error) {
    console.error("IDEMPOTENCY CHECK ERROR:", error);
    return false;
  }

  return Boolean(data?.length);
}

async function getSession(phone: string): Promise<SessionRow | null> {
  const supabase = getSupabase();
  const cleanedPhone = normalisePhone(phone);

  const { data, error } = await supabase
    .from("whatsapp_lead_sessions")
    .select("*")
    .eq("phone", cleanedPhone)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("GET SESSION ERROR:", {
      phone: cleanedPhone,
      error,
    });
    return null;
  }

  if (!data) return null;

  return {
    ...data,
    step: normaliseStep(data.step),
  } as SessionRow;
}

async function saveSession(
  phone: string,
  updates: Partial<SessionRow>,
  existingSession?: SessionRow | null
): Promise<SessionRow | null> {
  const supabase = getSupabase();
  const cleanedPhone = normalisePhone(phone);
  const session = existingSession ?? (await getSession(cleanedPhone));

  const payload = {
    phone: cleanedPhone,
    ...updates,
    step: normaliseStep(updates.step ?? session?.step ?? "first_name"),
    updated_at: nowIso(),
  };

  const query = session?.id
    ? supabase
        .from("whatsapp_lead_sessions")
        .update(payload)
        .eq("id", session.id)
    : supabase.from("whatsapp_lead_sessions").insert({
        ...payload,
        created_at: nowIso(),
      });

  const { data, error } = await query.select("*").maybeSingle();

  if (error || !data) {
    console.error("SAVE SESSION ERROR:", {
      phone: cleanedPhone,
      sessionId: session?.id || null,
      updates,
      error,
    });
    return null;
  }

  console.log("SESSION SAVED:", {
    id: data.id,
    phone: data.phone,
    leadId: data.lead_id,
    step: data.step,
    completed: data.completed,
  });

  return {
    ...data,
    step: normaliseStep(data.step),
  } as SessionRow;
}

async function findLatestLead(phone: string): Promise<{ id: string } | null> {
  const supabase = getSupabase();
  const cleanedPhone = normalisePhone(phone);

  const { data, error } = await supabase
    .from("leads")
    .select("id")
    .or(`phone.eq.${cleanedPhone},whatsapp_id.eq.${cleanedPhone}`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("FIND LEAD ERROR:", error);
    return null;
  }

  return data || null;
}

async function createLead(phone: string, lastMessage: string) {
  const supabase = getSupabase();
  const cleanedPhone = normalisePhone(phone);

  const { data, error } = await supabase
    .from("leads")
    .insert({
      phone: cleanedPhone,
      whatsapp_id: cleanedPhone,
      lead_reference: crypto.randomUUID(),
      source: "WhatsApp",
      status: "In Progress",
      priority: "Normal",
      last_message: lastMessage,
      last_message_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("CREATE LEAD ERROR:", error);
    return null;
  }

  return data as { id: string };
}

async function getOrCreateLead(phone: string, lastMessage: string) {
  const existing = await findLatestLead(phone);
  if (existing) return existing;
  return createLead(phone, lastMessage);
}

async function updateLead(
  leadId: string | null,
  updates: Record<string, unknown>
): Promise<void> {
  if (!leadId) {
    console.error("LEAD UPDATE SKIPPED: leadId is missing.", updates);
    return;
  }

  const supabase = getSupabase();

  const { error } = await supabase
    .from("leads")
    .update({
      ...updates,
      updated_at: nowIso(),
      last_message_at: nowIso(),
    })
    .eq("id", leadId);

  if (error) {
    console.error("LEAD UPDATE ERROR:", {
      leadId,
      updates,
      error,
    });
  }
}

async function startOrResetSession(params: {
  phone: string;
  incomingText: string;
  rawPayload: any;
  whatsappMessageId: string;
  existingSession?: SessionRow | null;
}): Promise<void> {
  const lead = await getOrCreateLead(params.phone, params.incomingText);
  const leadId = lead?.id || null;

  await updateLead(leadId, {
    first_name: null,
    surname: null,
    full_name: null,
    email: null,
    service_interest: null,
    notes: null,
    source: "WhatsApp",
    status: "In Progress",
    priority: "Normal",
    phone: normalisePhone(params.phone),
    whatsapp_id: normalisePhone(params.phone),
    last_message: params.incomingText,
  });

  await saveMessage({
    phone: params.phone,
    direction: "inbound",
    messageText: params.incomingText,
    leadId,
    whatsappMessageId: params.whatsappMessageId,
    status: "received",
    rawPayload: params.rawPayload,
  });

  const savedSession = await saveSession(
    params.phone,
    {
      lead_id: leadId,
      step: "first_name",
      first_name: null,
      surname: null,
      email: null,
      service_interest: null,
      notes: null,
      completed: false,
    },
    params.existingSession
  );

  if (!savedSession) {
    await sendReply(
      params.phone,
      "We could not start your BodyLab form. Please try again shortly.",
      leadId
    );
    return;
  }

  await sendReply(params.phone, startMessage(), leadId);
}

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!VERIFY_TOKEN) {
    return NextResponse.json(
      { error: "WHATSAPP_VERIFY_TOKEN is not configured." },
      { status: 500 }
    );
  }

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
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
    const message = value?.messages?.[0];

    if (!message) {
      return NextResponse.json({
        success: true,
        message: "Status or non-message webhook received.",
      });
    }

    const phone = normalisePhone(message.from);
    const incomingText = extractIncomingText(message);
    const whatsappMessageId = cleanText(message.id);

    if (!phone) {
      return NextResponse.json({
        success: true,
        message: "Sender phone number is missing.",
      });
    }

    if (
      whatsappMessageId &&
      (await inboundMessageAlreadyProcessed(whatsappMessageId))
    ) {
      console.log("DUPLICATE WHATSAPP WEBHOOK IGNORED:", whatsappMessageId);
      return NextResponse.json({
        success: true,
        duplicate: true,
      });
    }

    if (whatsappMessageId) {
      await markMessageRead(whatsappMessageId);
    }

    if (!incomingText) {
      await sendReply(
        phone,
        "Please send a text message such as Hi to begin your BodyLab lead form."
      );

      return NextResponse.json({
        success: true,
        message: "Unsupported inbound message type.",
      });
    }

    const session = await getSession(phone);
    const wantsReset = isResetCommand(incomingText);
    const wantsStart = isStartCommand(incomingText);

    console.log("PROCESSING WHATSAPP MESSAGE:", {
      phone,
      incomingText,
      whatsappMessageId,
      wantsReset,
      wantsStart,
      sessionId: session?.id || null,
      leadId: session?.lead_id || null,
      step: session?.step || null,
      completed: session?.completed ?? null,
    });

    if (wantsReset || !session || session.completed) {
      await startOrResetSession({
        phone,
        incomingText,
        rawPayload: body,
        whatsappMessageId,
        existingSession: session,
      });

      return NextResponse.json({ success: true });
    }

    const leadId = session.lead_id || null;

    await saveMessage({
      phone,
      direction: "inbound",
      messageText: incomingText,
      leadId,
      whatsappMessageId,
      status: "received",
      rawPayload: body,
    });

    if (wantsStart) {
      await sendReply(
        phone,
        `Your BodyLab lead form is already in progress.

${promptForStep(session.step)}

Type RESET to start again.`,
        leadId
      );

      return NextResponse.json({ success: true });
    }

    if (session.step === "first_name") {
      const firstName = cleanText(incomingText);

      const updatedSession = await saveSession(
        phone,
        {
          step: "surname",
          first_name: firstName,
          completed: false,
        },
        session
      );

      if (!updatedSession) {
        await sendReply(
          phone,
          "We could not save your first name. Please type RESET and try again.",
          leadId
        );
        return NextResponse.json({ success: true });
      }

      await updateLead(leadId, {
        first_name: firstName,
        full_name: firstName,
        phone,
        whatsapp_id: phone,
        source: "WhatsApp",
        status: "In Progress",
        last_message: incomingText,
      });

      await sendReply(phone, surnameMessage(), leadId);
      return NextResponse.json({ success: true, step: "surname" });
    }

    if (session.step === "surname") {
      const firstName = cleanText(session.first_name);
      const surname = cleanText(incomingText);
      const fullName = `${firstName} ${surname}`.trim();

      const updatedSession = await saveSession(
        phone,
        {
          step: "email",
          surname,
          completed: false,
        },
        session
      );

      if (!updatedSession) {
        await sendReply(
          phone,
          "We could not save your surname. Please send it again.",
          leadId
        );
        return NextResponse.json({ success: true });
      }

      await updateLead(leadId, {
        first_name: firstName,
        surname,
        full_name: fullName,
        phone,
        whatsapp_id: phone,
        source: "WhatsApp",
        status: "In Progress",
        last_message: incomingText,
      });

      await sendReply(phone, emailMessage(), leadId);
      return NextResponse.json({ success: true, step: "email" });
    }

    if (session.step === "email") {
      const email = cleanText(incomingText).toLowerCase();

      if (!isValidEmail(email)) {
        await sendReply(
          phone,
          `That email address does not look valid.

Please enter it again, for example:
name@gmail.com`,
          leadId
        );

        return NextResponse.json({ success: true });
      }

      const updatedSession = await saveSession(
        phone,
        {
          step: "service",
          email,
          completed: false,
        },
        session
      );

      if (!updatedSession) {
        await sendReply(
          phone,
          "We could not save your email address. Please send it again.",
          leadId
        );
        return NextResponse.json({ success: true });
      }

      await updateLead(leadId, {
        email,
        phone,
        whatsapp_id: phone,
        source: "WhatsApp",
        status: "In Progress",
        last_message: incomingText,
      });

      await sendReply(phone, serviceMessage(), leadId);
      return NextResponse.json({ success: true, step: "service" });
    }

    if (session.step === "service") {
      const serviceInterest = getService(incomingText);

      if (!serviceInterest) {
        await sendReply(
          phone,
          `Please reply with one option:

1. GP Weight Loss Consultation
2. GLP-treatment programme`,
          leadId
        );

        return NextResponse.json({ success: true });
      }

      const updatedSession = await saveSession(
        phone,
        {
          step: "notes",
          service_interest: serviceInterest,
          completed: false,
        },
        session
      );

      if (!updatedSession) {
        await sendReply(
          phone,
          "We could not save your selected service. Please reply with 1 or 2 again.",
          leadId
        );
        return NextResponse.json({ success: true });
      }

      await updateLead(leadId, {
        service_interest: serviceInterest,
        phone,
        whatsapp_id: phone,
        source: "WhatsApp",
        status: "In Progress",
        last_message: incomingText,
      });

      await sendReply(phone, notesMessage(), leadId);
      return NextResponse.json({ success: true, step: "notes" });
    }

    if (session.step === "notes") {
      const firstName = cleanText(session.first_name);
      const surname = cleanText(session.surname);
      const email = cleanText(session.email);
      const serviceInterest = cleanText(session.service_interest);
      const notes = cleanText(incomingText);
      const fullName = `${firstName} ${surname}`.trim();

      const updatedSession = await saveSession(
        phone,
        {
          step: "completed",
          notes,
          completed: true,
        },
        session
      );

      if (!updatedSession) {
        await sendReply(
          phone,
          "We could not complete your form. Please send your final message again.",
          leadId
        );
        return NextResponse.json({ success: true });
      }

      await updateLead(leadId, {
        first_name: firstName,
        surname,
        full_name: fullName,
        email,
        phone,
        whatsapp_id: phone,
        service_interest: serviceInterest,
        notes,
        source: "WhatsApp",
        status: "New Lead",
        priority: "Normal",
        last_message: notes,
      });

      await sendReply(
        phone,
        completedMessage(fullName, email, serviceInterest),
        leadId
      );

      return NextResponse.json({ success: true, step: "completed" });
    }

    await startOrResetSession({
      phone,
      incomingText,
      rawPayload: body,
      whatsappMessageId,
      existingSession: session,
    });

    return NextResponse.json({
      success: true,
      recovered: true,
    });
  } catch (error) {
    console.error("WHATSAPP WEBHOOK ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Webhook failed.",
      },
      { status: 500 }
    );
  }
}
