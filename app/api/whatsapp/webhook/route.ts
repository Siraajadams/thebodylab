import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const { error: webhookError } = await supabase
      .from("webhook_events")
      .insert({
        source: "whatsapp",
        event_type: "message",
        raw_payload: body,
      });

    if (webhookError) {
      console.error("WEBHOOK EVENT INSERT ERROR:", webhookError);
    }

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    if (!message) {
      return NextResponse.json({ success: true, note: "No message object" });
    }

    const phone = message?.from || "";
    const messageText = message?.text?.body || "";
    const profileName = contact?.profile?.name || "";

    const nameParts = profileName.trim().split(" ").filter(Boolean);
    const first_name = nameParts[0] || "WhatsApp";
    const surname = nameParts.slice(1).join(" ") || "Lead";
    const full_name = profileName || `${first_name} ${surname}`;

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        first_name,
        surname,
        full_name,
        phone,
        email: null,
        service_interest: "GP Weight Loss Consultation",
        source: "WhatsApp",
        notes: messageText,
        status: "New Lead",
      })
      .select("id")
      .single();

    if (leadError) {
      console.error("LEAD INSERT ERROR:", leadError);
    }

    const { error: whatsappMsgError } = await supabase
      .from("whatsapp_messages")
      .insert({
        lead_id: lead?.id || null,
        phone,
        direction: "inbound",
      });

    if (whatsappMsgError) {
      console.error("WHATSAPP MESSAGE INSERT ERROR:", whatsappMsgError);
    }

    if (lead?.id) {
      const { error: activityError } = await supabase
        .from("activities")
        .insert({
          lead_id: lead.id,
          activity: "WhatsApp lead created",
          activity_type: "lead_created",
        });

      if (activityError) {
        console.error("ACTIVITY INSERT ERROR:", activityError);
      }
    }

    if (
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_ACCESS_TOKEN &&
      phone
    ) {
      const metaResponse = await fetch(
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
            to: phone,
            type: "text",
            text: {
              preview_url: false,
              body:
                "Thank you for contacting BodyLab. We received your message. A consultant will contact you shortly about the GP Weight Loss Consultation.",
            },
          }),
        }
      );

      const metaResult = await metaResponse.json();

      if (!metaResponse.ok) {
        console.error("GRAPH API ERROR:", metaResult);
      } else {
        console.log("WHATSAPP REPLY SENT:", metaResult);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WEBHOOK ERROR:", error);

    return NextResponse.json({
      success: true,
      warning: String(error),
    });
  }
}
