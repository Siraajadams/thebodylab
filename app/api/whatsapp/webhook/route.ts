import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendWhatsAppText(to: string, body: string) {
  if (
    !process.env.WHATSAPP_PHONE_NUMBER_ID ||
    !process.env.WHATSAPP_ACCESS_TOKEN ||
    !to
  ) {
    console.log("WHATSAPP SEND SKIPPED");
    return;
  }

  const res = await fetch(
    `https://graph.facebook.com/v25.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          preview_url: false,
          body,
        },
      }),
    }
  );

  const result = await res.json().catch(() => null);
  console.log("WHATSAPP SEND RESULT:", res.status, result);
}

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function mapService(input: string) {
  const text = input.toLowerCase();

  if (text === "1" || text.includes("weight") || text.includes("glp")) {
    return "GP Weight Loss Consultation";
  }

  if (text === "2" || text.includes("general")) {
    return "General Enquiry";
  }

  return "General Enquiry";
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge || "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("WHATSAPP WEBHOOK RECEIVED");

    await supabase.from("webhook_events").insert({
      source: "whatsapp",
      event_type: "message",
      raw_payload: body,
    });

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return NextResponse.json({ success: true });
    }

    const phone = message?.from || "";
    const messageText = cleanText(
      message?.text?.body ||
        message?.button?.text ||
        message?.interactive?.button_reply?.title ||
        message?.interactive?.list_reply?.title ||
        ""
    );

    const whatsappMessageId = message?.id || null;

    if (!phone || !messageText) {
      return NextResponse.json({ success: true });
    }

    let { data: session } = await supabase
      .from("whatsapp_lead_sessions")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (!session || session.completed) {
      const { data: newSession } = await supabase
        .from("whatsapp_lead_sessions")
        .upsert(
          {
            phone,
            step: "awaiting_first_name",
            completed: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "phone" }
        )
        .select()
        .single();

      session = newSession;

      await sendWhatsAppText(
        phone,
        "Welcome to BodyLab. Please reply with your first name."
      );

      return NextResponse.json({ success: true, step: "started" });
    }

    if (session.step === "awaiting_first_name") {
      await supabase
        .from("whatsapp_lead_sessions")
        .update({
          first_name: messageText,
          step: "awaiting_surname",
          updated_at: new Date().toISOString(),
        })
        .eq("phone", phone);

      await sendWhatsAppText(phone, "Thank you. Please reply with your surname.");

      return NextResponse.json({ success: true, step: "surname" });
    }

    if (session.step === "awaiting_surname") {
      await supabase
        .from("whatsapp_lead_sessions")
        .update({
          surname: messageText,
          step: "awaiting_whatsapp_number",
          updated_at: new Date().toISOString(),
        })
        .eq("phone", phone);

      await sendWhatsAppText(
        phone,
        "Please confirm your WhatsApp number, for example: 0827427073."
      );

      return NextResponse.json({ success: true, step: "whatsapp_number" });
    }

    if (session.step === "awaiting_whatsapp_number") {
      await supabase
        .from("whatsapp_lead_sessions")
        .update({
          whatsapp_number: messageText,
          step: "awaiting_service",
          updated_at: new Date().toISOString(),
        })
        .eq("phone", phone);

      await sendWhatsAppText(
        phone,
        "Which service are you interested in?\n\nReply 1 for GP Weight Loss Consultation\nReply 2 for General Enquiry"
      );

      return NextResponse.json({ success: true, step: "service" });
    }

    if (session.step === "awaiting_service") {
      const serviceInterest = mapService(messageText);

      const fullName = `${session.first_name || "WhatsApp"} ${
        session.surname || "Lead"
      }`.trim();

      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      let leadId = existingLead?.id || null;

      if (!leadId) {
        const { data: lead, error: leadError } = await supabase
          .from("leads")
          .insert({
            first_name: session.first_name || "WhatsApp",
            surname: session.surname || "Lead",
            full_name: fullName,
            phone,
            email: null,
            service_interest: serviceInterest,
            source: "WhatsApp",
            status: "New Lead",
            notes: `WhatsApp lead form completed. Service: ${serviceInterest}`,
            whatsapp_id: phone,
            last_message: messageText,
            last_message_at: new Date().toISOString(),
            priority: "Normal",
          })
          .select("id")
          .single();

        if (leadError) {
          console.error("LEAD INSERT ERROR:", JSON.stringify(leadError));
        } else {
          leadId = lead?.id || null;
        }
      } else {
        await supabase
          .from("leads")
          .update({
            first_name: session.first_name || "WhatsApp",
            surname: session.surname || "Lead",
            full_name: fullName,
            service_interest: serviceInterest,
            source: "WhatsApp",
            status: "New Lead",
            notes: `WhatsApp lead form completed. Service: ${serviceInterest}`,
            whatsapp_id: phone,
            last_message: messageText,
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", leadId);
      }

      await supabase.from("whatsapp_messages").insert({
        lead_id: leadId,
        phone,
        direction: "inbound",
        message_text: messageText,
        whatsapp_message_id: whatsappMessageId,
        raw_payload: body,
      });

      if (leadId) {
        await supabase.from("activities").insert({
          lead_id: leadId,
          activity: `WhatsApp lead form completed: ${serviceInterest}`,
          activity_type: "whatsapp_lead_form",
        });
      }

      await supabase
        .from("whatsapp_lead_sessions")
        .update({
          service_interest: serviceInterest,
          completed: true,
          step: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("phone", phone);

      await sendWhatsAppText(
        phone,
        `Thank you ${session.first_name || ""}. Your BodyLab enquiry for ${serviceInterest} has been captured. A consultant will contact you shortly.`
      );

      return NextResponse.json({ success: true, completed: true, lead_id: leadId });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("WEBHOOK ERROR:", error?.message || error);

    return NextResponse.json({
      success: true,
      warning: error?.message || String(error),
    });
  }
}
