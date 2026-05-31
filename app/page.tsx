"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const PIN = "bodylab2026";

const statuses = ["New Lead", "Contacted", "Consultation Booked", "Converted", "Lost"];

const services = ["GP Weight Loss Consultation", "GLP-treatment Programme"];

const sources = ["WhatsApp", "Meta Lead Form", "Email", "Phone Call", "Website", "Manual Capture"];

type Lead = {
  id: string;
  first_name: string;
  surname: string;
  phone: string;
  email: string;
  service_interest: string;
  source: string;
  status: string;
  notes: string;
  created_at: string;
};

export default function Home() {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [form, setForm] = useState({
    first_name: "",
    surname: "",
    phone: "",
    email: "",
    service_interest: services[0],
    source: "Manual Capture",
    notes: "",
  });

  async function loadLeads() {
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    setLeads((data || []) as Lead[]);
  }

  useEffect(() => {
    if (loggedIn) loadLeads();
  }, [loggedIn]);

  async function addLead() {
    if (!form.first_name || !form.phone) {
      alert("First name and phone are required.");
      return;
    }

    const { error } = await supabase.from("leads").insert({
      ...form,
      status: "New Lead",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setForm({
      first_name: "",
      surname: "",
      phone: "",
      email: "",
      service_interest: services[0],
      source: "Manual Capture",
      notes: "",
    });

    loadLeads();
  }

  async function updateStatus(lead: Lead, status: string) {
    await supabase.from("leads").update({ status }).eq("id", lead.id);
    await supabase.from("activities").insert({
      lead_id: lead.id,
      activity: `Status changed to ${status}`,
    });
    loadLeads();
  }

  function whatsappLink(lead: Lead) {
    const phone = lead.phone.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Hi ${lead.first_name}, thank you for your interest in BodyLab. We received your enquiry for ${lead.service_interest}. Would you like help booking your consultation?`
    );
    return `https://wa.me/${phone}?text=${msg}`;
  }

  const stats = useMemo(() => ({
    total: leads.length,
    whatsapp: leads.filter(l => l.source === "WhatsApp").length,
    newLeads: leads.filter(l => l.status === "New Lead").length,
    booked: leads.filter(l => l.status === "Consultation Booked").length,
    converted: leads.filter(l => l.status === "Converted").length,
  }), [leads]);

  if (!loggedIn) {
    return (
      <main style={styles.loginPage}>
        <section style={styles.loginCard}>
          <h1 style={styles.logo}>BodyLab CRM</h1>
          <p style={styles.muted}>Admin dashboard for WhatsApp leads, consultations and GLP-treatment sales.</p>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={showPin ? "text" : "password"}
              placeholder="Enter admin PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={styles.input}
            />
            <button onClick={() => setShowPin(!showPin)} style={styles.secondaryBtn}>
              {showPin ? "Hide" : "Show"}
            </button>
          </div>

          <button
            onClick={() => pin === PIN ? setLoggedIn(true) : alert("Incorrect PIN")}
            style={styles.primaryBtn}
          >
            Login
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.logo}>BodyLab CRM</h1>
          <p style={styles.muted}>Monitor leads, trigger WhatsApp actions and track consultation conversions.</p>
        </div>
        <button onClick={() => setLoggedIn(false)} style={styles.secondaryBtn}>Logout</button>
      </header>

      <section style={styles.stats}>
        <Card label="Total Leads" value={stats.total} />
        <Card label="New Leads" value={stats.newLeads} />
        <Card label="WhatsApp Leads" value={stats.whatsapp} />
        <Card label="Booked" value={stats.booked} />
        <Card label="Converted" value={stats.converted} />
      </section>

      <section style={styles.panel}>
        <h2>Capture New Lead</h2>
        <p style={styles.muted}>Use this for email enquiries, calls, manual admin capture or walk-in leads.</p>

        <div style={styles.grid}>
          <input style={styles.input} placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          <input style={styles.input} placeholder="Surname" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
          <input style={styles.input} placeholder="Phone / WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input style={styles.input} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select style={styles.input} value={form.service_interest} onChange={(e) => setForm({ ...form, service_interest: e.target.value })}>
            {services.map(s => <option key={s}>{s}</option>)}
          </select>
          <select style={styles.input} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {sources.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <textarea
          style={{ ...styles.input, minHeight: 80, marginTop: 10 }}
          placeholder="Notes / patient interest / follow-up instruction"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <button onClick={addLead} style={styles.primaryBtn}>Save Lead</button>
      </section>

      <h2>Pipeline</h2>
      <section style={styles.pipeline}>
        {statuses.map(status => (
          <div key={status} style={styles.column}>
            <h3>{status}</h3>
            {leads.filter(l => l.status === status).map(lead => (
              <div key={lead.id} style={styles.leadCard}>
                <strong>{lead.first_name} {lead.surname}</strong>
                <p>{lead.service_interest}</p>
                <p>{lead.source} · {lead.phone}</p>

                <a href={whatsappLink(lead)} target="_blank" style={styles.whatsappBtn}>
                  WhatsApp Lead
                </a>

                <select style={styles.input} value={lead.status} onChange={(e) => updateStatus(lead, e.target.value)}>
                  {statuses.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.statCard}>
      <h2>{value}</h2>
      <p>{label}</p>
    </div>
  );
}

const styles: any = {
  page: { padding: 32, fontFamily: "Arial", background: "#f6f7fb", minHeight: "100vh" },
  loginPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial", background: "linear-gradient(135deg,#111827,#334155)" },
  loginCard: { background: "white", padding: 32, borderRadius: 18, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,.25)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  logo: { margin: 0, fontSize: 34 },
  muted: { color: "#64748b" },
  stats: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, margin: "25px 0" },
  statCard: { background: "white", padding: 20, borderRadius: 16, boxShadow: "0 8px 25px rgba(15,23,42,.08)" },
  panel: { background: "white", padding: 24, borderRadius: 18, boxShadow: "0 8px 25px rgba(15,23,42,.08)", marginBottom: 28 },
  grid: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 },
  input: { width: "100%", padding: 12, borderRadius: 10, border: "1px solid #d1d5db", boxSizing: "border-box" },
  primaryBtn: { marginTop: 12, padding: "12px 18px", borderRadius: 10, border: "none", background: "#111827", color: "white", cursor: "pointer" },
  secondaryBtn: { padding: "12px 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: "pointer" },
  pipeline: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 },
  column: { background: "white", padding: 14, borderRadius: 16, minHeight: 240 },
  leadCard: { border: "1px solid #e5e7eb", padding: 12, borderRadius: 12, marginBottom: 12, background: "#fafafa" },
  whatsappBtn: { display: "inline-block", marginBottom: 10, color: "#16a34a", fontWeight: "bold" },
};
