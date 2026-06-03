import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || "bodylab_verify_token";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

async function fetchLeadDetails(leadgenId: string) {
  const response = await fetch(
    `https://graph.facebook.com/v25.0/${leadgenId}?access_token=${META_ACCESS_TOKEN}`
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("META LEAD FETCH ERROR:", data);
    return null;
  }

  return data;
}

function fieldValue(fields: any[], names: string[]) {
  const found = fields.find((field) =>
    names.includes(String(field.name || "").toLowerCase())
  );

  return Array.isArray(found?.values) ? found.values[0] : "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("META LEAD WEBHOOK RECEIVED:", JSON.stringify(body));

    const changes = body?.entry?.flatMap((entry: any) => entry.changes || []) || [];

    for (const change of changes) {
      const value = change?.value || {};
      const leadgenId = value?.leadgen_id;

      if (!leadgenId) continue;

      const leadDetails = await fetchLeadDetails(leadgenId);
      const fieldData = leadDetails?.field_data || [];

      const fullName = fieldValue(fieldData, ["full_name", "name"]);
      const email = fieldValue(fieldData, ["email"]);
      const phone = fieldValue(fieldData, ["phone_number", "phone", "mobile"]);
      const serviceInterest =
        fieldValue(fieldData, ["service_interest", "programme", "service"]) ||
        "GLP-treatment programme";

      const [firstName, ...surnameParts] = String(fullName || "").split(" ");
      const surname = surnameParts.join(" ");

      const { error: eventError } = await supabase
        .from("meta_lead_events")
        .insert({
          meta_lead_id: leadgenId,
          page_id: value?.page_id || null,
          form_id: value?.form_id || null,
          raw_payload: body,
          created_at: new Date().toISOString(),
        });

      if (eventError) {
        console.error("META LEAD EVENT SAVE ERROR:", eventError);
      }

      const { error: leadError } = await supabase
        .from("leads")
        .insert({
          first_name: firstName || fullName || "Meta",
          surname,
          full_name: fullName,
          email,
          phone,
          service_interest: serviceInterest,
          source: "Meta Lead Form",
          status: "New",
          last_message: "Meta lead form submitted",
          last_message_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });

      if (leadError) {
        console.error("META LEAD SAVE ERROR:", leadError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("META LEAD WEBHOOK ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Webhook failed" },
      { status: 500 }
    );
  }
}
