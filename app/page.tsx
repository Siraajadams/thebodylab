"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const PIN = "bodylab2026";

const statuses = [
  "New Lead",
  "Contacted",
  "Consultation Booked",
  "Converted",
  "Lost",
];

const services = [
  "GP Weight Loss Consultation",
  "GLP-treatment programme",
];

const sources = [
  "WhatsApp",
  "Meta Lead Form",
  "Email",
  "Phone Call",
  "Website",
  "Manual Capture",
];

type Lead = {
  id: string;
  first_name: string;
  surname: string;
  full_name: string;
  phone: string;
  email: string;
  service_interest: string;
  source: string;
  status: string;
  notes: string;
  next_follow_up_date?: string;
  created_at: string;
  updated_at?: string;
};

type Activity = {
  id: string;
  lead_id: string;
  activity?: string;
  description?: string;
  activity_type: string;
  created_by?: string;
  created_at: string;
};

type Appointment = {
  id: string;
  lead_id: string;
  appointment_date: string;
  appointment_time: string;
  doctor_name?: string;
  appointment_type?: string;
  notes?: string;
  status?: string;
  created_at?: string;
};

type LeadMessage = {
  id: string;
  lead_id: string;
  channel: "whatsapp" | "email";
  direction: "outbound" | "inbound";
  message_type?: string;
  template_key?: string | null;
  subject?: string | null;
  message_body: string;
  sender?: string | null;
  recipient?: string | null;
  delivery_status?: string | null;
  sent_at?: string | null;
  received_at?: string | null;
  created_at: string;
};

type ContactChannel = "whatsapp" | "email";

type MessageTemplateKey =
  | "initial_follow_up"
  | "booking_reminder"
  | "appointment_confirmation"
  | "missed_follow_up"
  | "post_consultation"
  | "custom";

type MessageTemplate = {
  key: MessageTemplateKey;
  name: string;
  emailSubject: string;
  buildMessage: (lead: Lead) => string;
};

const messageTemplates: MessageTemplate[] = [
  {
    key: "initial_follow_up",
    name: "Initial enquiry follow-up",
    emailSubject: "Your BodyLab enquiry",
    buildMessage: (lead) => `Hi ${lead.first_name || "there"},

Thank you for your interest in BodyLab.

We received your enquiry for ${
      lead.service_interest || "a BodyLab consultation"
    }.

Would you like help booking your consultation?

Book online:
https://thebodylab.co.za/

Regards
BodyLab Team`,
  },
  {
    key: "booking_reminder",
    name: "Consultation booking reminder",
    emailSubject: "Reminder to book your BodyLab consultation",
    buildMessage: (lead) => `Hi ${lead.first_name || "there"},

This is a friendly reminder to book your BodyLab consultation for ${
      lead.service_interest || "your selected service"
    }.

Book online:
https://thebodylab.co.za/

Please reply to this message if you need assistance.

Regards
BodyLab Team`,
  },
  {
    key: "appointment_confirmation",
    name: "Appointment confirmation",
    emailSubject: "Your BodyLab appointment is confirmed",
    buildMessage: (lead) => `Hi ${lead.first_name || "there"},

Your BodyLab appointment has been confirmed.

Service: ${lead.service_interest || "BodyLab consultation"}

Please reply to this message if you need to reschedule.

Regards
BodyLab Team`,
  },
  {
    key: "missed_follow_up",
    name: "Missed enquiry follow-up",
    emailSubject: "Are you still interested in BodyLab?",
    buildMessage: (lead) => `Hi ${lead.first_name || "there"},

We recently contacted you regarding your interest in ${
      lead.service_interest || "BodyLab"
    }.

Are you still interested in starting your weight loss journey with BodyLab?

Reply YES and our team will assist you.

Regards
BodyLab Team`,
  },
  {
    key: "post_consultation",
    name: "Post-consultation follow-up",
    emailSubject: "BodyLab follow-up",
    buildMessage: (lead) => `Hi ${lead.first_name || "there"},

Thank you for attending your BodyLab consultation.

Please let us know if you need help with your treatment plan, follow-up appointment or medication programme.

Regards
BodyLab Team`,
  },
  {
    key: "custom",
    name: "Custom message",
    emailSubject: "Message from BodyLab",
    buildMessage: () => "",
  },
];

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<LeadMessage[]>([]);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [bookingLead, setBookingLead] = useState<Lead | null>(null);
  const [contactLead, setContactLead] = useState<Lead | null>(null);
  const [conversationLead, setConversationLead] = useState<Lead | null>(null);

  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");

  const [contactChannel, setContactChannel] =
    useState<ContactChannel>("whatsapp");
  const [selectedTemplate, setSelectedTemplate] =
    useState<MessageTemplateKey>("initial_follow_up");
  const [contactSubject, setContactSubject] =
    useState("Your BodyLab enquiry");
  const [contactMessage, setContactMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [contactResult, setContactResult] = useState("");

  const [appointmentForm, setAppointmentForm] = useState({
    appointment_date: "",
    appointment_time: "",
    doctor_name: "",
    notes: "",
  });

  const [form, setForm] = useState({
    first_name: "",
    surname: "",
    phone: "",
    email: "",
    service_interest: "GP Weight Loss Consultation",
    source: "Manual Capture",
    notes: "",
    next_follow_up_date: "",
  });

  useEffect(() => {
    const saved = localStorage.getItem("bodylab_logged_in");

    if (saved === "yes") {
      setLoggedIn(true);
      void loadLeads();
      void loadAppointments();
    }
  }, []);

  useEffect(() => {
    if (!contactLead) return;

    const template =
      messageTemplates.find((item) => item.key === selectedTemplate) ||
      messageTemplates[0];

    setContactSubject(template.emailSubject);
    setContactMessage(template.buildMessage(contactLead));
    setContactResult("");
  }, [contactLead, selectedTemplate]);

  async function loadLeads() {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setLeads((data || []) as Lead[]);
  }

  async function loadAppointments() {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .order("appointment_date", { ascending: true });

    if (!error) {
      setAppointments((data || []) as Appointment[]);
    }
  }

  async function loadActivities(leadId: string) {
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (!error) {
      setActivities((data || []) as Activity[]);
    }
  }

  async function loadMessages(leadId: string) {
    const { data, error } = await supabase
      .from("lead_messages")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Unable to load conversation:", error);
      setMessages([]);
      return;
    }

    setMessages((data || []) as LeadMessage[]);
  }

  async function logActivity(
    leadId: string,
    activity: string,
    type = "note"
  ) {
    const { error } = await supabase.from("activities").insert({
      lead_id: leadId,
      activity,
      activity_type: type,
      created_by: "admin",
    });

    if (error) {
      console.error("Unable to save activity:", error);
    }
  }

  function login() {
    if (pin === PIN) {
      localStorage.setItem("bodylab_logged_in", "yes");
      setLoggedIn(true);
      void loadLeads();
      void loadAppointments();
    } else {
      alert("Incorrect PIN");
    }
  }

  function logout() {
    localStorage.removeItem("bodylab_logged_in");
    setLoggedIn(false);
  }

  function alertStatus(lead: Lead) {
    const date = new Date(lead.updated_at || lead.created_at).getTime();
    const hours = (Date.now() - date) / 36e5;

    if (hours > 48) return "🔴 No update over 48h";
    if (hours > 24) return "🟠 No update over 24h";
    return "🟢 Recently updated";
  }

  async function saveLead() {
    const payload = {
      ...form,
      full_name: `${form.first_name} ${form.surname}`.trim(),
      status: "New Lead",
    };

    const { data, error } = await supabase
      .from("leads")
      .insert(payload)
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await logActivity(data.id, "Lead created", "lead_created");

    setForm({
      first_name: "",
      surname: "",
      phone: "",
      email: "",
      service_interest: "GP Weight Loss Consultation",
      source: "Manual Capture",
      notes: "",
      next_follow_up_date: "",
    });

    await loadLeads();
  }

  async function updateStatus(lead: Lead, newStatus: string) {
    const { error } = await supabase
      .from("leads")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (error) {
      alert(error.message);
      return;
    }

    await logActivity(
      lead.id,
      `Status changed to ${newStatus}`,
      "status_change"
    );

    if (newStatus === "Consultation Booked") {
      setBookingLead(lead);
    }

    await loadLeads();

    if (selectedLead?.id === lead.id) {
      await loadActivities(lead.id);
    }
  }

  function openTimeline(lead: Lead) {
    setSelectedLead(lead);
    void loadActivities(lead.id);
  }

  function openContactModal(lead: Lead) {
    setContactLead(lead);
    setContactChannel("whatsapp");
    setSelectedTemplate("initial_follow_up");
    setContactResult("");

    const template = messageTemplates[0];
    setContactSubject(template.emailSubject);
    setContactMessage(template.buildMessage(lead));
  }

  function openConversation(lead: Lead) {
    setConversationLead(lead);
    void loadMessages(lead.id);
  }

  async function sendContactMessage() {
    if (!contactLead) return;

    if (!contactMessage.trim()) {
      setContactResult("Please enter a message.");
      return;
    }

    if (contactChannel === "email" && !contactSubject.trim()) {
      setContactResult("Please enter an email subject.");
      return;
    }

    setSendingMessage(true);
    setContactResult("");

    try {
      const endpoint =
        contactChannel === "whatsapp"
          ? "/api/crm/send-whatsapp"
          : "/api/crm/send-email";

      const payload =
        contactChannel === "whatsapp"
          ? {
              leadId: contactLead.id,
              message: contactMessage,
            }
          : {
              leadId: contactLead.id,
              subject: contactSubject,
              message: contactMessage,
              templateKey:
                selectedTemplate === "custom" ? null : selectedTemplate,
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "The message could not be sent.");
      }

      setContactResult(
        `${
          contactChannel === "whatsapp" ? "WhatsApp" : "Email"
        } sent successfully.`
      );

      await loadLeads();
      await loadMessages(contactLead.id);
    } catch (error) {
      setContactResult(
        error instanceof Error
          ? error.message
          : "The message could not be sent."
      );
    } finally {
      setSendingMessage(false);
    }
  }

  async function addTimelineNote() {
    if (!selectedLead || !note.trim()) return;

    await logActivity(selectedLead.id, note, "admin_note");
    setNote("");
    await loadActivities(selectedLead.id);
  }

  async function saveAppointment() {
    if (!bookingLead) return;

    if (
      !appointmentForm.appointment_date ||
      !appointmentForm.appointment_time
    ) {
      alert("Please select the appointment date and time.");
      return;
    }

    const { error } = await supabase.from("appointments").insert({
      lead_id: bookingLead.id,
      appointment_date: appointmentForm.appointment_date,
      appointment_time: appointmentForm.appointment_time,
      doctor_name: appointmentForm.doctor_name,
      appointment_type: bookingLead.service_interest,
      notes: appointmentForm.notes,
      status: "Booked",
    });

    if (error) {
      alert(error.message);
      return;
    }

    await logActivity(
      bookingLead.id,
      `Appointment booked for ${appointmentForm.appointment_date} at ${appointmentForm.appointment_time}`,
      "appointment"
    );

    setBookingLead(null);
    setAppointmentForm({
      appointment_date: "",
      appointment_time: "",
      doctor_name: "",
      notes: "",
    });

    await loadAppointments();
    await loadLeads();
  }

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const text =
        `${lead.full_name} ${lead.first_name} ${lead.surname} ${lead.phone} ${lead.email}`.toLowerCase();

      return (
        text.includes(search.toLowerCase()) &&
        (statusFilter === "All" || lead.status === statusFilter) &&
        (sourceFilter === "All" || lead.source === sourceFilter)
      );
    });
  }, [leads, search, statusFilter, sourceFilter]);

  const stats = {
    total: leads.length,
    new: leads.filter((lead) => lead.status === "New Lead").length,
    contacted: leads.filter((lead) => lead.status === "Contacted").length,
    booked: leads.filter(
      (lead) => lead.status === "Consultation Booked"
    ).length,
    converted: leads.filter((lead) => lead.status === "Converted").length,
    lost: leads.filter((lead) => lead.status === "Lost").length,
  };

  const today = new Date().toISOString().slice(0, 10);

  const todaysAppointments = appointments.filter(
    (appointment) => appointment.appointment_date === today
  ).length;

  const conversionRate = stats.total
    ? Math.round((stats.converted / stats.total) * 100)
    : 0;

  const bookedRate = stats.total
    ? Math.round((stats.booked / stats.total) * 100)
    : 0;

  const lostRate = stats.total
    ? Math.round((stats.lost / stats.total) * 100)
    : 0;

  if (!loggedIn) {
    return (
      <main style={loginPage}>
        <section style={loginBox}>
          <h1>BodyLab CRM</h1>
          <p>Admin access</p>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={showPin ? "text" : "password"}
              placeholder="Enter PIN"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") login();
              }}
              style={inputStyle}
            />

            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              style={lightButton}
            >
              {showPin ? "Hide" : "Show"}
            </button>
          </div>

          <button type="button" onClick={login} style={buttonStyle}>
            Login
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <button type="button" onClick={logout} style={{ float: "right" }}>
        Logout
      </button>

      <h1>BodyLab CRM</h1>
      <p>
        Monitor leads, send WhatsApp and email messages, and track
        consultation conversions.
      </p>

      <section style={statsGrid}>
        {[
          ["Total Leads", stats.total],
          ["New Leads", stats.new],
          ["Contacted", stats.contacted],
          ["Booked", stats.booked],
          ["Converted", stats.converted],
          ["Lost", stats.lost],
          ["Conversion %", `${conversionRate}%`],
          ["Booked %", `${bookedRate}%`],
          ["Lost %", `${lostRate}%`],
          ["Today Appointments", todaysAppointments],
        ].map(([label, value]) => (
          <div key={String(label)} style={cardStyle}>
            <h2>{value}</h2>
            <p>{label}</p>
          </div>
        ))}
      </section>

      <section style={panelStyle}>
        <h2>Capture New Lead</h2>
        <p>
          Use this for email enquiries, calls, manual admin capture or
          walk-in leads.
        </p>

        <div style={formGrid}>
          <input
            style={inputStyle}
            placeholder="First name"
            value={form.first_name}
            onChange={(event) =>
              setForm({ ...form, first_name: event.target.value })
            }
          />

          <input
            style={inputStyle}
            placeholder="Surname"
            value={form.surname}
            onChange={(event) =>
              setForm({ ...form, surname: event.target.value })
            }
          />

          <input
            style={inputStyle}
            placeholder="Phone / WhatsApp"
            value={form.phone}
            onChange={(event) =>
              setForm({ ...form, phone: event.target.value })
            }
          />

          <input
            style={inputStyle}
            placeholder="Email"
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
          />

          <select
            style={inputStyle}
            value={form.service_interest}
            onChange={(event) =>
              setForm({
                ...form,
                service_interest: event.target.value,
              })
            }
          >
            {services.map((service) => (
              <option key={service}>{service}</option>
            ))}
          </select>

          <select
            style={inputStyle}
            value={form.source}
            onChange={(event) =>
              setForm({ ...form, source: event.target.value })
            }
          >
            {sources.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </select>

          <input
            type="date"
            style={inputStyle}
            value={form.next_follow_up_date}
            onChange={(event) =>
              setForm({
                ...form,
                next_follow_up_date: event.target.value,
              })
            }
          />
        </div>

        <textarea
          placeholder="Notes / patient interest / follow-up instruction"
          value={form.notes}
          onChange={(event) =>
            setForm({ ...form, notes: event.target.value })
          }
          style={{
            ...inputStyle,
            width: "100%",
            minHeight: 90,
            marginTop: 12,
          }}
        />

        <button type="button" onClick={saveLead} style={buttonStyle}>
          Save Lead
        </button>
      </section>

      <section style={panelStyle}>
        <h2>Search & Filters</h2>

        <div style={formGrid}>
          <input
            style={inputStyle}
            placeholder="Search name, phone or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            style={inputStyle}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option>All</option>
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>

          <select
            style={inputStyle}
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
          >
            <option>All</option>
            {sources.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </select>
        </div>
      </section>

      <h2>Pipeline</h2>

      <section style={pipelineGrid}>
        {statuses.map((status) => (
          <div key={status} style={pipelineColumn}>
            <h3>{status}</h3>

            {filteredLeads
              .filter((lead) => lead.status === status)
              .map((lead) => (
                <div key={lead.id} style={leadCard}>
                  <strong>
                    🟢{" "}
                    {lead.full_name ||
                      `${lead.first_name} ${lead.surname}`}
                  </strong>

                  <p>📞 {lead.phone || "Not provided"}</p>
                  <p>✉️ {lead.email || "Not provided"}</p>

                  <small>
                    <b>Interested In:</b>
                    <br />
                    {lead.service_interest}
                  </small>
                  <br />
                  <br />

                  <small>
                    <b>Source:</b>
                    <br />
                    {lead.source}
                  </small>
                  <br />
                  <br />

                  <small>
                    <b>Created:</b>
                    <br />
                    {new Date(lead.created_at).toLocaleDateString()}
                  </small>
                  <br />
                  <br />

                  <small>
                    <b>Follow-up:</b>
                    <br />
                    {lead.next_follow_up_date || "Not set"}
                  </small>
                  <br />
                  <br />

                  <p>{alertStatus(lead)}</p>

                  <button
                    type="button"
                    onClick={() => openContactModal(lead)}
                    style={contactButton}
                  >
                    Contact Lead
                  </button>

                  <button
                    type="button"
                    onClick={() => openConversation(lead)}
                    style={lightButton}
                  >
                    View Conversation
                  </button>

                  <select
                    value={lead.status}
                    onChange={(event) =>
                      updateStatus(lead, event.target.value)
                    }
                    style={{
                      ...inputStyle,
                      width: "100%",
                      marginTop: 10,
                    }}
                  >
                    {statuses.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => openTimeline(lead)}
                    style={lightButton}
                  >
                    View Timeline
                  </button>

                  <button
                    type="button"
                    onClick={() => setBookingLead(lead)}
                    style={lightButton}
                  >
                    Book Appointment
                  </button>
                </div>
              ))}
          </div>
        ))}
      </section>

      {contactLead && (
        <div style={overlayStyle}>
          <section style={modalStyle}>
            <button
              type="button"
              onClick={() => setContactLead(null)}
              style={closeButton}
            >
              Close
            </button>

            <h2>Contact Lead</h2>
            <p>
              {contactLead.full_name ||
                `${contactLead.first_name} ${contactLead.surname}`}
            </p>

            <label style={labelStyle}>Channel</label>
            <div style={channelRow}>
              <button
                type="button"
                onClick={() => setContactChannel("whatsapp")}
                style={
                  contactChannel === "whatsapp"
                    ? activeChannelButton
                    : channelButton
                }
              >
                WhatsApp
              </button>

              <button
                type="button"
                onClick={() => setContactChannel("email")}
                style={
                  contactChannel === "email"
                    ? activeChannelButton
                    : channelButton
                }
              >
                Email
              </button>
            </div>

            <label style={labelStyle}>Predetermined message</label>
            <select
              style={{ ...inputStyle, width: "100%" }}
              value={selectedTemplate}
              onChange={(event) =>
                setSelectedTemplate(
                  event.target.value as MessageTemplateKey
                )
              }
            >
              {messageTemplates.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.name}
                </option>
              ))}
            </select>

            {contactChannel === "email" && (
              <>
                <label style={labelStyle}>Subject</label>
                <input
                  style={{ ...inputStyle, width: "100%" }}
                  value={contactSubject}
                  onChange={(event) =>
                    setContactSubject(event.target.value)
                  }
                />
              </>
            )}

            <label style={labelStyle}>Message</label>
            <textarea
              style={{
                ...inputStyle,
                width: "100%",
                minHeight: 260,
                resize: "vertical",
              }}
              value={contactMessage}
              onChange={(event) =>
                setContactMessage(event.target.value)
              }
            />

            {contactResult && (
              <p
                style={{
                  fontWeight: 700,
                  color: contactResult.includes("successfully")
                    ? "#166534"
                    : "#b91c1c",
                }}
              >
                {contactResult}
              </p>
            )}

            <button
              type="button"
              onClick={sendContactMessage}
              disabled={sendingMessage}
              style={{
                ...buttonStyle,
                width: "100%",
                opacity: sendingMessage ? 0.6 : 1,
              }}
            >
              {sendingMessage
                ? "Sending..."
                : `Send ${
                    contactChannel === "whatsapp"
                      ? "WhatsApp"
                      : "Email"
                  }`}
            </button>
          </section>
        </div>
      )}

      {conversationLead && (
        <section style={timelinePanel}>
          <button
            type="button"
            onClick={() => setConversationLead(null)}
            style={{ float: "right" }}
          >
            Close
          </button>

          <h2>Conversation</h2>
          <p>
            {conversationLead.full_name ||
              `${conversationLead.first_name} ${conversationLead.surname}`}
          </p>

          <button
            type="button"
            onClick={() => loadMessages(conversationLead.id)}
            style={lightButton}
          >
            Refresh Replies
          </button>

          {messages.length === 0 && (
            <p>No WhatsApp or email messages have been recorded yet.</p>
          )}

          {messages.map((item) => {
            const messageDate =
              item.received_at ||
              item.sent_at ||
              item.created_at;

            const inbound = item.direction === "inbound";

            return (
              <div
                key={item.id}
                style={{
                  ...messageBubble,
                  marginLeft: inbound ? 0 : 42,
                  marginRight: inbound ? 42 : 0,
                  background: inbound ? "#f3f4f6" : "#dcfce7",
                }}
              >
                <strong>
                  {item.channel === "whatsapp"
                    ? "WhatsApp"
                    : "Email"}{" "}
                  · {inbound ? "Client reply" : "Sent"}
                </strong>

                {item.subject && (
                  <p>
                    <b>Subject:</b> {item.subject}
                  </p>
                )}

                <p style={{ whiteSpace: "pre-wrap" }}>
                  {item.message_body}
                </p>

                <small>
                  {messageDate
                    ? new Date(messageDate).toLocaleString()
                    : ""}
                  {item.delivery_status
                    ? ` · ${item.delivery_status}`
                    : ""}
                </small>
              </div>
            );
          })}
        </section>
      )}

      {selectedLead && (
        <section style={timelinePanel}>
          <button
            type="button"
            onClick={() => setSelectedLead(null)}
            style={{ float: "right" }}
          >
            Close
          </button>

          <h2>Timeline</h2>
          <p>{selectedLead.full_name}</p>

          <textarea
            placeholder="Add note..."
            value={note}
            onChange={(event) => setNote(event.target.value)}
            style={{
              ...inputStyle,
              width: "100%",
              minHeight: 80,
            }}
          />

          <button
            type="button"
            onClick={addTimelineNote}
            style={buttonStyle}
          >
            Add Note
          </button>

          {activities.length === 0 && <p>No timeline yet.</p>}

          {activities.map((activity) => (
            <div key={activity.id} style={timelineItem}>
              <strong>
                {activity.activity ||
                  activity.description ||
                  activity.activity_type}
              </strong>
              <br />
              <small>
                {new Date(activity.created_at).toLocaleString()}
              </small>
            </div>
          ))}
        </section>
      )}

      {bookingLead && (
        <section style={timelinePanel}>
          <button
            type="button"
            onClick={() => setBookingLead(null)}
            style={{ float: "right" }}
          >
            Close
          </button>

          <h2>Book Appointment</h2>
          <p>{bookingLead.full_name}</p>

          <input
            type="date"
            style={{ ...inputStyle, width: "100%" }}
            value={appointmentForm.appointment_date}
            onChange={(event) =>
              setAppointmentForm({
                ...appointmentForm,
                appointment_date: event.target.value,
              })
            }
          />

          <input
            type="time"
            style={{ ...inputStyle, width: "100%" }}
            value={appointmentForm.appointment_time}
            onChange={(event) =>
              setAppointmentForm({
                ...appointmentForm,
                appointment_time: event.target.value,
              })
            }
          />

          <input
            placeholder="Doctor / Practitioner"
            style={{ ...inputStyle, width: "100%" }}
            value={appointmentForm.doctor_name}
            onChange={(event) =>
              setAppointmentForm({
                ...appointmentForm,
                doctor_name: event.target.value,
              })
            }
          />

          <textarea
            placeholder="Appointment notes"
            style={{
              ...inputStyle,
              width: "100%",
              minHeight: 90,
            }}
            value={appointmentForm.notes}
            onChange={(event) =>
              setAppointmentForm({
                ...appointmentForm,
                notes: event.target.value,
              })
            }
          />

          <button
            type="button"
            onClick={saveAppointment}
            style={buttonStyle}
          >
            Save Appointment
          </button>
        </section>
      )}
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 32,
  fontFamily: "Arial, sans-serif",
  background: "#f7f8fb",
  minHeight: "100vh",
};

const loginPage: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Arial, sans-serif",
  background: "#f7f8fb",
};

const loginBox: React.CSSProperties = {
  background: "white",
  padding: 32,
  borderRadius: 20,
  width: 360,
  boxShadow: "0 12px 35px rgba(0,0,0,0.12)",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
  marginTop: 24,
};

const cardStyle: React.CSSProperties = {
  background: "white",
  padding: 18,
  borderRadius: 16,
  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
};

const panelStyle: React.CSSProperties = {
  background: "white",
  padding: 24,
  borderRadius: 20,
  marginTop: 28,
  marginBottom: 28,
  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const inputStyle: React.CSSProperties = {
  boxSizing: "border-box",
  padding: 12,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  marginBottom: 8,
  fontFamily: "inherit",
};

const buttonStyle: React.CSSProperties = {
  marginTop: 14,
  padding: "12px 18px",
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
};

const lightButton: React.CSSProperties = {
  marginTop: 10,
  padding: "9px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "white",
  cursor: "pointer",
  width: "100%",
};

const contactButton: React.CSSProperties = {
  ...lightButton,
  background: "#166534",
  borderColor: "#166534",
  color: "white",
  fontWeight: 700,
};

const pipelineGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(240px, 1fr))",
  gap: 16,
  overflowX: "auto",
  paddingBottom: 16,
};

const pipelineColumn: React.CSSProperties = {
  background: "#f1f3f7",
  padding: 14,
  borderRadius: 16,
  minHeight: 280,
};

const leadCard: React.CSSProperties = {
  background: "white",
  padding: 14,
  borderRadius: 14,
  marginBottom: 12,
  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
};

const timelinePanel: React.CSSProperties = {
  position: "fixed",
  right: 24,
  top: 24,
  bottom: 24,
  width: "min(420px, calc(100vw - 48px))",
  background: "white",
  padding: 24,
  borderRadius: 20,
  boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
  overflowY: "auto",
  zIndex: 30,
};

const timelineItem: React.CSSProperties = {
  borderLeft: "4px solid #111827",
  paddingLeft: 12,
  marginBottom: 16,
  marginTop: 16,
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 40,
  background: "rgba(17,24,39,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const modalStyle: React.CSSProperties = {
  width: "min(620px, 100%)",
  maxHeight: "92vh",
  overflowY: "auto",
  background: "white",
  padding: 24,
  borderRadius: 20,
  boxShadow: "0 24px 70px rgba(0,0,0,0.25)",
};

const closeButton: React.CSSProperties = {
  float: "right",
  border: "1px solid #d1d5db",
  background: "white",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginTop: 14,
  marginBottom: 6,
  fontWeight: 700,
};

const channelRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const channelButton: React.CSSProperties = {
  padding: 11,
  border: "1px solid #d1d5db",
  borderRadius: 10,
  background: "white",
  cursor: "pointer",
};

const activeChannelButton: React.CSSProperties = {
  ...channelButton,
  borderColor: "#166534",
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 700,
};

const messageBubble: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  marginTop: 14,
  lineHeight: 1.45,
};
