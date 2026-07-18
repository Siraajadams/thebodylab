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

type LeadRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SendEmailRequest;

    const leadId = String(body.leadId || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    const templateKey =
      String(body.templateKey || "").trim() || null;

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
        {
          error:
            "Email environment variables are missing. Check RESEND_API_KEY and RESEND_FROM_EMAIL.",
        },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();
    const resend = new Resend(resendApiKey);

    const { data: rawLead, error: leadError } = await supabase
      .from("leads")
      .select("id, first_name, last_name, email, status")
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

    const lead =
      rawLead as unknown as LeadRecord | null;

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found." },
        { status: 404 }
      );
    }

    const leadEmail = String(lead.email || "").trim();

    if (!leadEmail) {
      return NextResponse.json(
        {
          error: "The lead does not have an email address.",
        },
        { status: 400 }
      );
    }

    const replyAddress =
      `lead-${lead.id}@reply.thebodylab.co.za`;

    const { data: emailData, error: emailError } =
      await resend.emails.send({
        from: fromEmail,
        to: [leadEmail],
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

    if (emailError) {
      console.error("Resend send error:", emailError);

      return NextResponse.json(
        {
          error:
            emailError.message ||
            "Email could not be sent.",
        },
        { status: 500 }
      );
    }

    const sentAt = new Date().toISOString();

    const { error: messageInsertError } = await supabase
      .from("lead_messages")
      .insert({
        lead_id: lead.id,
        channel: "email",
        direction: "outbound",
        message_type: "email",
        template_key: templateKey,
        subject,
        message_body: message,
        external_message_id: emailData?.id || null,
        sender: fromEmail,
        recipient: leadEmail,
        delivery_status: "sent",
        sent_at: sentAt,
      });

    if (messageInsertError) {
      console.error(
        "Failed to save outbound email:",
        messageInsertError
      );
    }

    const nextStatus =
      lead.status === "New Lead"
        ? "Contacted"
        : lead.status;

    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({
        status: nextStatus,
        updated_at: sentAt,
      })
      .eq("id", lead.id);

    if (leadUpdateError) {
      console.error(
        "Failed to update lead:",
        leadUpdateError
      );
    }

    const { error: activityError } = await supabase
      .from("activities")
      .insert({
        lead_id: lead.id,
        activity_type: "email_sent",
        description: `Email sent to ${
          lead.first_name || "lead"
        }.`,
      });

    if (activityError) {
      console.error(
        "Failed to save email activity:",
        activityError
      );
    }

    return NextResponse.json({
      success: true,
      emailId: emailData?.id || null,
      recipient: leadEmail,
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
