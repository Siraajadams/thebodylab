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
  "Consultation Completed",
  "Converted",
  "Lost",
];

const services = [
  "GP Weight Loss Consultation",
  "GLP-treatment Programme",
];

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
  const [loggedIn, setLoggedIn] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    surname: "",
    phone: "",
    email: "",
    service_interest: "GP Weight Loss Consultation",
    source: "Manual Capture",
    notes: "",
  });

  async function loadLeads() {
    setLoading(true);
    const { data } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    setLeads((data || []) as Lead[]);
    setLoading(false);
  }

  useEffect(() => {
    if (loggedIn) loadLeads();
  }, [loggedIn]);

  async function addLead() {
    if (!form.first_name || !form.phone) {
      alert("Name and phone number are required.");
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
      service_interest: "GP Weight Loss Consultation",
      source: "Manual Capture",
      notes: "",
    });

    await loadLeads();
  }

  async function updateStatus(lead: Lead, status: string) {
    await supabase.from("leads").update({ status }).eq("id", lead.id);

    await supabase.from("activities").insert({
      lead_id: lead.id,
      activity: `Status changed to ${status}`,
    });

    await loadLeads();
  }

  function whatsappLink(lead: Lead) {
    const phone = lead.phone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Hi ${lead.first_name}, thank you for your interest in BodyLab. We received your enquiry for ${lead.service_interest}. Would you like us to assist you with booking your consultation?`
    );
    return `https://wa.me/${phone}?text=${message}`;
  }

  const stats = useMemo(() => {
    const total = leads.length;
    const newLeads = leads.filter((l) => l.status === "New Lead").length;
    const booked = leads.filter((l) => l.status === "Consultation Booked").length;
    const converted = leads.filter((l) => l.status === "Converted").length;
    return { total, newLeads, booked, converted };
  }, [leads]);

  if (!loggedIn) {
    return (
      <main style={{ padding: 40, fontFamily: "Arial", maxWidth: 420 }}>
        <h1>BodyLab CRM Login</h1>
        <p>Enter admin PIN to continue.</p>
        <input
          type="password"
          placeholder="Admin PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{ width: "100%", padding: 12, marginBottom: 12 }}
        />
        <button
          onClick={() => pin === PIN ? setLoggedIn(true) : alert("Incorrect PIN")}
          style={{ padding: 12, width: "100%", cursor: "pointer" }}
        >
          Login
        </button>
      </main>
    );
  }

  return (
    <main style={{ padding: 30, fontFamily: "Arial" }}>
      <h1>BodyLab CRM</h1>
      <p>Lead pipeline, WhatsApp engagement and consultation tracking.</p>

      <section style={{ display: "flex", gap: 12, margin: "20px 0" }}>
        {[
          ["Total Leads", stats.total],
          ["New Leads", stats.newLeads],
          ["Booked", stats.booked],
          ["Converted", stats.converted],
        ].map(([label, value]) => (
          <div key={label} style={{ border: "1px solid #ddd", padding: 16, borderRadius: 10, minWidth: 140 }}>
            <strong>{value}</strong>
            <p>{label}</p>
          </div>
        ))}
      </section>

      <section style={{ border: "1px solid #ddd", padding: 20, borderRadius: 10, marginBottom: 25 }}>
        <h2>Capture New Lead</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          <input placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          <input placeholder="Surname" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select value={form.service_interest} onChange={(e) => setForm({ ...form, service_interest: e.target.value })}>
            {services.map((s) => <option key={s}>{s}</option>)}
          </select>
          <input placeholder="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
        </div>
        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          style={{ width: "100%", marginTop: 10, minHeight: 70 }}
        />
        <button onClick={addLead} style={{ marginTop: 10, padding: 12 }}>
          Save Lead
        </button>
      </section>

      <h2>Sales Pipeline</h2>
      {loading ? <p>Loading...</p> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 15 }}>
          {statuses.map((status) => (
            <div key={status} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
              <h3>{status}</h3>
              {leads.filter((l) => l.status === status).map((lead) => (
                <div key={lead.id} style={{ border: "1px solid #eee", padding: 12, borderRadius: 8, marginBottom: 10 }}>
                  <strong>{lead.first_name} {lead.surname}</strong>
                  <p>{lead.service_interest}</p>
                  <p>{lead.phone}</p>
                  <a href={whatsappLink(lead)} target="_blank">WhatsApp Lead</a>
                  <br /><br />
                  <select value={lead.status} onChange={(e) => updateStatus(lead, e.target.value)}>
                    {statuses.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
