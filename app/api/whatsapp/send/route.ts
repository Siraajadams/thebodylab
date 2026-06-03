import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

function cleanPhone(phone: string) {
  return String(phone || "").replace(/\D/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const phone = cleanPhone(body.phone);
    const message = String(body.message || "").trim();
    const leadId = body.lead_id || null;

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: "Missing phone or message" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: {
            preview_url: false,
            body: message,
          },
        }),
      }
    );

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("WHATSAPP SEND ERROR:", result);

      return NextResponse.json(
        { success: false, error: result },
        { status: 500 }
      );
    }

    await supabase.from("whatsapp_messages").insert({
      lead_id: leadId,
      phone,
      direction: "outbound",
      message_text: message,
      created_at: new Date().toISOString(),
    });

    await supabase
      .from("leads")
      .update({
        last_message: message,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("WHATSAPP SEND ROUTE ERROR:", error);

    return NextResponse.json(
      { success: false, error: "Send failed" },
      { status: 500 }
    );
  }
}
