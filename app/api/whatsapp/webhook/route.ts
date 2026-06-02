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
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("WHATSAPP WEBHOOK RECEIVED");
    console.log(JSON.stringify(body));

    // Save raw webhook event
    await supabase.from("webhook_events").insert({
      source: "whatsapp",
      event_type: "incoming",
      raw_payload: body
    });

    const value =
      body?.entry?.[0]?.changes?.[0]?.value;

    const message =
      value?.messages?.[0];

    if (!message) {
      return NextResponse.json({
        success: true
      });
    }

    const phone = message.from;

    const text =
      message?.text?.body || "";

    // Store message using existing table columns
    await supabase.from("whatsapp_messages").insert({
      phone,
      direction: "incoming"
    });

    // Send auto reply
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: {
            body:
              `Welcome to BodyLab.\n\nThank you for your message:\n"${text}"\n\nA consultant will contact you shortly.`
          }
        })
      }
    );

    const result = await response.text();

    console.log("META RESPONSE");
    console.log(result);

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error("WEBHOOK ERROR");
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: String(error)
      },
      {
        status: 500
      }
    );
  }
}
