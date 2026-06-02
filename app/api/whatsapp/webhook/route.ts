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

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new Response(challenge || "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("WHATSAPP WEBHOOK RECEIVED");

    // Save raw webhook
    await supabase
      .from("webhook_events")
      .insert({
        source: "whatsapp",
        event_type: "message",
        raw_payload: body,
      });

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    // Ignore status updates etc
    if (!message) {
      return NextResponse.json({ success: true });
    }

    const whatsappNumber = message.from || "";
    const text = message.text?.body || "";
    const profileName = contact?.profile?.name || "";

    const nameParts = profileName.split(" ");

    const first_name =
      nameParts[0] || "WhatsApp";

    const surname =
      nameParts.slice(1).join(" ") || "Lead";

    // Save lead
    const { error } = await supabase
      .from("leads")
      .insert({
        first_name,
        surname,
        full_name: profileName,
        phone: whatsappNumber,
        source: "WhatsApp",
        service_interest: "General Enquiry",
        notes: text,
        status: "New Lead",
      });

    if (error) {
      console.error("LEAD INSERT ERROR:", error);
    }

    // Send auto reply
    if (
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_ACCESS_TOKEN
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
            to: whatsappNumber,
            type: "text",
            text: {
              body:
                "Thank you for contacting BodyLab. One of our consultants will contact you shortly.",
            },
          }),
        }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("WEBHOOK ERROR:", error);

    // Never return 500 to Meta
    return NextResponse.json({
      success: true,
      warning: error?.message,
    });
  }
}
