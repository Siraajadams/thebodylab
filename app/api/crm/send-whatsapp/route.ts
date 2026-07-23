import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendWhatsAppRequest = {
  leadId?: string;
  message?: string;
  templateName?: string;
  templateVariables?: string[];
};

type LeadRecord = {
  id: string;
  first_name: string | null;
  surname: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  service_interest: string | null;
  status: string | null;
};

type WhatsAppApiResponse = {
  messaging_product?: string;
  contacts?: Array<{
    input?: string;
    wa_id?: string;
  }>;
  messages?: Array<{
    id?: string;
    message_status?: string;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_data?: {
      messaging_product?: string;
      details?: string;
    };
  };
};

const BODYLAB_PRODUCTION_PHONE_NUMBER_ID = "1160028520535064";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SendWhatsAppRequest;

    const leadId = cleanText(body.leadId);
    const message = cleanText(body.message);
    const templateName = cleanText(body.templateName);

    const templateVariables = Array.isArray(body.templateVariables)
      ? body.templateVariables.map(cleanText).filter(Boolean)
      : [];

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: "Lead ID is required." },
        { status: 400 }
      );
    }

    const useTemplate = Boolean(templateName);

    if (!useTemplate && !message) {
      return NextResponse.json(
        {
          success: false,
          error: "A WhatsApp message or approved template is required.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin() as any;

    const { data: rawLead, error: leadError } = await supabase
      .from("leads")
      .select(
        `
          id,
          first_name,
          surname,
          full_name,
          phone,
          email,
          service_interest,
          status
        `
      )
      .eq("id", leadId)
      .maybeSingle();

    if (leadError) {
      console.error("Lead lookup error:", leadError);

      return NextResponse.json(
        {
          success: false,
          error: "Unable to retrieve the lead.",
          details: leadError.message,
          code: leadError.code,
        },
        { status: 500 }
      );
    }

    const lead = rawLead as LeadRecord | null;

    if (!lead) {
      return NextResponse.json(
        { success: false, error: "Lead not found.", leadId },
        { status: 404 }
      );
    }

    const recipient = normalizePhoneNumber(lead.phone);

    if (!recipient) {
      return NextResponse.json(
        {
          success: false,
          error: "The lead does not have a valid South African phone number.",
          leadId: lead.id,
        },
        { status: 400 }
      );
    }

    const accessToken = cleanText(process.env.WHATSAPP_ACCESS_TOKEN);
    const phoneNumberId = cleanText(process.env.WHATSAPP_PHONE_NUMBER_ID);
    const graphApiVersion =
      cleanText(process.env.META_GRAPH_API_VERSION) ||
      cleanText(process.env.WHATSAPP_API_VERSION) ||
      "v25.0";

    if (!accessToken || !phoneNumberId) {
      console.error("Missing WhatsApp environment variables:", {
        hasAccessToken: Boolean(accessToken),
        hasPhoneNumberId: Boolean(phoneNumberId),
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "WhatsApp environment variables are missing. Check WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
        },
        { status: 500 }
      );
    }

    if (phoneNumberId !== BODYLAB_PRODUCTION_PHONE_NUMBER_ID) {
      console.warn("Unexpected WhatsApp Phone Number ID configured.", {
        configured: phoneNumberId,
        expected: BODYLAB_PRODUCTION_PHONE_NUMBER_ID,
      });
    }

    const whatsappPayload = useTemplate
      ? {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "template",
          template: {
            name: templateName,
            language: { code: "en" },
            ...(templateVariables.length
              ? {
                  components: [
                    {
                      type: "body",
                      parameters: templateVariables.map((value) => ({
                        type: "text",
                        text: value,
                      })),
                    },
                  ],
                }
              : {}),
          },
        }
      : {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "text",
          text: {
            preview_url: true,
            body: message,
          },
        };

    const requestedAt = new Date().toISOString();

    console.log("WHATSAPP SEND REQUEST:", {
      leadId: lead.id,
      recipient,
      requestedAt,
      messageType: useTemplate ? "template" : "text",
      templateName: useTemplate ? templateName : null,
      phoneNumberId,
    });

    const response = await fetch(
      `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(whatsappPayload),
        cache: "no-store",
      }
    );

    const result = await readMetaResponse(response);

    if (!response.ok) {
      console.error("WHATSAPP SEND FAILED:", {
        recipient,
        requestedAt,
        status: response.status,
        statusText: response.statusText,
        result,
      });

      await saveFailedOutboundMessage({
        supabase,
        leadId: lead.id,
        phoneNumberId,
        recipient,
        message: useTemplate
          ? message || `WhatsApp template: ${templateName}`
          : message,
        messageType: useTemplate ? "template" : "text",
        templateName: useTemplate ? templateName : null,
        attemptedAt: requestedAt,
        rawPayload: result,
      });

      return NextResponse.json(
        {
          success: false,
          error: result.error?.message || "WhatsApp could not send the message.",
          details: result.error?.error_data?.details || result.error,
          metaCode: result.error?.code,
          metaSubcode: result.error?.error_subcode,
          recipient,
          attemptedAt: requestedAt,
        },
        { status: normalizeHttpStatus(response.status) }
      );
    }

    const externalMessageId = result.messages?.[0]?.id || null;
    const acceptedStatus =
      result.messages?.[0]?.message_status || "accepted";
    const sentAt = new Date().toISOString();

    const leadDisplayName =
      cleanText(lead.full_name) ||
      [lead.first_name, lead.surname].filter(Boolean).join(" ").trim() ||
      "lead";

    const storedMessage = useTemplate
      ? message || `WhatsApp template sent: ${templateName}`
      : message;

    const localSave = {
      leadMessagesSaved: false,
      whatsappMessagesSaved: false,
      leadUpdated: false,
      activitySaved: false,
    };

    const { error: leadMessageError } = await supabase
      .from("lead_messages")
      .insert({
        lead_id: lead.id,
        channel: "whatsapp",
        direction: "outbound",
        message_type: useTemplate ? "template" : "text",
        template_key: useTemplate ? templateName : null,
        subject: null,
        message_body: storedMessage,
        external_message_id: externalMessageId,
        sender: phoneNumberId,
        recipient,
        delivery_status: acceptedStatus,
        sent_at: sentAt,
      });

    localSave.leadMessagesSaved = !leadMessageError;

    if (leadMessageError) {
      console.error("Failed to save lead_messages:", leadMessageError);
    }

    const { error: whatsappMessageError } = await supabase
      .from("whatsapp_messages")
      .insert({
        lead_id: lead.id,
        phone: recipient,
        sender: phoneNumberId,
        recipient,
        direction: "outbound",
        message_text: storedMessage,
        message_type: useTemplate ? "template" : "text",
        template_name: useTemplate ? templateName : null,
        external_message_id: externalMessageId,
        delivery_status: acceptedStatus,
        sent_at: sentAt,
        raw_payload: result,
        created_at: sentAt,
        updated_at: sentAt,
      });

    localSave.whatsappMessagesSaved = !whatsappMessageError;

    if (whatsappMessageError) {
      console.error("Failed to save whatsapp_messages:", whatsappMessageError);
    }

    const currentStatus = cleanText(lead.status);

    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({
        status:
          !currentStatus || currentStatus === "New Lead"
            ? "Contacted"
            : currentStatus,
        last_message: storedMessage,
        last_message_at: sentAt,
        updated_at: sentAt,
      })
      .eq("id", lead.id);

    localSave.leadUpdated = !leadUpdateError;

    if (leadUpdateError) {
      console.error("Failed to update lead:", leadUpdateError);
    }

    const { error: activityError } = await supabase
      .from("activities")
      .insert({
        lead_id: lead.id,
        activity_type: "whatsapp_sent",
        description: `WhatsApp message sent to ${leadDisplayName} (${formatPhoneForDisplay(
          recipient
        )}) at ${sentAt}.`,
        created_at: sentAt,
      });

    localSave.activitySaved = !activityError;

    if (activityError) {
      console.error("Failed to save WhatsApp activity:", activityError);
    }

    console.log("WHATSAPP SEND ACCEPTED:", {
      leadId: lead.id,
      recipient,
      sentAt,
      externalMessageId,
      acceptedStatus,
      localSave,
    });

    return NextResponse.json({
      success: true,
      message: "WhatsApp message accepted by Meta.",
      messageId: externalMessageId,
      recipient,
      recipientDisplay: formatPhoneForDisplay(recipient),
      sentAt,
      deliveryStatus: acceptedStatus,
      leadId: lead.id,
      leadName: leadDisplayName,
      messageType: useTemplate ? "template" : "text",
      localStorage: localSave,
    });
  } catch (error) {
    console.error("Send WhatsApp route error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}

async function saveFailedOutboundMessage(args: {
  supabase: any;
  leadId: string;
  phoneNumberId: string;
  recipient: string;
  message: string;
  messageType: "template" | "text";
  templateName: string | null;
  attemptedAt: string;
  rawPayload: unknown;
}) {
  const { error } = await args.supabase.from("whatsapp_messages").insert({
    lead_id: args.leadId,
    phone: args.recipient,
    sender: args.phoneNumberId,
    recipient: args.recipient,
    direction: "outbound",
    message_text: args.message,
    message_type: args.messageType,
    template_name: args.templateName,
    external_message_id: null,
    delivery_status: "failed",
    failed_at: args.attemptedAt,
    raw_payload: args.rawPayload,
    created_at: args.attemptedAt,
    updated_at: args.attemptedAt,
  });

  if (error) {
    console.error("Failed to save failed outbound WhatsApp message:", error);
  }
}

async function readMetaResponse(
  response: Response
): Promise<WhatsAppApiResponse> {
  const rawText = await response.text();

  if (!rawText) {
    return {
      error: { message: "Meta returned an empty response." },
    };
  }

  try {
    return JSON.parse(rawText) as WhatsAppApiResponse;
  } catch {
    return {
      error: {
        message: "Meta returned a response that was not valid JSON.",
        error_data: { details: rawText.slice(0, 1000) },
      },
    };
  }
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeHttpStatus(status: number): number {
  return status >= 400 && status <= 599 ? status : 500;
}

function normalizePhoneNumber(value: unknown): string {
  let phone = cleanText(value).replace(/\D/g, "");

  if (!phone) return "";

  if (phone.startsWith("00")) {
    phone = phone.slice(2);
  }

  if (phone.startsWith("0")) {
    phone = `27${phone.slice(1)}`;
  }

  if (!phone.startsWith("27")) {
    phone = `27${phone}`;
  }

  return /^27\d{9}$/.test(phone) ? phone : "";
}

function formatPhoneForDisplay(phone: string): string {
  if (!/^27\d{9}$/.test(phone)) return phone;

  return `+27 ${phone.slice(2, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
}
'''

webhook_code = r'''import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const META_API_VERSION =
  process.env.META_GRAPH_API_VERSION ||
  process.env.WHATSAPP_API_VERSION ||
  "v25.0";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "";
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

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
  messageId: string | null;
};

type WhatsAppStatus = {
  id?: string;
  status?: "sent" | "delivered" | "read" | "failed" | "deleted" | string;
  timestamp?: string;
  recipient_id?: string;
  conversation?: {
    id?: string;
    expiration_timestamp?: string;
    origin?: { type?: string };
  };
  pricing?: {
    billable?: boolean;
    pricing_model?: string;
    category?: string;
  };
  errors?: Array<{
    code?: number;
    title?: string;
    message?: string;
    error_data?: { details?: string };
  }>;
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

function normalisePhone(phone: unknown) {
  return cleanText(phone).replace(/\D/g, "");
}

function metaTimestampToIso(timestamp: unknown) {
  const seconds = Number(timestamp);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return new Date().toISOString();
  }

  return new Date(seconds * 1000).toISOString();
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
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("webhook_events")
    .insert({
      source: "whatsapp",
      event_type: field || "message",
      raw_payload: body,
      processed: false,
      created_at: now,
    })
    .select("id")
    .maybeSingle();

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
        created_at: now,
      });

    if (metaError) {
      console.error("META LEAD EVENT SAVE ERROR:", metaError);
    }
  }

  return data?.id || null;
}

async function markWebhookProcessed(
  webhookEventId: string | null,
  processingError?: string | null
) {
  if (!webhookEventId) return;

  const supabase = getSupabase();

  const { error } = await supabase
    .from("webhook_events")
    .update({
      processed: !processingError,
      processing_error: processingError || null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", webhookEventId);

  if (error) {
    console.error("WEBHOOK EVENT UPDATE ERROR:", error);
  }
}

async function callWhatsAppApi(
  payload: Record<string, unknown>
): Promise<SendResult> {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    return {
      ok: false,
      status: 500,
      data: {
        error: "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing.",
      },
      messageId: null,
    };
  }

  if (PHONE_NUMBER_ID !== BODYLAB_PRODUCTION_PHONE_NUMBER_ID) {
    console.warn("Unexpected WhatsApp Phone Number ID configured.", {
      configured: PHONE_NUMBER_ID,
      expected: BODYLAB_PRODUCTION_PHONE_NUMBER_ID,
    });
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

  const rawText = await response.text();
  let data: any = {};

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { raw: rawText };
  }

  const messageId = cleanText(data?.messages?.[0]?.id) || null;

  console.log("META RESPONSE:", {
    ok: response.ok,
    status: response.status,
    phoneNumberId: PHONE_NUMBER_ID,
    messageId,
    data,
  });

  return {
    ok: response.ok,
    status: response.status,
    data,
    messageId,
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

async function messageAlreadySaved(externalMessageId: string) {
  if (!externalMessageId) return false;

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("external_message_id", externalMessageId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("MESSAGE DEDUPLICATION CHECK ERROR:", error);
    return false;
  }

  return Boolean(data?.id);
}

async function saveMessage(args: {
  phone: string;
  messageText: string;
  direction: "inbound" | "outbound";
  leadId?: string | null;
  rawPayload?: any;
  externalMessageId?: string | null;
  messageType?: string | null;
  sender?: string | null;
  recipient?: string | null;
  deliveryStatus?: string | null;
  eventTime?: string | null;
}) {
  const supabase = getSupabase();
  const now = args.eventTime || new Date().toISOString();

  if (
    args.externalMessageId &&
    (await messageAlreadySaved(args.externalMessageId))
  ) {
    console.log("Duplicate WhatsApp webhook message ignored:", {
      externalMessageId: args.externalMessageId,
    });

    return;
  }

  const { error } = await supabase.from("whatsapp_messages").insert({
    phone: normalisePhone(args.phone),
    lead_id: args.leadId || null,
    sender:
      args.sender ||
      (args.direction === "inbound"
        ? normalisePhone(args.phone)
        : PHONE_NUMBER_ID),
    recipient:
      args.recipient ||
      (args.direction === "inbound"
        ? PHONE_NUMBER_ID
        : normalisePhone(args.phone)),
    message_text: args.messageText,
    direction: args.direction,
    message_type: args.messageType || "text",
    external_message_id: args.externalMessageId || null,
    delivery_status:
      args.deliveryStatus ||
      (args.direction === "inbound" ? "received" : "accepted"),
    received_at: args.direction === "inbound" ? now : null,
    sent_at: args.direction === "outbound" ? now : null,
    raw_payload: args.rawPayload || null,
    created_at: now,
    updated_at: now,
  });

  if (error) {
    console.error("WHATSAPP MESSAGE SAVE ERROR:", error);
  }
}

async function reply(phone: string, message: string, leadId?: string | null) {
  const requestedAt = new Date().toISOString();
  const result = await sendWhatsAppText(phone, message);

  if (result.ok) {
    await saveMessage({
      phone,
      messageText: message,
      direction: "outbound",
      leadId,
      rawPayload: result.data,
      externalMessageId: result.messageId,
      sender: PHONE_NUMBER_ID,
      recipient: normalisePhone(phone),
      deliveryStatus: "accepted",
      eventTime: requestedAt,
    });
  } else {
    await saveMessage({
      phone,
      messageText: message,
      direction: "outbound",
      leadId,
      rawPayload: result.data,
      externalMessageId: result.messageId,
      sender: PHONE_NUMBER_ID,
      recipient: normalisePhone(phone),
      deliveryStatus: "failed",
      eventTime: requestedAt,
    });

    console.error("OUTBOUND MESSAGE FAILED:", {
      phone,
      leadId,
      metaStatus: result.status,
      metaResponse: result.data,
    });
  }

  return result;
}

async function updateMessageStatuses(statuses: WhatsAppStatus[]) {
  if (!Array.isArray(statuses) || statuses.length === 0) return;

  const supabase = getSupabase();

  for (const statusEvent of statuses) {
    const externalMessageId = cleanText(statusEvent.id);
    const deliveryStatus = cleanText(statusEvent.status) || "unknown";
    const recipient = normalisePhone(statusEvent.recipient_id);
    const eventTime = metaTimestampToIso(statusEvent.timestamp);
    const errorDetails =
      statusEvent.errors?.map((item) => ({
        code: item.code,
        title: item.title,
        message: item.message,
        details: item.error_data?.details,
      })) || null;

    if (!externalMessageId) continue;

    const timestampColumn =
      deliveryStatus === "sent"
        ? "sent_at"
        : deliveryStatus === "delivered"
          ? "delivered_at"
          : deliveryStatus === "read"
            ? "read_at"
            : deliveryStatus === "failed"
              ? "failed_at"
              : null;

    const updatePayload: Record<string, unknown> = {
      delivery_status: deliveryStatus,
      recipient: recipient || null,
      status_payload: statusEvent,
      status_error: errorDetails,
      updated_at: new Date().toISOString(),
    };

    if (timestampColumn) {
      updatePayload[timestampColumn] = eventTime;
    }

    const { data: updatedMessages, error: updateError } = await supabase
      .from("whatsapp_messages")
      .update(updatePayload)
      .eq("external_message_id", externalMessageId)
      .select("id, lead_id");

    if (updateError) {
      console.error("WHATSAPP STATUS UPDATE ERROR:", {
        externalMessageId,
        deliveryStatus,
        updateError,
      });
      continue;
    }

    const { error: leadMessageError } = await supabase
      .from("lead_messages")
      .update({
        delivery_status: deliveryStatus,
        ...(timestampColumn ? { [timestampColumn]: eventTime } : {}),
      })
      .eq("external_message_id", externalMessageId);

    if (leadMessageError) {
      console.error("LEAD MESSAGE STATUS UPDATE ERROR:", {
        externalMessageId,
        deliveryStatus,
        leadMessageError,
      });
    }

    console.log("WHATSAPP STATUS UPDATED:", {
      externalMessageId,
      deliveryStatus,
      recipient,
      eventTime,
      matchedRecords: updatedMessages?.length || 0,
    });
  }
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
  const now = new Date().toISOString();

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
      last_message_at: now,
      created_at: now,
      updated_at: now,
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
  if (!leadId) return null;

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

A BodyLab consultant will contact you shortly.

Would you like to book an appointment with one of our doctors now?

Book online:
https://thebodylab.co.za/

We look forward to helping you achieve your health and weight loss goals.`;
}

async function beginNewSession(
  phone: string,
  incomingText: string,
  rawPayload: any,
  incomingMessageId: string,
  incomingTime: string,
  messageType: string
) {
  const newLead = await createNewLead(phone, incomingText);
  const leadId = newLead?.id || null;

  await saveMessage({
    phone,
    messageText: incomingText,
    direction: "inbound",
    leadId,
    rawPayload,
    externalMessageId: incomingMessageId,
    messageType,
    sender: phone,
    recipient: PHONE_NUMBER_ID,
    deliveryStatus: "received",
    eventTime: incomingTime,
  });

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
    return NextResponse.json(
      { error: "Webhook verify token is not configured." },
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
  let webhookEventId: string | null = null;

  try {
    const body = await req.json();

    console.log("WHATSAPP WEBHOOK RECEIVED:", JSON.stringify(body));

    webhookEventId = await saveWebhookEvent(body);

    const change = body?.entry?.[0]?.changes?.[0];
    const value = change?.value;
    const statuses = (value?.statuses || []) as WhatsAppStatus[];

    if (statuses.length > 0) {
      await updateMessageStatuses(statuses);
      await markWebhookProcessed(webhookEventId);

      return NextResponse.json({
        success: true,
        message: "WhatsApp delivery status processed.",
        statusesProcessed: statuses.length,
      });
    }

    const messageObj = value?.messages?.[0];

    if (!messageObj) {
      await markWebhookProcessed(webhookEventId);

      return NextResponse.json({
        success: true,
        message: "Non-message webhook event received.",
      });
    }

    const phone = normalisePhone(messageObj.from);
    const incomingText = extractIncomingText(messageObj);
    const incomingMessageId = cleanText(messageObj.id);
    const incomingTime = metaTimestampToIso(messageObj.timestamp);
    const messageType = cleanText(messageObj.type) || "unknown";

    if (incomingMessageId) {
      await markMessageAsRead(incomingMessageId);
    }

    if (!phone) {
      await markWebhookProcessed(webhookEventId);
      return NextResponse.json({
        success: true,
        message: "No sender phone number.",
      });
    }

    if (!incomingText) {
      await saveMessage({
        phone,
        messageText: `[Unsupported WhatsApp message type: ${messageType}]`,
        direction: "inbound",
        rawPayload: body,
        externalMessageId: incomingMessageId,
        messageType,
        sender: phone,
        recipient: PHONE_NUMBER_ID,
        deliveryStatus: "received",
        eventTime: incomingTime,
      });

      await reply(
        phone,
        "Thank you for contacting BodyLab. Please send a text message such as Hi to begin.",
        null
      );

      await markWebhookProcessed(webhookEventId);

      return NextResponse.json({
        success: true,
        message: "Unsupported message type recorded.",
      });
    }

    let session = await getSession(phone);
    const wantsStart = isStartCommand(incomingText);
    const wantsReset = isResetCommand(incomingText);

    if (wantsReset || !session || session.step === "completed") {
      await beginNewSession(
        phone,
        incomingText,
        body,
        incomingMessageId,
        incomingTime,
        messageType
      );

      await markWebhookProcessed(webhookEventId);
      return NextResponse.json({ success: true });
    }

    const leadId = session.lead_id || null;

    await saveMessage({
      phone,
      messageText: incomingText,
      direction: "inbound",
      leadId,
      rawPayload: body,
      externalMessageId: incomingMessageId,
      messageType,
      sender: phone,
      recipient: PHONE_NUMBER_ID,
      deliveryStatus: "received",
      eventTime: incomingTime,
    });

    if (wantsStart) {
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

      await markWebhookProcessed(webhookEventId);
      return NextResponse.json({ success: true });
    }

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
    } else if (step === "surname") {
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
    } else if (step === "email") {
      if (!isValidEmail(incomingText)) {
        await reply(
          phone,
          `That email address does not look valid.

Please enter it again, for example:
name@gmail.com`,
          leadId
        );
      } else {
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
      }
    } else if (step === "service") {
      const selectedService = getService(incomingText);

      if (!selectedService) {
        await reply(
          phone,
          `Please reply with one option:

1. GP Weight Loss Consultation
2. GLP-treatment programme`,
          leadId
        );
      } else {
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
      }
    } else if (step === "notes") {
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
    } else {
      console.warn("UNKNOWN SESSION STEP. RESETTING SESSION:", {
        phone,
        step,
      });

      await beginNewSession(
        phone,
        incomingText,
        body,
        incomingMessageId,
        incomingTime,
        messageType
      );
    }

    await markWebhookProcessed(webhookEventId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed.";

    console.error("WHATSAPP WEBHOOK ERROR:", error);
    await markWebhookProcessed(webhookEventId, message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
'''

out1 = Path("/mnt/data/send-whatsapp-route.ts")
out2 = Path("/mnt/data/whatsapp-webhook-route.ts")
out1.write_text(send_code, encoding="utf-8")
out2.write_text(webhook_code, encoding="utf-8")

print(out1)
print(out2)
