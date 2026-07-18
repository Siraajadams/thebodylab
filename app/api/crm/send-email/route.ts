import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendEmailRequest = {
  leadId?: string;
  subject?: string;
  message?: string;
  templateKey?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SendEmailRequest;

    const leadId = String(body.leadId || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    if (!leadId || !subject || !message) {
      return NextResponse.json(
        {
          error: "Lead ID, subject and message are required.",
        },
        { status: 400 }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!resendApiKey || !fromEmail) {
      return NextResponse.json(
        { error: "Email environment variables are missing." },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();
    const resend = new Resend(resendApiKey);

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, first_name, last_name, email, status")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: "Lead not found." },
        { status: 404 }
      );
    }

    if (!lead.email) {
      return NextResponse.json(
        { error: "The lead does not have an email address." },
        { status: 400 }
      );
    }

    const replyAddress = `lead-${lead.id}@reply.thebodylab.co.za`;

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [lead.email],
      replyTo: replyAddress,
      subject,
      text: message,
      html: messageToHtml(message),
      tags: [
        {
          name: "lead_id",
          value: lead.id,
        },
      ],
    });

    if (error) {
      console.error("Resend send error:", error);

      return NextResponse.json(
        {
          error: error.message || "Email could not be sent.",
        },
        { status: 500 }
      );
    }

    await supabase.from("lead_messages").insert({
      lead_id: lead.id,
      channel: "email",
      direction: "outbound",
      message_type: "email",
      template_key: body.templateKey || null,
      subject,
      message_body: message,
      external_message_id: data?.id || null,
      sender: fromEmail,
      recipient: lead.email,
      delivery_status: "sent",
      sent_at: new Date().toISOString(),
    });

    await supabase
      .from("leads")
      .update({
        status:
          lead.status === "New Lead"
            ? "Contacted"
            : lead.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    await supabase.from("activities").insert({
      lead_id: lead.id,
      activity_type: "email_sent",
      description: `Email sent to ${lead.first_name || "lead"}.`,
    });

    return NextResponse.json({
      success: true,
      emailId: data?.id,
    });
  } catch (error) {
    console.error("Send email route error:", error);

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

function messageToHtml(message: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
      ${escapeHtml(message).replace(/\n/g, "<br />")}
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
