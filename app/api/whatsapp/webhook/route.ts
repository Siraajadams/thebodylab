import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
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

    // 1. Save raw webhook event
    const { error: webhookError } = await supabase
      .from("webhook_events")
      .insert({
        source: "whatsapp",
        event_type: "messages",
        raw_payload: body,
      });

    if (webhookError) {
      console.error("Webhook event insert error:", webhookError);
    }

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    if (!message) {
      return NextResponse.json({ success: true });
    }

    const whatsappNumber = message?.from || "";
    const text = message?.text?.body || "";
    const profileName = contact?.profile?.name || "";

    // 2. Save WhatsApp message
    const { error: messageError } = await supabase
      .from("whatsapp_messages")
      .insert({
        phone: whatsappNumber,
        direction: "inbound",
        raw_payload: body,
      });

    if (messageError) {
      console.error("WhatsApp message insert error:", messageError);
    }

    // 3. Extract lead info
    let first_name = "";
    let surname = "";
    let service_interest = "GP Weight Loss Consultation";

    const firstNameMatch = text.match(/name\s*:\s*(.*)/i);
    const surnameMatch = text.match(/surname\s*:\s*(.*)/i);
    const serviceMatch = text.match(/service\s*:\s*(.*)/i);

    first_name =
      firstNameMatch?.[1]?.trim() ||
      profileName.split(" ")[0] ||
      "WhatsApp";

    surname =
      surnameMatch?.[1]?.trim() ||
      profileName.split(" ").slice(1).join(" ") ||
      "Lead";

    service_interest =
      serviceMatch?.[1]?.trim() ||
      service_interest;

    // 4. Save lead
    const { error: leadError } = await supabase
      .from("leads")
      .insert({
        first_name,
        surname,
        full_name: `${first_name} ${surname}`.trim(),
        phone: whatsappNumber,
        email: null,
        service_interest,
        source: "WhatsApp",
        notes: text,
        status: "New Lead",
      });

    if (leadError) {
      console.error("Lead insert error:", leadError);
    }

    // 5. Auto-reply to WhatsApp
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (accessToken && phoneNumberId && whatsappNumber) {
      await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: whatsappNumber,
          type: "text",
          text: {
            body:
              "Thank you for contacting BodyLab. Please reply in this format:\n\nName: \nSurname: \nService: GP Weight Loss Consultation",
          },
        }),
      });
    }

    // Always return 200 to Meta
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Webhook POST error:", error);

    // Still return 200 so Meta does not keep failing/retrying
    return NextResponse.json({
      success: true,
      warning: error?.message || "Webhook handled with warning",
    });
  }
}
