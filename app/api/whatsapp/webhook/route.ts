import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function splitName(profileName: string) {
  const clean = profileName?.trim() || "";
  const parts = clean.split(" ").filter(Boolean);

  return {
    first_name: parts[0] || "WhatsApp",
    surname: parts.slice(1).join(" ") || "Lead",
    full_name: clean || "WhatsApp Lead",
  };
}

async function sendWhatsAppReply(to: string) {
  if (
    !process.env.WHATSAPP_PHONE_NUMBER_ID ||
    !process.env.WHATSAPP_ACCESS_TOKEN ||
    !to
  ) {
    console.log("WHATSAPP REPLY SKIPPED: missing env variables or phone");
    return;
  }

  const response = await fetch(
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
          body:
            "Thank you for contacting BodyLab. We received your message. A consultant will contact you shortly about the GP Weight Loss Consultation.",
        },
      }),
    }
  );

  const result = await response.json().catch(() => null);
  console.log("WHATSAPP REPLY RESULT:", response.status, result);
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
    const contact = value?.contacts?.[0];

    if (!message) {
      console.log("NO MESSAGE EVENT - RETURNING SUCCESS");
      return NextResponse.json({ success: true });
    }

    const phone = message?.from || "";
    const messageText =
      message?.text?.body ||
      message?.button?.text ||
      message?.interactive?.button_reply?.title ||
      message?.interactive?.list_reply?.title ||
      "EMPTY";

    const profileName = contact?.profile?.name || "";
    const whatsappMessageId = message?.id || null;

    const { first_name, surname, full_name } = splitName(profileName);

    console.log("INBOUND WHATSAPP:", {
      phone,
      messageText,
      profileName,
      whatsappMessageId,
    });

    const { data: existingLead, error: existingLeadError } = await supabase
      .from("leads")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (existingLeadError) {
      console.error("EXISTING LEAD CHECK ERROR:", JSON.stringify(existingLeadError));
    }

    let leadId = existingLead?.id || null;

    if (!leadId) {
      const leadPayload = {
        first_name,
        surname,
        full_name,
        phone,
        email: null,
        service_interest:
          messageText.toLowerCase().includes("weight") ||
          messageText.toLowerCase().includes("glp")
            ? "GP Weight Loss Consultation"
            : "General Enquiry",
        source: "WhatsApp",
        notes: messageText,
        status: "New Lead",
        whatsapp_id: phone,
        last_message: messageText,
        last_message_at: new Date().toISOString(),
        priority: "Normal",
      };

      console.log("LEAD PAYLOAD:", leadPayload);

      const { data: newLead, error: leadError } = await supabase
        .from("leads")
        .insert(leadPayload)
        .select("id")
        .single();

      if (leadError) {
        console.error("LEAD INSERT ERROR:", JSON.stringify(leadError));
      } else {
        leadId = newLead?.id || null;
        console.log("LEAD CREATED:", newLead);
      }
    } else {
      const { error: updateLeadError } = await supabase
        .from("leads")
        .update({
          notes: messageText,
          last_message: messageText,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);

      if (updateLeadError) {
        console.error("LEAD UPDATE ERROR:", JSON.stringify(updateLeadError));
      } else {
        console.log("EXISTING LEAD UPDATED:", leadId);
      }
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
        activity: `WhatsApp message received: ${messageText}`,
        activity_type: "whatsapp_message",
      });
    }

    await sendWhatsAppReply(phone);

    return NextResponse.json({ success: true, lead_id: leadId });
  } catch (error: any) {
    console.error("WEBHOOK ERROR:", error?.message || error);

    return NextResponse.json({
      success: true,
      warning: error?.message || String(error),
    });
  }
}
