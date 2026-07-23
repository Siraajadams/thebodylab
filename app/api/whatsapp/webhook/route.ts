from pathlib import Path

code = Path("/mnt/data/Pasted text (2)(1).txt").read_text(encoding="utf-8")

code = code.replace(
'''const META_API_VERSION = process.env.WHATSAPP_API_VERSION || "v25.0";''',
'''const META_API_VERSION =
  process.env.META_GRAPH_API_VERSION ||
  process.env.WHATSAPP_API_VERSION ||
  "v25.0";'''
)

code = code.replace(
'''type SendResult = {
  ok: boolean;
  status: number;
  data: any;
};''',
'''type SendResult = {
  ok: boolean;
  status: number;
  data: any;
  messageId: string | null;
};

type WhatsAppStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  conversation?: {
    id?: string;
    expiration_timestamp?: string;
    origin?: { type?: string };
  };
  pricing?: {
    billable?: boolean;
    pricing_model?: string;
    category?: string;
  };
  errors?: Array<{
    code?: number;
    title?: string;
    message?: string;
    error_data?: { details?: string };
  }>;
};'''
)

code = code.replace(
'''function normalisePhone(phone: string) {
  return cleanText(phone).replace(/\\D/g, "");
}''',
'''function normalisePhone(phone: unknown) {
  return cleanText(phone).replace(/\\D/g, "");
}

function metaTimestampToIso(timestamp: unknown) {
  const seconds = Number(timestamp);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return new Date().toISOString();
  }

  return new Date(seconds * 1000).toISOString();
}'''
)

code = code.replace(
'''      data: { error: "WHATSAPP_ACCESS_TOKEN is missing." },
    };''',
'''      data: { error: "WHATSAPP_ACCESS_TOKEN is missing." },
      messageId: null,
    };''',
1
)

code = code.replace(
'''      data: { error: "WHATSAPP_PHONE_NUMBER_ID is missing." },
    };''',
'''      data: { error: "WHATSAPP_PHONE_NUMBER_ID is missing." },
      messageId: null,
    };''',
1
)

code = code.replace(
'''  return {
    ok: response.ok,
    status: response.status,
    data,
  };''',
'''  return {
    ok: response.ok,
    status: response.status,
    data,
    messageId: cleanText(data?.messages?.[0]?.id) || null,
  };'''
)

old_save = '''async function saveMessage(
  phone: string,
  messageText: string,
  direction: "inbound" | "outbound",
  leadId?: string | null,
  rawPayload?: any
) {
  const supabase = getSupabase();

  const { error } = await supabase.from("whatsapp_messages").insert({
    phone: normalisePhone(phone),
    lead_id: leadId || null,
    message_text: messageText,
    direction,
    raw_payload: rawPayload || null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("WHATSAPP MESSAGE SAVE ERROR:", error);
  }
}'''

new_save = '''async function saveMessage(
  phone: string,
  messageText: string,
  direction: "inbound" | "outbound",
  leadId?: string | null,
  rawPayload?: any,
  options?: {
    externalMessageId?: string | null;
    messageType?: string | null;
    sender?: string | null;
    recipient?: string | null;
    deliveryStatus?: string | null;
    eventTime?: string | null;
  }
) {
  const supabase = getSupabase();
  const eventTime = options?.eventTime || new Date().toISOString();
  const externalMessageId = cleanText(options?.externalMessageId) || null;

  if (externalMessageId) {
    const { data: existing, error: existingError } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("external_message_id", externalMessageId)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("WHATSAPP MESSAGE DUPLICATE CHECK ERROR:", existingError);
    }

    if (existing?.id) {
      console.log("DUPLICATE WHATSAPP MESSAGE IGNORED:", externalMessageId);
      return;
    }
  }

  const { error } = await supabase.from("whatsapp_messages").insert({
    phone: normalisePhone(phone),
    lead_id: leadId || null,
    sender:
      options?.sender ||
      (direction === "inbound" ? normalisePhone(phone) : PHONE_NUMBER_ID),
    recipient:
      options?.recipient ||
      (direction === "inbound" ? PHONE_NUMBER_ID : normalisePhone(phone)),
    message_text: messageText,
    direction,
    message_type: options?.messageType || "text",
    external_message_id: externalMessageId,
    delivery_status:
      options?.deliveryStatus ||
      (direction === "inbound" ? "received" : "accepted"),
    received_at: direction === "inbound" ? eventTime : null,
    sent_at: direction === "outbound" ? eventTime : null,
    raw_payload: rawPayload || null,
    created_at: eventTime,
    updated_at: eventTime,
  });

  if (error) {
    console.error("WHATSAPP MESSAGE SAVE ERROR:", error);
  }
}'''

code = code.replace(old_save, new_save)

old_reply = '''async function reply(phone: string, message: string, leadId?: string | null) {
  const result = await sendWhatsAppText(phone, message);

  if (result.ok) {
    await saveMessage(phone, message, "outbound", leadId);
  } else {
    console.error("OUTBOUND MESSAGE WAS NOT SAVED AS SENT:", {
      phone,
      leadId,
      metaStatus: result.status,
      metaResponse: result.data,
    });
  }

  return result;
}'''

new_reply = '''async function reply(phone: string, message: string, leadId?: string | null) {
  const requestedAt = new Date().toISOString();
  const result = await sendWhatsAppText(phone, message);

  await saveMessage(phone, message, "outbound", leadId, result.data, {
    externalMessageId: result.messageId,
    messageType: "text",
    sender: PHONE_NUMBER_ID,
    recipient: normalisePhone(phone),
    deliveryStatus: result.ok ? "accepted" : "failed",
    eventTime: requestedAt,
  });

  if (!result.ok) {
    console.error("OUTBOUND MESSAGE FAILED:", {
      phone,
      leadId,
      metaStatus: result.status,
      metaResponse: result.data,
    });
  }

  return result;
}'''

code = code.replace(old_reply, new_reply)

insert_after_reply = new_reply + '''

async function updateMessageStatuses(statuses: WhatsAppStatus[]) {
  if (!Array.isArray(statuses) || statuses.length === 0) return;

  const supabase = getSupabase();

  for (const statusEvent of statuses) {
    const externalMessageId = cleanText(statusEvent.id);
    const deliveryStatus = cleanText(statusEvent.status) || "unknown";
    const recipient = normalisePhone(statusEvent.recipient_id);
    const eventTime = metaTimestampToIso(statusEvent.timestamp);

    if (!externalMessageId) continue;

    const timestampColumn =
      deliveryStatus === "sent"
        ? "sent_at"
        : deliveryStatus === "delivered"
          ? "delivered_at"
          : deliveryStatus === "read"
            ? "read_at"
            : deliveryStatus === "failed"
              ? "failed_at"
              : null;

    const updatePayload: Record<string, unknown> = {
      delivery_status: deliveryStatus,
      recipient: recipient || null,
      status_payload: statusEvent,
      status_error: statusEvent.errors || null,
      updated_at: new Date().toISOString(),
    };

    if (timestampColumn) {
      updatePayload[timestampColumn] = eventTime;
    }

    const { data, error } = await supabase
      .from("whatsapp_messages")
      .update(updatePayload)
      .eq("external_message_id", externalMessageId)
      .select("id");

    if (error) {
      console.error("WHATSAPP STATUS UPDATE ERROR:", {
        externalMessageId,
        deliveryStatus,
        error,
      });
      continue;
    }

    const { error: leadMessageError } = await supabase
      .from("lead_messages")
      .update({
        delivery_status: deliveryStatus,
        ...(timestampColumn ? { [timestampColumn]: eventTime } : {}),
      })
      .eq("external_message_id", externalMessageId);

    if (leadMessageError) {
      console.error("LEAD MESSAGE STATUS UPDATE ERROR:", leadMessageError);
    }

    console.log("WHATSAPP STATUS UPDATED:", {
      externalMessageId,
      deliveryStatus,
      recipient,
      eventTime,
      matchedRecords: data?.length || 0,
    });
  }
}'''

code = code.replace(new_reply, insert_after_reply)

code = code.replace(
'''  await saveMessage(phone, incomingText, "inbound", leadId, rawPayload);''',
'''  await saveMessage(phone, incomingText, "inbound", leadId, rawPayload, {
    externalMessageId: cleanText(rawPayload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id),
    messageType:
      cleanText(rawPayload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.type) ||
      "text",
    sender: phone,
    recipient: PHONE_NUMBER_ID,
    deliveryStatus: "received",
    eventTime: metaTimestampToIso(
      rawPayload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.timestamp
    ),
  });'''
)

code = code.replace(
'''    const messageObj = value?.messages?.[0];

    // Delivery/read/status events do not contain an inbound message.
    if (!messageObj) {
      console.log("WHATSAPP STATUS OR NON-MESSAGE EVENT:", {
        statuses: value?.statuses || null,
        field: change?.field || null,
      });

      return NextResponse.json({
        success: true,
        message: "Status or non-message event received.",
      });
    }''',
'''    const statuses = (value?.statuses || []) as WhatsAppStatus[];

    if (statuses.length > 0) {
      await updateMessageStatuses(statuses);

      return NextResponse.json({
        success: true,
        message: "WhatsApp delivery status processed.",
        statusesProcessed: statuses.length,
      });
    }

    const messageObj = value?.messages?.[0];

    if (!messageObj) {
      console.log("WHATSAPP NON-MESSAGE EVENT:", {
        field: change?.field || null,
      });

      return NextResponse.json({
        success: true,
        message: "Non-message event received.",
      });
    }'''
)

code = code.replace(
'''    const incomingMessageId = cleanText(messageObj.id);''',
'''    const incomingMessageId = cleanText(messageObj.id);
    const incomingTime = metaTimestampToIso(messageObj.timestamp);
    const incomingMessageType = cleanText(messageObj.type) || "unknown";'''
)

# Replace the normal inbound save call during active sessions.
code = code.replace(
'''    await saveMessage(phone, incomingText, "inbound", leadId, body);''',
'''    await saveMessage(phone, incomingText, "inbound", leadId, body, {
      externalMessageId: incomingMessageId,
      messageType: incomingMessageType,
      sender: phone,
      recipient: PHONE_NUMBER_ID,
      deliveryStatus: "received",
      eventTime: incomingTime,
    });'''
)

# Handle unsupported types by recording them first.
code = code.replace(
'''    if (!incomingText) {
      await reply(
        phone,
        "Thank you for contacting BodyLab. Please send a text message such as Hi to begin.",
        null
      );''',
'''    if (!incomingText) {
      await saveMessage(
        phone,
        `[Unsupported WhatsApp message type: ${incomingMessageType}]`,
        "inbound",
        null,
        body,
        {
          externalMessageId: incomingMessageId,
          messageType: incomingMessageType,
          sender: phone,
          recipient: PHONE_NUMBER_ID,
          deliveryStatus: "received",
          eventTime: incomingTime,
        }
      );

      await reply(
        phone,
        "Thank you for contacting BodyLab. Please send a text message such as Hi to begin.",
        null
      );'''
)

out = Path("/mnt/data/whatsapp-webhook-route.ts")
out.write_text(code, encoding="utf-8")
print(f"Created {out}")
