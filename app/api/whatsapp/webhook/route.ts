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

    await supabase.from("webhook_events").insert({
      source: "whatsapp",
      event_type: "message",
      raw_payload: body,
    });

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    if (!message) {
      return NextResponse.json({ success: true });
    }

    const phone = message?.from || "";
    const messageText = message?.text?.body || "";
    const profileName = contact?.profile?.name || "";

    const nameParts = profileName.trim().split(" ");
    const first_name = nameParts[0] || "WhatsApp";
    const surname = nameParts.slice(1).join(" ") || "Lead";

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        first_name,
        surname,
        full_name: profileName || `${first_name} ${surname}`,
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

    await supabase.from("whatsapp_messages").insert({
      lead_id: lead?.id || null,
      phone,
      direction: "inbound",
    });

    if (
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_ACCESS_TOKEN &&
      phone
    ) {
      await fetch(
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
