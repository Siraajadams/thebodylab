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
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

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
    setErrorMsg("");

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg("Could not load leads: " + error.message);
      return;
    }

    setLeads((data || []) as Lead[]);
  }

  useEffect(() => {
    if (loggedIn) {
      loadLeads();
    }
  }, [loggedIn]);

  async function addLead() {
    setErrorMsg("");

    if (!form.first_name || !form.phone) {
      setErrorMsg("First name and phone number are required.");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("leads")
      .insert({
        first_name: form.first_name,
        surname: form.surname,
        phone: form.phone,
        email: form.email,
        service_interest: form.service_interest,
        source: form.source,
        notes: form.notes,
        status: "New Lead",
      })
      .select()
      .single();

    if (error) {
      setSaving(false);
      setErrorMsg("Could not save lead: " + error.message);
      return;
    }

    await supabase.from("activities").insert({
      lead_id: data.id,
      activity: `Lead created from ${form.source}`,
    });

    setForm({
      first_name: "",
      surname: "",
      phone: "",
      email: "",
      service_interest: services[0],
      source: "Manual Capture",
      notes: "",
    });

    setSaving(false);
    await loadLeads();
  }

  async function updateStatus(lead: Lead, status: string) {
    setErrorMsg("");

    const { error } = await supabase
      .from("leads")
      .update({ status })
      .eq("id", lead.id);

    if (error) {
      setErrorMsg("Could not update status: " + error.message);
      return;
    }

    await supabase.from("activities").insert({
      lead_id: lead.id,
      activity: `Status changed from ${lead.status} to ${status}`,
    });

    await loadLeads();
  }

  function whatsappLink(lead: Lead) {
    const phone = lead.phone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Hi ${lead.first_name}, thank you for your interest in BodyLab. We received your enquiry for ${lead.service_interest}. Would you like help booking your consultation?`
    );

    return `https://wa.me/${phone}?text=${message}`;
  }

  const stats = useMemo(() => {
    return {
      total: leads.length,
      newLeads: leads.filter((l) => l.status === "New Lead").length,
      whatsapp: leads.filter((l) => l.source === "WhatsApp").length,
      booked: leads.filter((l) => l.status === "Consultation Booked").length,
      converted: leads.filter((l) => l.status === "Converted").length,
    };
  }, [leads]);

  if (!loggedIn) {
    return (
      <main style={styles.loginPage}>
        <section style={styles.loginCard}>
          <h1>BodyLab CRM</h1>
          <p style={styles.muted}>Admin login for lead tracking and consultation management.</p>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={showPin ? "text" : "password"}
              placeholder="Enter admin PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={styles.input}
            />
            <button style={styles.secondaryBtn} onClick={() => setShowPin(!showPin)}>
              {showPin ? "Hide" : "Show"}
            </button>
          </div>

          <button
            style={styles.primaryBtn}
            onClick={() => (pin === PIN ? setLoggedIn(true) : setErrorMsg("Incorrect PIN"))}
          >
            Login
          </button>

          {errorMsg && <p style={styles.error}>{errorMsg}</p>}
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1>BodyLab CRM</h1>
          <p style={styles.muted}>Live Supabase-connected lead dashboard.</p>
        </div>
        <button style={styles.secondaryBtn} onClick={() => setLoggedIn(false)}>
          Logout
        </button>
      </header>

      {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}

      <section style={styles.stats}>
        <Card label="Total Leads" value={stats.total} />
        <Card label="New Leads" value={stats.newLeads} />
        <Card label="WhatsApp Leads" value={stats.whatsapp} />
        <Card label="Booked" value={stats.booked} />
        <Card label="Converted" value={stats.converted} />
      </section>

      <section style={styles.panel}>
        <h2>Capture New Lead</h2>
        <p style={styles.muted}>Use this for email, phone, website, WhatsApp or manual lead capture.</p>

        <div style={styles.grid}>
          <input style={styles.input} placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          <input style={styles.input} placeholder="Surname" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
          <input style={styles.input} placeholder="Phone / WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input style={styles.input} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

          <select style={styles.input} value={form.service_interest} onChange={(e) => setForm({ ...form, service_interest: e.target.value })}>
            {services.map((service) => (
              <option key={service}>{service}</option>
            ))}
          </select>

          <select style={styles.input} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {sources.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </select>
        </div>

        <textarea
          style={{ ...styles.input, minHeight: 80, marginTop: 10 }}
          placeholder="Notes / patient interest / follow-up instruction"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <button style={styles.primaryBtn} onClick={addLead} disabled={saving}>
          {saving ? "Saving..." : "Save Lead"}
        </button>
      </section>

      <h2>Pipeline</h2>

      <section style={styles.pipeline}>
        {statuses.map((status) => (
          <div key={status} style={styles.column}>
            <h3>{status}</h3>

            {leads.filter((lead) => lead.status === status).map((lead) => (
              <div key={lead.id} style={styles.leadCard}>
                <strong>{lead.first_name} {lead.surname}</strong>
                <p>{lead.service_interest}</p>
                <p>{lead.source}</p>
                <p>{lead.phone}</p>

                <a href={whatsappLink(lead)} target="_blank" style={styles.whatsappBtn}>
                  WhatsApp Lead
                </a>

                <select
                  style={styles.input}
                  value={lead.status}
                  onChange={(e) => updateStatus(lead, e.target.value)}
                >
                  {statuses.map((statusOption) => (
                    <option key={statusOption}>{statusOption}</option>
                  ))}
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
  page: {
    padding: 32,
    fontFamily: "Arial",
    background: "#f6f7fb",
    minHeight: "100vh",
  },
  loginPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Arial",
    background: "linear-gradient(135deg,#111827,#334155)",
  },
  loginCard: {
    background: "white",
    padding: 32,
    borderRadius: 18,
    width: 420,
    boxShadow: "0 20px 60px rgba(0,0,0,.25)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  muted: {
    color: "#64748b",
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(5,1fr)",
    gap: 14,
    margin: "25px 0",
  },
  statCard: {
    background: "white",
    padding: 20,
    borderRadius: 16,
    boxShadow: "0 8px 25px rgba(15,23,42,.08)",
  },
  panel: {
    background: "white",
    padding: 24,
    borderRadius: 18,
    boxShadow: "0 8px 25px rgba(15,23,42,.08)",
    marginBottom: 28,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2,1fr)",
    gap: 10,
  },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    boxSizing: "border-box",
  },
  primaryBtn: {
    marginTop: 12,
    padding: "12px 18px",
    borderRadius: 10,
    border: "none",
    background: "#111827",
    color: "white",
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "white",
    cursor: "pointer",
  },
  pipeline: {
    display: "grid",
    gridTemplateColumns: "repeat(5,1fr)",
    gap: 14,
  },
  column: {
    background: "white",
    padding: 14,
    borderRadius: 16,
    minHeight: 240,
  },
  leadCard: {
    border: "1px solid #e5e7eb",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    background: "#fafafa",
  },
  whatsappBtn: {
    display: "inline-block",
    marginBottom: 10,
    color: "#16a34a",
    fontWeight: "bold",
  },
  error: {
    color: "red",
    marginTop: 12,
  },
  errorBox: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
    marginBottom: 16,
  },
};
