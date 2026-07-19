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
  last_name: string | null;
  phone: string | null;
  email: string | null;
  service: string | null;
  status: string | null;
};

type WhatsAppApiResponse = {
  messages?: Array<{
    id?: string;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SendWhatsAppRequest;

    const leadId = String(body.leadId || "").trim();
    const message = String(body.message || "").trim();
    const templateName = String(body.templateName || "").trim();
    const templateVariables = Array.isArray(body.templateVariables)
      ? body.templateVariables.map((value) => String(value || "").trim())
      : [];

    if (!leadId) {
      return NextResponse.json(
        { error: "Lead ID is required." },
        { status: 400 }
      );
    }

    const useTemplate = Boolean(templateName);

    if (!useTemplate && !message) {
      return NextResponse.json(
        {
          error:
            "A WhatsApp message or approved template name is required.",
        },
        { status: 400 }
      );
    }

    /*
      `as any` is used because the project's generated Supabase
      database types do not yet include all fields in lead_messages
      and activities.
    */
    const supabase = getSupabaseAdmin() as any;

    const { data: rawLead, error: leadError } = await supabase
      .from("leads")
      .select(
        "id, first_name, last_name, phone, email, service, status"
      )
      .eq("id", leadId)
      .maybeSingle();

    if (leadError) {
      console.error("Lead lookup error:", leadError);

      return NextResponse.json(
        {
          error: "Unable to retrieve the lead.",
          details: leadError.message,
        },
        { status: 500 }
      );
    }

    const lead = rawLead as LeadRecord | null;

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found." },
        { status: 404 }
      );
    }

    const phone = normalizePhoneNumber(lead.phone);

    if (!phone) {
      return NextResponse.json(
        {
          error: "The lead does not have a valid phone number.",
        },
        { status: 400 }
      );
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const graphApiVersion =
      process.env.META_GRAPH_API_VERSION || "v23.0";

    if (!accessToken || !phoneNumberId) {
      return NextResponse.json(
        {
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

    const result =
      (await response.json()) as WhatsAppApiResponse;

    if (!response.ok) {
      console.error("WhatsApp send error:", result);

      return NextResponse.json(
        {
          error:
            result.error?.message ||
            "WhatsApp could not send the message.",
          details: result,
        },
        { status: response.status }
      );
    }

    const externalMessageId =
      result.messages?.[0]?.id || null;

    const sentAt = new Date().toISOString();

    const storedMessage = useTemplate
      ? message ||
        `WhatsApp template sent: ${templateName}`
      : message;

    const messagePayload = {
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
      .insert(messagePayload);

    if (messageInsertError) {
      console.error(
        "Failed to save outbound WhatsApp message:",
        messageInsertError
      );
    }

    const leadUpdatePayload = {
      status:
        lead.status === "New Lead"
          ? "Contacted"
          : lead.status,
      updated_at: sentAt,
    };

    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update(leadUpdatePayload)
      .eq("id", lead.id);

    if (leadUpdateError) {
      console.error(
        "Failed to update lead status:",
        leadUpdateError
      );
    }

    const activityPayload = {
      lead_id: lead.id,
      activity_type: "whatsapp_sent",
      description: `WhatsApp message sent to ${
        lead.first_name || "lead"
      }.`,
    };

    const { error: activityError } = await supabase
      .from("activities")
      .insert(activityPayload);

    if (activityError) {
      console.error(
        "Failed to save WhatsApp activity:",
        activityError
      );
    }

    return NextResponse.json({
      success: true,
      messageId: externalMessageId,
      recipient: phone,
      messageType: useTemplate ? "template" : "text",
    });
  } catch (error) {
    console.error("Send WhatsApp route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}

function normalizePhoneNumber(value: unknown) {
  let phone = String(value || "").replace(/\D/g, "");

  if (!phone) {
    return "";
  }

  if (phone.startsWith("00")) {
    phone = phone.substring(2);
  }

  if (phone.startsWith("0")) {
    phone = `27${phone.substring(1)}`;
  } else if (!phone.startsWith("27")) {
    phone = `27${phone}`;
  }

  return phone;
}
