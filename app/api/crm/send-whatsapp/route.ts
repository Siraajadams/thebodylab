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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SendWhatsAppRequest;

    const leadId = String(body.leadId || "").trim();
    const message = String(body.message || "").trim();
    const templateName = String(body.templateName || "").trim();

    const templateVariables = Array.isArray(body.templateVariables)
      ? body.templateVariables
          .map((value) => String(value || "").trim())
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

    /*
      `as any` is used because generated Supabase database
      types may not yet include all CRM columns.
    */
    const supabase = getSupabaseAdmin() as any;

    /*
      IMPORTANT:
      The leads table uses:
      - surname, not last_name
      - service_interest, not service
    */
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
          leadId,
        },
        { status: 500 }
      );
    }

    const lead = rawLead as LeadRecord | null;

    if (!lead) {
      console.error("Lead not found:", {
        leadId,
      });

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
          error: "The lead does not have a valid phone number.",
          leadId: lead.id,
        },
        { status: 400 }
      );
    }

    const accessToken = String(
      process.env.WHATSAPP_ACCESS_TOKEN || ""
    ).trim();

    const phoneNumberId = String(
      process.env.WHATSAPP_PHONE_NUMBER_ID || ""
    ).trim();

    const graphApiVersion = String(
      process.env.META_GRAPH_API_VERSION || "v23.0"
    ).trim();

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

    const whatsappPayload = useTemplate
      ? {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "template",
          template: {
            name: templateName,
            language: {
              code: "en",
            },
            ...(templateVariables.length > 0
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
          to: phone,
          type: "text",
          text: {
            preview_url: true,
            body: message,
          },
        };

    console.log("Sending WhatsApp message:", {
      leadId: lead.id,
      recipient: phone,
      messageType: useTemplate ? "template" : "text",
      templateName: useTemplate ? templateName : null,
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

    const leadDisplayName =
      String(lead.full_name || "").trim() ||
      [lead.first_name, lead.surname]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      "lead";

    const storedMessage = useTemplate
      ? message || `WhatsApp template sent: ${templateName}`
      : message;

    /*
      Save the message in the CRM conversation history.
      Failure to save locally must not falsely report that Meta
      failed to send the WhatsApp message.
    */
    const leadMessagePayload = {
      lead_id: lead.id,
      channel: "whatsapp",
      direction: "outbound",
      message_type: useTemplate ? "template" : "text",
      template_key: useTemplate ? templateName : null,
      subject: null,
      message_body: storedMessage,
      external_message_id: externalMessageId,
      sender: phoneNumberId,
      recipient: phone,
      delivery_status: "sent",
      sent_at: sentAt,
    };

    const { error: messageInsertError } = await supabase
      .from("lead_messages")
      .insert(leadMessagePayload);

    if (messageInsertError) {
      console.error("Failed to save lead_messages record:", {
        code: messageInsertError.code,
        message: messageInsertError.message,
        details: messageInsertError.details,
        hint: messageInsertError.hint,
      });
    }

    /*
      Also save the outbound message in whatsapp_messages,
      which is the table already receiving your WhatsApp webhook data.
    */
    const whatsappMessagePayload = {
      lead_id: lead.id,
      phone,
      direction: "outbound",
      message_text: storedMessage,
      message_type: useTemplate ? "template" : "text",
      external_message_id: externalMessageId,
      delivery_status: "sent",
      raw_payload: whatsappResult,
      created_at: sentAt,
    };

    const { error: whatsappMessageInsertError } = await supabase
      .from("whatsapp_messages")
      .insert(whatsappMessagePayload);

    if (whatsappMessageInsertError) {
      console.error("Failed to save whatsapp_messages record:", {
        code: whatsappMessageInsertError.code,
        message: whatsappMessageInsertError.message,
        details: whatsappMessageInsertError.details,
        hint: whatsappMessageInsertError.hint,
      });
    }

    const currentStatus = String(lead.status || "").trim();

    const leadUpdatePayload = {
      status:
        !currentStatus || currentStatus === "New Lead"
          ? "Contacted"
          : currentStatus,
      updated_at: sentAt,
    };

    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update(leadUpdatePayload)
      .eq("id", lead.id);

    if (leadUpdateError) {
      console.error("Failed to update lead status:", {
        code: leadUpdateError.code,
        message: leadUpdateError.message,
        details: leadUpdateError.details,
        hint: leadUpdateError.hint,
      });
    }

    const activityPayload = {
      lead_id: lead.id,
      activity_type: "whatsapp_sent",
      description: `WhatsApp message sent to ${leadDisplayName}.`,
      created_at: sentAt,
    };

    const { error: activityError } = await supabase
      .from("activities")
      .insert(activityPayload);

    if (activityError) {
      console.error("Failed to save WhatsApp activity:", {
        code: activityError.code,
        message: activityError.message,
        details: activityError.details,
        hint: activityError.hint,
      });
    }

    return NextResponse.json({
      success: true,
      message: "WhatsApp message sent successfully.",
      messageId: externalMessageId,
      recipient: phone,
      leadId: lead.id,
      leadName: leadDisplayName,
      messageType: useTemplate ? "template" : "text",
      localStorage: {
        leadMessagesSaved: !messageInsertError,
        whatsappMessagesSaved: !whatsappMessageInsertError,
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

function normalizePhoneNumber(value: unknown): string {
  let phone = String(value || "")
    .trim()
    .replace(/[^\d+]/g, "");

  if (!phone) {
    return "";
  }

  /*
    Remove the international + symbol because Meta expects
    digits only.
  */
  phone = phone.replace(/\D/g, "");

  if (!phone) {
    return "";
  }

  /*
    Convert:
    0027618789393 -> 27618789393
  */
  if (phone.startsWith("00")) {
    phone = phone.substring(2);
  }

  /*
    Convert:
    0618789393 -> 27618789393
  */
  if (phone.startsWith("0")) {
    phone = `27${phone.substring(1)}`;
  }

  /*
    Your CRM currently serves South African leads.
    A local number missing the country code receives 27.
  */
  if (!phone.startsWith("27")) {
    phone = `27${phone}`;
  }

  /*
    A South African WhatsApp number should normally contain
    11 digits, including the country code.
  */
  if (!/^27\d{9}$/.test(phone)) {
    return "";
  }

  return phone;
}
