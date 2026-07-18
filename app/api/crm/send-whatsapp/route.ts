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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SendWhatsAppRequest;

    const leadId = String(body.leadId || "").trim();
    const message = String(body.message || "").trim();

    if (!leadId) {
      return NextResponse.json(
        { error: "Lead ID is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, first_name, last_name, phone, email, service, status")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: "Lead not found." },
        { status: 404 }
      );
    }

    const phone = normalizePhoneNumber(lead.phone);

    if (!phone) {
      return NextResponse.json(
        { error: "The lead does not have a valid phone number." },
        { status: 400 }
      );
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      return NextResponse.json(
        { error: "WhatsApp API environment variables are missing." },
        { status: 500 }
      );
    }

    /*
      Use a template when starting an outbound conversation.
      Use ordinary text only when the customer-service conversation
      is already active.
    */

    const useTemplate = Boolean(body.templateName);

    const payload = useTemplate
      ? {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "template",
          template: {
            name: body.templateName,
            language: {
              code: "en",
            },
            components: body.templateVariables?.length
              ? [
                  {
                    type: "body",
                    parameters: body.templateVariables.map((value) => ({
                      type: "text",
                      text: value,
                    })),
                  },
                ]
              : undefined,
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
      `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("WhatsApp send error:", result);

      return NextResponse.json(
        {
          error:
            result?.error?.message ||
            "WhatsApp could not send the message.",
          details: result,
        },
        { status: response.status }
      );
    }

    const externalMessageId =
      result?.messages?.[0]?.id || null;

    await supabase.from("lead_messages").insert({
      lead_id: lead.id,
      channel: "whatsapp",
      direction: "outbound",
      message_type: useTemplate ? "template" : "text",
      template_key: body.templateName || null,
      message_body: message || `Template: ${body.templateName}`,
      external_message_id: externalMessageId,
      sender: phoneNumberId,
      recipient: phone,
      delivery_status: "sent",
      sent_at: new Date().toISOString(),
    });

    await supabase
      .from("leads")
      .update({
        status: lead.status === "New Lead"
          ? "Contacted"
          : lead.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    await supabase.from("activities").insert({
      lead_id: lead.id,
      activity_type: "whatsapp_sent",
      description: `WhatsApp message sent to ${lead.first_name || "lead"}.`,
    });

    return NextResponse.json({
      success: true,
      messageId: externalMessageId,
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

  if (!phone) return "";

  if (phone.startsWith("0")) {
    phone = `27${phone.substring(1)}`;
  }

  if (!phone.startsWith("27")) {
    phone = `27${phone}`;
  }

  return phone;
}
