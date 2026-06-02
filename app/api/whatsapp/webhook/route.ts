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
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const message =
      body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    const contact =
      body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];

    if (!message) {
      return NextResponse.json({ success: true });
    }

    const whatsappNumber = message?.from || "";
    const text = message?.text?.body || "";
    const profileName = contact?.profile?.name || "";

    const firstNameMatch = text.match(/name:\s*(.*)/i);
    const surnameMatch = text.match(/surname:\s*(.*)/i);
    const serviceMatch = text.match(/service:\s*(.*)/i);

    const first_name = firstNameMatch?.[1]?.trim() || profileName.split(" ")[0] || "";
    const surname = surnameMatch?.[1]?.trim() || profileName.split(" ").slice(1).join(" ") || "";
    const service_interest = serviceMatch?.[1]?.trim() || "GP Weight Loss Consultation";

    const { error } = await supabase.from("leads").insert({
      first_name,
      surname,
      full_name: `${first_name} ${surname}`.trim(),
      phone: whatsappNumber,
      email: null,
      service_interest,
      source: "WhatsApp",
      notes: text,
      status: "New Lead",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
