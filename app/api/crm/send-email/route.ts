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
  first_name?: string | null;
  surname?: string | null;
  full_name?: string | null;
  email?: string | null;
  status?: string | null;
  service_interest?: string | null;
  [key: string]: unknown;
};

type ResendErrorLike = {
  message?: string;
  name?: string;
  statusCode?: number;
};

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "/api/crm/send-email",
    message: "The email route is available. Use POST to send an email.",
    environment: {
      resendApiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
      resendFromEmailConfigured: Boolean(
        process.env.RESEND_FROM_EMAIL
      ),
      resendReplyToConfigured: Boolean(
        process.env.RESEND_REPLY_TO_EMAIL
      ),
      supabaseUrlConfigured: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
          process.env.SUPABASE_URL
      ),
      supabaseServiceRoleConfigured: Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SendEmailRequest;

    const leadId = String(body.leadId || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    const templateKey =
      String(body.templateKey || "").trim() || null;

    console.log("Send email request:", {
      leadId,
      subjectProvided: Boolean(subject),
      messageProvided: Boolean(message),
      templateKey,
    });

    if (!leadId) {
      return NextResponse.json(
        {
          success: false,
          error: "Lead ID is required.",
        },
        { status: 400 }
      );
    }

    if (!subject) {
      return NextResponse.json(
        {
          success: false,
          error: "Email subject is required.",
        },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: "Email message is required.",
        },
        { status: 400 }
      );
    }

    const resendApiKey = String(
      process.env.RESEND_API_KEY || ""
    ).trim();

    const fromEmail = String(
      process.env.RESEND_FROM_EMAIL || ""
    ).trim();

    const replyToEmail = String(
      process.env.RESEND_REPLY_TO_EMAIL ||
        process.env.RESEND_FROM_EMAIL ||
        ""
    ).trim();

    if (!resendApiKey || !fromEmail) {
      console.error("Email environment variables missing:", {
        hasResendApiKey: Boolean(resendApiKey),
        hasFromEmail: Boolean(fromEmail),
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "Email environment variables are missing. Check RESEND_API_KEY and RESEND_FROM_EMAIL.",
        },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin() as any;
    const resend = new Resend(resendApiKey);

    /*
      select("*") avoids PostgreSQL error 42703 when the
      deployed database column names differ from older code.
    */
    const { data: rawLead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (leadError) {
      console.error("Email lead lookup error:", {
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
          hint: leadError.hint,
          leadId,
        },
        { status: 500 }
      );
    }

    const lead = rawLead as LeadRecord | null;

    if (!lead) {
      console.error("Email lead not found:", {
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

    const leadEmail = normalizeEmail(lead.email);

    if (!leadEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "The lead does not have a valid email address.",
          leadId: lead.id,
        },
        { status: 400 }
      );
    }

    const leadName =
      String(lead.full_name || "").trim() ||
      [lead.first_name, lead.surname]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      "Lead";

    console.log("Sending BodyLab email:", {
      leadId: lead.id,
      leadName,
      recipient: leadEmail,
      fromEmail,
      replyToEmail,
      subject,
    });

    const { data: emailData, error: emailError } =
      await resend.emails.send({
        from: fromEmail,
        to: [leadEmail],
        replyTo: replyToEmail || undefined,
        subject,
        text: message,
        html: createEmailHtml({
          leadName,
          subject,
          message,
        }),
        tags: [
          {
            name: "lead_id",
            value: sanitizeTagValue(lead.id),
          },
          ...(templateKey
            ? [
                {
                  name: "template_key",
                  value: sanitizeTagValue(templateKey),
                },
              ]
            : []),
        ],
      });

    if (emailError) {
      const resendError = emailError as ResendErrorLike;

      console.error("Resend email error:", {
        leadId: lead.id,
        recipient: leadEmail,
        error: resendError,
      });

      return NextResponse.json(
        {
          success: false,
          error:
            resendError.message ||
            "Email could not be sent through Resend.",
          details: resendError,
        },
        { status: resendError.statusCode || 500 }
      );
    }

    const emailId = emailData?.id || null;
    const sentAt = new Date().toISOString();

    /*
      Save to lead_messages, but do not treat a local
      database logging failure as an email delivery failure.
    */
    const messagePayload = {
      lead_id: lead.id,
      channel: "email",
      direction: "outbound",
      message_type: "email",
      template_key: templateKey,
      subject,
      message_body: message,
      external_message_id: emailId,
      sender: fromEmail,
      recipient: leadEmail,
      delivery_status: "sent",
      sent_at: sentAt,
    };

    const { error: messageInsertError } = await supabase
      .from("lead_messages")
      .insert(messagePayload);

    if (messageInsertError) {
      console.error("Failed to save outbound email:", {
        code: messageInsertError.code,
        message: messageInsertError.message,
        details: messageInsertError.details,
        hint: messageInsertError.hint,
      });
    }

    const currentStatus = String(lead.status || "").trim();

    const nextStatus =
      !currentStatus || currentStatus === "New Lead"
        ? "Contacted"
        : currentStatus;

    const leadUpdatePayload = {
      status: nextStatus,
      updated_at: sentAt,
    };

    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update(leadUpdatePayload)
      .eq("id", lead.id);

    if (leadUpdateError) {
      console.error("Failed to update lead after email:", {
        code: leadUpdateError.code,
        message: leadUpdateError.message,
        details: leadUpdateError.details,
        hint: leadUpdateError.hint,
      });
    }

    const activityPayload = {
      lead_id: lead.id,
      activity_type: "email_sent",
      description: `Email sent to ${leadName}.`,
      created_at: sentAt,
    };

    const { error: activityError } = await supabase
      .from("activities")
      .insert(activityPayload);

    if (activityError) {
      console.error("Failed to save email activity:", {
        code: activityError.code,
        message: activityError.message,
        details: activityError.details,
        hint: activityError.hint,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Email sent successfully.",
      emailId,
      recipient: leadEmail,
      leadId: lead.id,
      leadName,
      localStorage: {
        messageSaved: !messageInsertError,
        leadUpdated: !leadUpdateError,
        activitySaved: !activityError,
      },
    });
  } catch (error) {
    console.error("Send email route error:", error);

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

function normalizeEmail(value: unknown): string {
  const email = String(value || "").trim().toLowerCase();

  if (!email) {
    return "";
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailPattern.test(email) ? email : "";
}

function createEmailHtml({
  leadName,
  subject,
  message,
}: {
  leadName: string;
  subject: string;
  message: string;
}) {
  const safeLeadName = escapeHtml(leadName);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(
    /\r?\n/g,
    "<br />"
  );

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <title>${safeSubject}</title>
      </head>

      <body
        style="
          margin:0;
          padding:0;
          background:#f3f4f6;
          font-family:Arial,Helvetica,sans-serif;
          color:#1f2937;
        "
      >
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="background:#f3f4f6;padding:24px 12px;"
        >
          <tr>
            <td align="center">
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  max-width:640px;
                  background:#ffffff;
                  border-radius:14px;
                  overflow:hidden;
                  box-shadow:0 4px 16px rgba(0,0,0,0.08);
                "
              >
                <tr>
                  <td
                    style="
                      padding:24px 28px;
                      background:#064e3b;
                      color:#ffffff;
                    "
                  >
                    <div
                      style="
                        font-size:24px;
                        font-weight:700;
                        margin-bottom:4px;
                      "
                    >
                      BodyLab
                    </div>

                    <div
                      style="
                        font-size:14px;
                        opacity:0.9;
                      "
                    >
                      Weight Management Support
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:30px 28px;">
                    <h1
                      style="
                        margin:0 0 20px;
                        font-size:22px;
                        line-height:1.3;
                        color:#111827;
                      "
                    >
                      ${safeSubject}
                    </h1>

                    <div
                      style="
                        font-size:16px;
                        line-height:1.7;
                        color:#374151;
                      "
                    >
                      ${safeMessage}
                    </div>
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding:18px 28px;
                      border-top:1px solid #e5e7eb;
                      font-size:12px;
                      line-height:1.5;
                      color:#6b7280;
                    "
                  >
                    This email was sent to ${safeLeadName}
                    following an enquiry submitted to BodyLab.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeTagValue(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 256);
}
