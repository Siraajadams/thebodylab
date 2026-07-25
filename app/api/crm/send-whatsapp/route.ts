import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_WELCOME_TEMPLATE =
  process.env.WHATSAPP_WELCOME_TEMPLATE_NAME || "bodylab_welcome";

const DEFAULT_TEMPLATE_LANGUAGE =
  process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";

const CUSTOMER_SERVICE_WINDOW_HOURS = 24;

type SendWhatsAppRequest = {
  leadId?: string;
  message?: string;
  templateName?: string;
  templateVariables?: string[];
  forceTemplate?: boolean;
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

type LatestInboundRecord = {
  id: string;
  received_at: string | null;
  created_at: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SendWhatsAppRequest;

    const leadId = cleanText(body.leadId);
    const requestedMessage = cleanText(body.message);
    const requestedTemplateName = cleanText(body.templateName);
    const forceTemplate = body.forceTemplate === true;

    const suppliedTemplateVariables = Array.isArray(body.templateVariables)
      ? body.templateVariables
          .map((value) => cleanText(value))
          .filter(Boolean)
      : [];

    if (!leadId) {
      return NextResponse.json(
        {
          success: false,
          error: "Lead ID is required.",
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
      console.error("Lead lookup error:", {
        leadId,
        code: leadError.code,
        message: leadError.message,
        details: leadError.details,
        hint: leadError.hint,
      });

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
        {
          success: false,
          error: "Lead not found.",
          leadId,
        },
        { status: 404 }
      );
    }

    const phone = normalizePhoneNumber(lead.phone);

    if (!phone) {
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
    const phoneNumberId = cleanText(
      process.env.WHATSAPP_PHONE_NUMBER_ID
    );
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
            "WhatsApp API environment variables are missing. Check WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
        },
        { status: 500 }
      );
    }

    /*
      A free-form WhatsApp text message is allowed only while the
      24-hour customer-service window is open. The window opens when
      the customer sends an inbound message.
    */
    const windowStart = new Date(
      Date.now() -
        CUSTOMER_SERVICE_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { data: latestInboundRaw, error: inboundLookupError } =
      await supabase
        .from("whatsapp_messages")
        .select("id, received_at, created_at")
        .eq("direction", "inbound")
        .or(`lead_id.eq.${lead.id},phone.eq.${phone}`)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (inboundLookupError) {
      console.warn(
        "Unable to determine the WhatsApp customer-service window:",
        {
          leadId: lead.id,
          phone,
          code: inboundLookupError.code,
          message: inboundLookupError.message,
          details: inboundLookupError.details,
          hint: inboundLookupError.hint,
        }
      );
    }

    const latestInbound =
      (latestInboundRaw as LatestInboundRecord | null) || null;

    const customerServiceWindowOpen = Boolean(
      latestInbound &&
        isWithinLastHours(
          latestInbound.received_at || latestInbound.created_at,
          CUSTOMER_SERVICE_WINDOW_HOURS
        )
    );

    /*
      Use an approved template when:
      - the caller explicitly requests a template;
      - forceTemplate is true; or
      - the customer-service window is closed.

      Otherwise send the requested free-form message.
    */
    const useTemplate =
      forceTemplate ||
      Boolean(requestedTemplateName) ||
      !customerServiceWindowOpen;

    const effectiveTemplateName =
      requestedTemplateName || DEFAULT_WELCOME_TEMPLATE;

    if (!useTemplate && !requestedMessage) {
      return NextResponse.json(
        {
          success: false,
          error: "A WhatsApp message is required.",
        },
        { status: 400 }
      );
    }

    if (useTemplate && !effectiveTemplateName) {
      return NextResponse.json(
        {
          success: false,
          error:
            "An approved WhatsApp template is required because the 24-hour customer-service window is closed.",
        },
        { status: 400 }
      );
    }

    /*
      Template variables are only included when they are explicitly
      supplied by the CRM. This prevents Meta rejecting a template
      whose approved body has no placeholders.
    */
    const whatsappPayload = useTemplate
      ? {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "template",
          template: {
            name: effectiveTemplateName,
            language: {
              code: DEFAULT_TEMPLATE_LANGUAGE,
            },
            ...(suppliedTemplateVariables.length > 0
              ? {
                  components: [
                    {
                      type: "body",
                      parameters: suppliedTemplateVariables.map(
                        (value) => ({
                          type: "text",
                          text: value,
                        })
                      ),
                    },
                  ],
                }
              : {}),
          },
        }
      : {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: {
            preview_url: true,
            body: requestedMessage,
          },
        };

    console.log("Sending WhatsApp message:", {
      leadId: lead.id,
      recipient: phone,
      customerServiceWindowOpen,
      messageType: useTemplate ? "template" : "text",
      templateName: useTemplate ? effectiveTemplateName : null,
      latestInboundAt:
        latestInbound?.received_at ||
        latestInbound?.created_at ||
        null,
    });

    const whatsappResponse = await fetch(
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

    let whatsappResult: WhatsAppApiResponse;

    try {
      whatsappResult =
        (await whatsappResponse.json()) as WhatsAppApiResponse;
    } catch {
      whatsappResult = {
        error: {
          message: "Meta returned an invalid or empty response.",
        },
      };
    }

    if (!whatsappResponse.ok) {
      console.error("WhatsApp send error:", {
        status: whatsappResponse.status,
        statusText: whatsappResponse.statusText,
        response: whatsappResult,
        payload: whatsappPayload,
      });

      return NextResponse.json(
        {
          success: false,
          error:
            whatsappResult.error?.message ||
            "WhatsApp could not send the message.",
          details:
            whatsappResult.error?.error_data?.details ||
            whatsappResult.error,
          metaCode: whatsappResult.error?.code,
          metaSubcode: whatsappResult.error?.error_subcode,
          messageType: useTemplate ? "template" : "text",
          templateName: useTemplate
            ? effectiveTemplateName
            : null,
          customerServiceWindowOpen,
        },
        {
          status:
            whatsappResponse.status >= 400 &&
            whatsappResponse.status <= 599
              ? whatsappResponse.status
              : 500,
        }
      );
    }

    const externalMessageId =
      whatsappResult.messages?.[0]?.id || null;
    const sentAt = new Date().toISOString();
    const deliveryStatus = "accepted";

    if (!externalMessageId) {
      console.warn(
        "Meta accepted the request but did not return a WhatsApp message ID.",
        {
          leadId: lead.id,
          recipient: phone,
          response: whatsappResult,
        }
      );
    }

    const leadDisplayName =
      cleanText(lead.full_name) ||
      [lead.first_name, lead.surname]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      "lead";

    const storedMessage = useTemplate
      ? requestedMessage ||
        `WhatsApp template sent: ${effectiveTemplateName}`
      : requestedMessage;

    const whatsappMessagePayload = {
      lead_id: lead.id,
      phone,
      direction: "outbound",

      message_text: storedMessage,
      message: storedMessage,

      whatsapp_message_id: externalMessageId,
      external_message_id: externalMessageId,

      status: deliveryStatus,
      delivery_status: deliveryStatus,

      message_type: useTemplate ? "template" : "text",
      template_name: useTemplate
        ? effectiveTemplateName
        : null,

      profile_name: null,
      sender: phoneNumberId,
      recipient: phone,

      sent_at: sentAt,
      received_at: null,
      delivered_at: null,
      read_at: null,
      failed_at: null,

      status_payload: null,
      status_error: null,

      raw_payload: {
        meta_response: whatsappResult,
        send_context: {
          customer_service_window_open:
            customerServiceWindowOpen,
          latest_inbound_at:
            latestInbound?.received_at ||
            latestInbound?.created_at ||
            null,
          forced_template: forceTemplate,
          requested_template_name:
            requestedTemplateName || null,
          effective_template_name: useTemplate
            ? effectiveTemplateName
            : null,
        },
      },

      created_at: sentAt,
      updated_at: sentAt,
    };

    const {
      data: savedWhatsAppMessage,
      error: whatsappMessageInsertError,
    } = await supabase
      .from("whatsapp_messages")
      .insert(whatsappMessagePayload)
      .select("id")
      .maybeSingle();

    if (whatsappMessageInsertError) {
      console.error("Failed to save whatsapp_messages record:", {
        code: whatsappMessageInsertError.code,
        message: whatsappMessageInsertError.message,
        details: whatsappMessageInsertError.details,
        hint: whatsappMessageInsertError.hint,
        payload: whatsappMessagePayload,
      });
    } else {
      console.log("WHATSAPP MESSAGE SAVED:", {
        id: savedWhatsAppMessage?.id || null,
        leadId: lead.id,
        recipient: phone,
        externalMessageId,
        deliveryStatus,
        messageType: useTemplate ? "template" : "text",
        templateName: useTemplate
          ? effectiveTemplateName
          : null,
        sentAt,
      });
    }

    const leadMessagePayload = {
      lead_id: lead.id,
      channel: "whatsapp",
      direction: "outbound",
      message_type: useTemplate ? "template" : "text",
      template_key: useTemplate
        ? effectiveTemplateName
        : null,
      subject: null,
      message_body: storedMessage,
      external_message_id: externalMessageId,
      sender: phoneNumberId,
      recipient: phone,
      delivery_status: deliveryStatus,
      sent_at: sentAt,
    };

    const { error: leadMessageInsertError } = await supabase
      .from("lead_messages")
      .insert(leadMessagePayload);

    if (leadMessageInsertError) {
      console.warn("lead_messages save skipped or failed:", {
        code: leadMessageInsertError.code,
        message: leadMessageInsertError.message,
        details: leadMessageInsertError.details,
        hint: leadMessageInsertError.hint,
      });
    }

    const currentStatus = cleanText(lead.status);

    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({
        status:
          !currentStatus || currentStatus === "New Lead"
            ? "Contacted"
            : currentStatus,
        updated_at: sentAt,
      })
      .eq("id", lead.id);

    if (leadUpdateError) {
      console.error("Failed to update lead status:", {
        code: leadUpdateError.code,
        message: leadUpdateError.message,
        details: leadUpdateError.details,
        hint: leadUpdateError.hint,
      });
    }

    const { error: activityError } = await supabase
      .from("activities")
      .insert({
        lead_id: lead.id,
        activity_type: "whatsapp_sent",
        description: `WhatsApp ${
          useTemplate
            ? `template ${effectiveTemplateName}`
            : "message"
        } sent to ${leadDisplayName} (${phone}) at ${sentAt}.`,
        created_at: sentAt,
      });

    if (activityError) {
      console.warn("WhatsApp activity was not saved:", {
        code: activityError.code,
        message: activityError.message,
        details: activityError.details,
        hint: activityError.hint,
      });
    }

    return NextResponse.json({
      success: true,
      message: useTemplate
        ? "WhatsApp template sent successfully."
        : "WhatsApp message sent successfully.",
      messageId: externalMessageId,
      recipient: phone,
      leadId: lead.id,
      leadName: leadDisplayName,
      messageType: useTemplate ? "template" : "text",
      templateName: useTemplate
        ? effectiveTemplateName
        : null,
      customerServiceWindowOpen,
      latestInboundAt:
        latestInbound?.received_at ||
        latestInbound?.created_at ||
        null,
      deliveryStatus,
      sentAt,
      localStorage: {
        leadMessagesSaved: !leadMessageInsertError,
        whatsappMessagesSaved:
          !whatsappMessageInsertError,
        leadUpdated: !leadUpdateError,
        activitySaved: !activityError,
      },
    });
  } catch (error) {
    console.error("Send WhatsApp route error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function isWithinLastHours(
  timestamp: string | null | undefined,
  hours: number
): boolean {
  if (!timestamp) return false;

  const parsed = new Date(timestamp).getTime();

  if (!Number.isFinite(parsed)) return false;

  const age = Date.now() - parsed;

  return age >= 0 && age <= hours * 60 * 60 * 1000;
}

function normalizePhoneNumber(value: unknown): string {
  let phone = cleanText(value).replace(/[^\d+]/g, "");

  if (!phone) {
    return "";
  }

  phone = phone.replace(/\D/g, "");

  if (!phone) {
    return "";
  }

  if (phone.startsWith("00")) {
    phone = phone.substring(2);
  }

  if (phone.startsWith("0")) {
    phone = `27${phone.substring(1)}`;
  }

  if (!phone.startsWith("27")) {
    phone = `27${phone}`;
  }

  if (!/^27\d{9}$/.test(phone)) {
    return "";
  }

  return phone;
}
