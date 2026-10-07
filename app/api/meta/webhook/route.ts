import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const env = (key: string) => process.env[key]?.trim() || "";
const supabase = () => {
  const url = env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase environment variables missing");
  return createClient(url, key, { auth: { persistSession: false } });
};

function validSignature(raw: string, signature: string, secret: string): boolean {
  if (!secret || !signature.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const supplied = signature.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}

function fieldValue(fields: Array<{ name?: string; values?: unknown[] }>, names: string[]) {
  const found = fields.find((field) => names.includes(String(field.name || "").toLowerCase()));
  return String(found?.values?.[0] || "").trim();
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const token = env("META_VERIFY_TOKEN") || env("WHATSAPP_VERIFY_TOKEN");
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) {
    return new NextResponse(p.get("hub.challenge") || "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

async function processLead(leadgenId: string, pageId?: string, formId?: string) {
  const db = supabase();
  const accessToken = env("META_ACCESS_TOKEN") || env("WHATSAPP_ACCESS_TOKEN");
  const from = env("RESEND_FROM_EMAIL");
  const resendKey = env("RESEND_API_KEY");
  if (!accessToken || !from || !resendKey) throw new Error("Meta/Resend configuration missing");

  const graphUrl = new URL(`https://graph.facebook.com/v25.0/${encodeURIComponent(leadgenId)}`);
  graphUrl.searchParams.set("fields", "id,field_data");
  const response = await fetch(graphUrl, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`Meta Graph lead lookup failed (${response.status})`);
  const details = await response.json();
  const fields = Array.isArray(details.field_data) ? details.field_data : [];
  const fullName = fieldValue(fields, ["full_name", "name"]);
  const email = fieldValue(fields, ["email"]).toLowerCase();
  const phone = fieldValue(fields, ["phone_number", "phone", "mobile"]);
  const service = fieldValue(fields, ["service_interest", "programme", "service"]) || "GLP-treatment programme";
  const [firstName, ...surnameParts] = fullName.split(/\s+/).filter(Boolean);
  const surname = surnameParts.join(" ");

  // Meta leadgen_id is the idempotency key. Do not overwrite an existing patient's status.
  const { data: existing, error: lookupError } = await db.from("leads")
    .select("id,invitation_status").eq("meta_lead_id", leadgenId).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.invitation_status === "sent" || existing?.invitation_status === "sending") return;

  let leadId: string;
  let token: string | null = null;
  if (existing) {
    leadId = existing.id;
    // A previously failed invitation has an unrecoverable plaintext token: rotate it.
  } else {
    leadId = "";
  }

  token = `BL-${randomBytes(24).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const payload = {
    bodylab_referral_token_hash: tokenHash,
    bodylab_referral_expires_at: expires,
    invitation_status: "sending",
    invitation_error: null,
  };

  if (existing) {
    const { data, error } = await db.from("leads").update(payload)
      .eq("id", leadId).in("invitation_status", ["failed", "pending"])
      .select("id").maybeSingle();
    if (error) throw error;
    if (!data) return; // Another delivery worker has claimed it.
  } else {
    const { data, error } = await db.from("leads").insert({
      first_name: firstName || fullName || "Meta",
      surname,
      full_name: fullName,
      email,
      phone,
      service_interest: service,
      source: "Meta Lead Form",
      status: "New Lead",
      last_message: "Meta lead form submitted",
      last_message_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      meta_lead_id: leadgenId,
      ...payload,
    }).select("id").single();
    if (error) {
      if (error.code === "23505") return; // Concurrent duplicate webhook.
      throw error;
    }
    leadId = data.id;
  }

  // Event logging is optional; do not let a missing events table block the patient invitation.
  const { error: eventError } = await db.from("meta_lead_events").insert({
    meta_lead_id: leadgenId, page_id: pageId || null, form_id: formId || null,
    raw_payload: { leadgen_id: leadgenId, page_id: pageId, form_id: formId },
    created_at: new Date().toISOString(),
  });
  if (eventError) console.error("Meta event audit logging failed", eventError.message);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await db.from("leads").update({ invitation_status: "failed", invitation_error: "Missing or invalid email" }).eq("id", leadId);
    return;
  }

  const url = `https://symptomai.digital/start?ref=${encodeURIComponent(token)}`;
  const greeting = firstName || "there";
  const subject = "Complete your BodyLab health assessment";
  const message = `Hi ${greeting},\n\nThank you for your interest in BodyLab. Please complete your secure health assessment here:\n${url}\n\nKind regards,\nBodyLab`;
  const resend = new Resend(resendKey);
  const { data, error } = await resend.emails.send({
    from, to: [email], replyTo: env("RESEND_REPLY_TO_EMAIL") || undefined,
    subject, text: message,
    html: `<p>Hi ${escapeHtml(greeting)},</p><p>Thank you for your interest in BodyLab.</p><p><a href="${escapeHtml(url)}">Complete your secure health assessment</a></p><p>Kind regards,<br/>BodyLab</p>`,
    tags: [{ name: "lead_id", value: leadId.replace(/[^a-zA-Z0-9_-]/g, "_") }],
  }, { idempotencyKey: `bodylab-invite-${leadgenId}` });

  if (error) {
    await db.from("leads").update({ invitation_status: "failed", invitation_error: error.message || "Resend error" }).eq("id", leadId);
    throw new Error(`Resend failed: ${error.message}`);
  }

  const sentAt = new Date().toISOString();
  const { error: updateError } = await db.from("leads").update({
    invitation_status: "sent", invitation_sent_at: sentAt,
    invitation_resend_id: data?.id || null, invitation_error: null,
    status: "Contacted", updated_at: sentAt,
  }).eq("id", leadId).eq("invitation_status", "sending");
  if (updateError) throw updateError;

  const { error: logError } = await db.from("lead_messages").insert({
    lead_id: leadId, channel: "email", direction: "outbound", message_type: "email",
    template_key: "symptomai_invitation", subject, message_body: message,
    external_message_id: data?.id || null, sender: from, recipient: email,
    delivery_status: "sent", sent_at: sentAt,
  });
  if (logError) console.error("Email audit logging failed", logError.message);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256") || "", env("META_APP_SECRET"))) {
    return NextResponse.json({ error: "Invalid Meta signature" }, { status: 403 });
  }
  try {
    const body = JSON.parse(raw);
    const changes = (body?.entry || []).flatMap((entry: any) => entry?.changes || []);
    for (const change of changes) {
      const value = change?.value || {};
      if (change?.field !== "leadgen" || !value.leadgen_id) continue;
      await processLead(String(value.leadgen_id), value.page_id, value.form_id);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Meta lead processing failed", error);
    return NextResponse.json({ success: false, error: "Processing failed" }, { status: 500 });
  }
}
