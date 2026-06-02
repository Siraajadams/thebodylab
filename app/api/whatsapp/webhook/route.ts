import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendWhatsAppMessage(
  phone: string,
  message: string
) {
  try {
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
          to: phone,
          type: "text",
          text: {
            body: message,
          },
        }),
      }
    );

    const result = await response.json();

    console.log("META STATUS:", response.status);
    console.log("META RESPONSE:", result);

    return result;
  } catch (err) {
    console.error("SEND ERROR:", err);
  }
}

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

    await supabase.from("webhook_events").insert({
      source: "whatsapp",
      event_type: "message",
      raw_payload: body,
    });

    const value =
      body?.entry?.[0]?.changes?.[0]?.value;

    const message =
      value?.messages?.[0];

    const contact =
      value?.contacts?.[0];

    if (!message) {
      return NextResponse.json({
        success: true,
      });
    }

    const phone =
      message?.from || "";

    const incomingText =
      message?.text?.body?.trim() || "";

    const profileName =
      contact?.profile?.name || "";

    const { data: existingLead } =
      await supabase
        .from("leads")
        .select("*")
        .eq("phone", phone)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    let lead = existingLead;

    if (!lead) {
      const { data: newLead } =
        await supabase
          .from("leads")
          .insert({
            first_name: profileName || "",
            surname: "",
            full_name: profileName || "",
            phone,
            source: "WhatsApp",
            status: "New Lead",
            service_interest: null,
            notes: incomingText,
          })
          .select()
          .single();

      lead = newLead;

      await sendWhatsAppMessage(
        phone,
        `👋 Welcome to BodyLab.

Let's get you registered.

What is your full name?`
      );

      return NextResponse.json({
        success: true,
      });
    }

    await supabase
      .from("whatsapp_messages")
      .insert({
        lead_id: lead.id,
        phone,
        direction: "inbound",
        message_text: incomingText,
      });

    if (!lead.full_name) {
      await supabase
        .from("leads")
        .update({
          full_name: incomingText,
        })
        .eq("id", lead.id);

      await sendWhatsAppMessage(
        phone,
        "Thank you. Please provide your email address."
      );

      return NextResponse.json({
        success: true,
      });
    }

    if (!lead.email) {
      await supabase
        .from("leads")
        .update({
          email: incomingText,
        })
        .eq("id", lead.id);

      await sendWhatsAppMessage(
        phone,
        `Which service are you interested in?

1. GP Weight Loss Consultation
2. Medical Cannabis
3. Longevity Assessment
4. General Enquiry`
      );

      return NextResponse.json({
        success: true,
      });
    }

    if (!lead.service_interest) {
      let service =
        "General Enquiry";

      if (incomingText === "1")
        service =
          "GP Weight Loss Consultation";

      if (incomingText === "2")
        service =
          "Medical Cannabis";

      if (incomingText === "3")
        service =
          "Longevity Assessment";

      if (incomingText === "4")
        service =
          "General Enquiry";

      await supabase
        .from("leads")
        .update({
          service_interest: service,
        })
        .eq("id", lead.id);

      await sendWhatsAppMessage(
        phone,
        `Thank you.

Please tell us briefly how we can help you today.`
      );

      return NextResponse.json({
        success: true,
      });
    }

    await supabase
      .from("leads")
      .update({
        notes: incomingText,
        status: "Qualified Lead",
      })
      .eq("id", lead.id);

    await sendWhatsAppMessage(
      phone,
      `✅ Thank you.

Your enquiry has been submitted successfully.

A BodyLab consultant will contact you shortly.`
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "WEBHOOK ERROR:",
      error
    );

    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}
