"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const PIN = "bodylab2026";

const statuses = ["New Lead", "Contacted", "Consultation Booked", "Converted", "Lost"];
const services = ["GP Weight Loss Consultation", "GLP-treatment programme"];
const sources = ["WhatsApp", "Meta Lead Form", "Email", "Phone Call", "Website", "Manual Capture"];

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
  created_at: string;
};

type Activity = {
  id: string;
  lead_id: string;
  activity: string;
  activity_type: string;
  created_by: string;
  created_at: string;
};

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [form, setForm] = useState({
    first_name: "",
    surname: "",
    phone: "",
    email: "",
    service_interest: "GP Weight Loss Consultation",
    source: "Manual Capture",
    notes: "",
  });

  useEffect(() => {
    const saved = localStorage.getItem("bodylab_logged_in");
    if (saved === "yes") {
      setLoggedIn(true);
      loadLeads();
    }
  }, []);

  async function loadLeads() {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setLeads(data || []);
  }

  async function loadActivities(leadId: string) {
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (!error) setActivities(data || []);
  }

  async function logActivity(leadId: string, activity: string, type = "note") {
    await supabase.from("activities").insert({
      lead_id: leadId,
      activity,
      activity_type: type,
      created_by: "admin",
    });
  }

  function login() {
    if (pin === PIN) {
      localStorage.setItem("bodylab_logged_in", "yes");
      setLoggedIn(true);
      loadLeads();
    } else {
      alert("Incorrect PIN");
    }
  }

  function logout() {
    localStorage.removeItem("bodylab_logged_in");
    setLoggedIn(false);
  }

  async function saveLead() {
    const payload = {
      ...form,
      full_name: `${form.first_name} ${form.surname}`,
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
    });

    loadLeads();
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

    await logActivity(lead.id, `Status changed to ${newStatus}`, "status_change");
    loadLeads();

    if (selectedLead?.id === lead.id) {
      loadActivities(lead.id);
    }
  }

  function openTimeline(lead: Lead) {
    setSelectedLead(lead);
    loadActivities(lead.id);
  }

  const stats = {
    total: leads.length,
    new: leads.filter((l) => l.status === "New Lead").length,
    contacted: leads.filter((l) => l.status === "Contacted").length,
    booked: leads.filter((l) => l.status === "Consultation Booked").length,
    converted: leads.filter((l) => l.status === "Converted").length,
    lost: leads.filter((l) => l.status === "Lost").length,
  };

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
              onChange={(e) => setPin(e.target.value)}
              style={inputStyle}
            />
            <button onClick={() => setShowPin(!showPin)} style={lightButton}>
              {showPin ? "Hide" : "Show"}
            </button>
          </div>

          <button onClick={login} style={buttonStyle}>Login</button>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <button onClick={logout} style={{ float: "right" }}>Logout</button>

      <h1>BodyLab CRM</h1>
      <p>Monitor leads, trigger WhatsApp actions and track consultation conversions.</p>

      <section style={statsGrid}>
        {[
          ["Total Leads", stats.total],
          ["New Leads", stats.new],
          ["Contacted", stats.contacted],
          ["Booked", stats.booked],
          ["Converted", stats.converted],
          ["Lost", stats.lost],
        ].map(([label, value]) => (
          <div key={label} style={cardStyle}>
            <h2>{value}</h2>
            <p>{label}</p>
          </div>
        ))}
      </section>

      <section style={panelStyle}>
        <h2>Capture New Lead</h2>
        <p>Use this for email enquiries, calls, manual admin capture or walk-in leads.</p>

        <div style={formGrid}>
          <input style={inputStyle} placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          <input style={inputStyle} placeholder="Surname" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
          <input style={inputStyle} placeholder="Phone / WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input style={inputStyle} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

          <select style={inputStyle} value={form.service_interest} onChange={(e) => setForm({ ...form, service_interest: e.target.value })}>
            {services.map((s) => <option key={s}>{s}</option>)}
          </select>

          <select style={inputStyle} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {sources.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <textarea
          placeholder="Notes / patient interest / follow-up instruction"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          style={{ ...inputStyle, width: "100%", minHeight: 90, marginTop: 12 }}
        />

        <button onClick={saveLead} style={buttonStyle}>Save Lead</button>
      </section>

      <h2>Pipeline</h2>

      <section style={pipelineGrid}>
        {statuses.map((status) => (
          <div key={status} style={pipelineColumn}>
            <h3>{status}</h3>

            {leads.filter((lead) => lead.status === status).map((lead) => (
              <div key={lead.id} style={leadCard}>
                <strong>{lead.full_name || `${lead.first_name} ${lead.surname}`}</strong>
                <p>{lead.phone}</p>
                <p>{lead.email}</p>

                <small><b>Service:</b><br />{lead.service_interest}</small><br /><br />
                <small><b>Source:</b><br />{lead.source}</small><br /><br />

                <a
                  href={`https://wa.me/${lead.phone?.replace(/^0/, "27")}?text=Hi%20${encodeURIComponent(lead.first_name || "")}%2C%20thank%20you%20for%20your%20interest%20in%20BodyLab.%20We%20received%20your%20enquiry%20for%20${encodeURIComponent(lead.service_interest || "")}.%20Would%20you%20like%20help%20booking%20your%20consultation%3F`}
                  target="_blank"
                  style={{ color: "green", fontWeight: "bold" }}
                >
                  WhatsApp Lead
                </a>

                <select
                  value={lead.status}
                  onChange={(e) => updateStatus(lead, e.target.value)}
                  style={{ ...inputStyle, width: "100%", marginTop: 10 }}
                >
                  {statuses.map((s) => <option key={s}>{s}</option>)}
                </select>

                <button onClick={() => openTimeline(lead)} style={lightButton}>
                  View Timeline
                </button>
              </div>
            ))}
          </div>
        ))}
      </section>

      {selectedLead && (
        <section style={timelinePanel}>
          <button onClick={() => setSelectedLead(null)} style={{ float: "right" }}>Close</button>
          <h2>Timeline</h2>
          <p>{selectedLead.full_name}</p>

          {activities.length === 0 && <p>No timeline yet.</p>}

          {activities.map((a) => (
            <div key={a.id} style={timelineItem}>
              <strong>{a.activity}</strong>
              <br />
              <small>{new Date(a.created_at).toLocaleString()}</small>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 32,
  fontFamily: "Arial",
  background: "#f7f8fb",
  minHeight: "100vh",
};

const loginPage: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Arial",
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
  gridTemplateColumns: "repeat(6, 1fr)",
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
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const inputStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  border: "1px solid #ddd",
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
  border: "1px solid #ddd",
  borderRadius: 8,
  background: "white",
  cursor: "pointer",
};

const pipelineGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 16,
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
  width: 360,
  background: "white",
  padding: 24,
  borderRadius: 20,
  boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
  overflowY: "auto",
};

const timelineItem: React.CSSProperties = {
  borderLeft: "4px solid #111827",
  paddingLeft: 12,
  marginBottom: 16,
};
