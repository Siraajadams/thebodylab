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

    // 1. Always store raw webhook event first
    const { error: webhookError } = await supabase.from("webhook_events").insert({
      source: "whatsapp",
      event_type: "messages",
      raw_payload: body,
    });

    if (webhookError) {
      console.error("Webhook event insert error:", webhookError);
    }

    // 2. Extract WhatsApp message
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    // If this is not a message event, still return success to Meta
    if (!message) {
      return NextResponse.json({ success: true });
    }

    const whatsappNumber = message?.from || "";
    const text = message?.text?.body || "";
    const profileName = contact?.profile?.name || "";

    // 3. Store WhatsApp message if table exists
    const { error: msgError } = await supabase.from("whatsapp_messages").insert({
      whatsapp_number: whatsappNumber,
      profile_name: profileName,
      message_text: text,
      raw_payload: body,
    });

    if (msgError) {
      console.error("WhatsApp message insert error:", msgError);
    }

    // 4. Try extract lead fields from message text
    // Supports:
    // name: John
    // surname: Smith
    // service: GP Weight Loss Consultation
    //
    // OR:
    // John|Smith|0799107059|GP Weight Loss Consultation

    let first_name = "";
    let surname = "";
    let service_interest = "GP Weight Loss Consultation";

    if (text.includes("|")) {
      const parts = text.split("|").map((p: string) => p.trim());
      first_name = parts[0] || "";
      surname = parts[1] || "";
      service_interest = parts[3] || service_interest;
    } else {
      const firstNameMatch = text.match(/name\s*:\s*(.*)/i);
      const surnameMatch = text.match(/surname\s*:\s*(.*)/i);
      const serviceMatch = text.match(/service\s*:\s*(.*)/i);

      first_name =
        firstNameMatch?.[1]?.trim() ||
        profileName.split(" ")[0] ||
        "";

      surname =
        surnameMatch?.[1]?.trim() ||
        profileName.split(" ").slice(1).join(" ") ||
        "";

      service_interest =
        serviceMatch?.[1]?.trim() ||
        service_interest;
    }

    // 5. Create lead
    const { error: leadError } = await supabase.from("leads").insert({
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

    // IMPORTANT: Always return 200 to Meta
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Webhook POST error:", error);

    // Still return 200 so Meta does not keep retrying
    return NextResponse.json({
      success: true,
      warning: error?.message || "Webhook handled with error",
    });
  }
}
