"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type LeadStatus =
  | "New Lead"
  | "Contacted"
  | "Consultation Booked"
  | "Converted"
  | "Lost";

type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  source: string;
  service: string;
  status: LeadStatus;
  assignedTo: string;
  createdAt: string;
  lastContact: string;
};

const sampleLeads: Lead[] = [
  {
    id: "BL-1001",
    firstName: "Cheryl",
    lastName: "Daniels",
    phone: "082 555 0144",
    email: "cheryl@example.com",
    source: "WhatsApp",
    service: "GLP-1 Treatment Programme",
    status: "Consultation Booked",
    assignedTo: "BodyLab Admin",
    createdAt: "20 Jul 2026",
    lastContact: "Today, 09:20",
  },
  {
    id: "BL-1002",
    firstName: "Nabeela",
    lastName: "Khan",
    phone: "073 555 0186",
    email: "nabeela@example.com",
    source: "Instagram",
    service: "GP Weight-Loss Consultation",
    status: "Contacted",
    assignedTo: "BodyLab Admin",
    createdAt: "20 Jul 2026",
    lastContact: "Today, 08:45",
  },
  {
    id: "BL-1003",
    firstName: "Amanda",
    lastName: "Jacobs",
    phone: "079 555 0128",
    email: "amanda@example.com",
    source: "Website",
    service: "GLP-1 Treatment Programme",
    status: "New Lead",
    assignedTo: "Unassigned",
    createdAt: "19 Jul 2026",
    lastContact: "Not contacted",
  },
  {
    id: "BL-1004",
    firstName: "Thandi",
    lastName: "Molefe",
    phone: "076 555 0119",
    email: "thandi@example.com",
    source: "Meta Lead Form",
    service: "GP Weight-Loss Consultation",
    status: "Converted",
    assignedTo: "BodyLab Admin",
    createdAt: "19 Jul 2026",
    lastContact: "Yesterday, 14:10",
  },
  {
    id: "BL-1005",
    firstName: "Melissa",
    lastName: "Adams",
    phone: "083 555 0173",
    email: "melissa@example.com",
    source: "Phone Call",
    service: "GLP-1 Treatment Programme",
    status: "Contacted",
    assignedTo: "BodyLab Admin",
    createdAt: "18 Jul 2026",
    lastContact: "Yesterday, 11:50",
  },
  {
    id: "BL-1006",
    firstName: "Leanne",
    lastName: "Petersen",
    phone: "072 555 0165",
    email: "leanne@example.com",
    source: "Email",
    service: "GP Weight-Loss Consultation",
    status: "Lost",
    assignedTo: "BodyLab Admin",
    createdAt: "17 Jul 2026",
    lastContact: "17 Jul 2026",
  },
];

const statuses: LeadStatus[] = [
  "New Lead",
  "Contacted",
  "Consultation Booked",
  "Converted",
  "Lost",
];

const sources = [
  "All Sources",
  "WhatsApp",
  "Instagram",
  "Website",
  "Meta Lead Form",
  "Phone Call",
  "Email",
  "Manual Capture",
];

const statusStyles: Record<
  LeadStatus,
  { background: string; color: string; dot: string }
> = {
  "New Lead": {
    background: "#fff0f6",
    color: "#c83371",
    dot: "#e64583",
  },
  Contacted: {
    background: "#f2edff",
    color: "#7650c7",
    dot: "#9253cb",
  },
  "Consultation Booked": {
    background: "#eaf2ff",
    color: "#3167bd",
    dot: "#4f78cf",
  },
  Converted: {
    background: "#e9f8ef",
    color: "#247c4e",
    dot: "#2e9b62",
  },
  Lost: {
    background: "#f1eef2",
    color: "#766d79",
    dot: "#aaa0ad",
  },
};

export default function LeadsPage() {
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [sourceFilter, setSourceFilter] = useState("All Sources");
  const [leads, setLeads] = useState<Lead[]>(sampleLeads);

  useEffect(() => {
    const authenticated =
      window.localStorage.getItem("bodylab_authenticated") === "true";

    if (!authenticated) {
      router.replace("/login");
      return;
    }

    setCheckingAccess(false);
  }, [router]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesSearch =
        !query ||
        [
          lead.id,
          lead.firstName,
          lead.lastName,
          lead.phone,
          lead.email,
          lead.source,
          lead.service,
          lead.status,
        ].some((value) => value.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "All Statuses" || lead.status === statusFilter;

      const matchesSource =
        sourceFilter === "All Sources" || lead.source === sourceFilter;

      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [leads, search, sourceFilter, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: leads.length,
      newLeads: leads.filter((lead) => lead.status === "New Lead").length,
      booked: leads.filter(
        (lead) => lead.status === "Consultation Booked"
      ).length,
      converted: leads.filter((lead) => lead.status === "Converted").length,
    };
  }, [leads]);

  function logout() {
    window.localStorage.removeItem("bodylab_authenticated");
    router.replace("/login");
  }

  function updateLeadStatus(id: string, status: LeadStatus) {
    setLeads((currentLeads) =>
      currentLeads.map((lead) =>
        lead.id === id
          ? {
              ...lead,
              status,
              lastContact: "Updated just now",
            }
          : lead
      )
    );
  }

  if (checkingAccess) {
    return (
      <main className="loadingPage">
        <div className="loadingCard">
          <div className="loadingLogo">B</div>
          <p>Opening BodyLab leads...</p>
        </div>

        <style jsx>{`
          .loadingPage {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            background: linear-gradient(135deg, #fff7fb, #f6eff9);
            font-family: Arial, sans-serif;
          }

          .loadingCard {
            text-align: center;
            color: #5f4c61;
          }

          .loadingLogo {
            width: 60px;
            height: 60px;
            display: grid;
            place-items: center;
            margin: 0 auto 16px;
            border-radius: 18px;
            background: linear-gradient(135deg, #e84282, #9a4dce);
            color: white;
            font-size: 28px;
            font-weight: 900;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <aside className={`sidebar ${menuOpen ? "sidebarOpen" : ""}`}>
        <div className="sidebarHeader">
          <Link href="/dashboard" className="brand">
            <div className="brandMark">B</div>

            <div>
              <div className="brandName">
                BODY<span>LAB</span>
              </div>
              <div className="brandSubtitle">Weight-Loss CRM</div>
            </div>
          </Link>

          <button
            type="button"
            className="closeMenu"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <nav className="sidebarNav">
          <Link href="/dashboard" className="navItem">
            <span className="navIcon">▦</span>
            Dashboard
          </Link>

          <Link href="/leads" className="navItem active">
            <span className="navIcon">◎</span>
            Leads
          </Link>

          <Link href="/conversations" className="navItem">
            <span className="navIcon">◌</span>
            Conversations
          </Link>

          <Link href="/appointments" className="navItem">
            <span className="navIcon">□</span>
            Appointments
          </Link>

          <Link href="/patients" className="navItem">
            <span className="navIcon">♙</span>
            Patients
          </Link>

          <Link href="/reports" className="navItem">
            <span className="navIcon">↗</span>
            Reports
          </Link>
        </nav>

        <div className="sidebarFooter">
          <div className="userCard">
            <div className="userAvatar">BA</div>

            <div>
              <strong>BodyLab Admin</strong>
              <span>Authorised staff</span>
            </div>
          </div>

          <button type="button" className="logoutButton" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      {menuOpen && (
        <button
          type="button"
          className="menuOverlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      <section className="mainContent">
        <header className="topBar">
          <div className="topBarLeft">
            <button
              type="button"
              className="mobileMenuButton"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>

            <div>
              <p className="pageLabel">PATIENT PIPELINE</p>
              <h1>Leads</h1>
            </div>
          </div>

          <Link href="/leads/new" className="addLeadButton">
            <span>＋</span>
            Add new lead
          </Link>
        </header>

        <div className="contentArea">
          <section className="summaryGrid">
            <article className="summaryCard">
              <div className="summaryIcon pink">◎</div>
              <div>
                <p>Total leads</p>
                <strong>{summary.total}</strong>
              </div>
            </article>

            <article className="summaryCard">
              <div className="summaryIcon purple">↗</div>
              <div>
                <p>New leads</p>
                <strong>{summary.newLeads}</strong>
              </div>
            </article>

            <article className="summaryCard">
              <div className="summaryIcon blue">□</div>
              <div>
                <p>Consultations booked</p>
                <strong>{summary.booked}</strong>
              </div>
            </article>

            <article className="summaryCard">
              <div className="summaryIcon green">✓</div>
              <div>
                <p>Converted</p>
                <strong>{summary.converted}</strong>
              </div>
            </article>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="panelLabel">LEAD MANAGEMENT</p>
                <h2>All patient enquiries</h2>
                <span>
                  Manage prospective patients from first enquiry to conversion.
                </span>
              </div>

              <div className="resultCount">
                {filteredLeads.length} of {leads.length} leads
              </div>
            </div>

            <div className="filters">
              <div className="searchBox">
                <span>⌕</span>
                <input
                  type="search"
                  placeholder="Search name, phone, email or lead ID..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option>All Statuses</option>
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>

              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                {sources.map((source) => (
                  <option key={source}>{source}</option>
                ))}
              </select>

              <button
                type="button"
                className="clearButton"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("All Statuses");
                  setSourceFilter("All Sources");
                }}
              >
                Clear filters
              </button>
            </div>

            <div className="tableWrapper">
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Contact</th>
                    <th>Source</th>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Assigned to</th>
                    <th>Last activity</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {filteredLeads.map((lead) => {
                    const statusStyle = statusStyles[lead.status];
                    const initials = `${lead.firstName.charAt(
                      0
                    )}${lead.lastName.charAt(0)}`;

                    return (
                      <tr key={lead.id}>
                        <td>
                          <div className="patientCell">
                            <div className="patientAvatar">{initials}</div>

                            <div>
                              <strong>
                                {lead.firstName} {lead.lastName}
                              </strong>
                              <span>{lead.id}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="contactCell">
                            <strong>{lead.phone}</strong>
                            <span>{lead.email}</span>
                          </div>
                        </td>

                        <td>{lead.source}</td>

                        <td>
                          <span className="serviceText">{lead.service}</span>
                        </td>

                        <td>
                          <select
                            className="statusSelect"
                            value={lead.status}
                            onChange={(event) =>
                              updateLeadStatus(
                                lead.id,
                                event.target.value as LeadStatus
                              )
                            }
                            style={{
                              background: statusStyle.background,
                              color: statusStyle.color,
                            }}
                          >
                            {statuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>{lead.assignedTo}</td>

                        <td>
                          <div className="activityCell">
                            <strong>{lead.lastContact}</strong>
                            <span>Created {lead.createdAt}</span>
                          </div>
                        </td>

                        <td>
                          <div className="rowActions">
                            <Link
                              href={`/leads/${lead.id}`}
                              className="viewButton"
                            >
                              View
                            </Link>

                            <Link
                              href={`/leads/${lead.id}/edit`}
                              className="editButton"
                            >
                              Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredLeads.length === 0 && (
                <div className="emptyState">
                  <div className="emptyIcon">⌕</div>
                  <strong>No matching leads found</strong>
                  <span>
                    Try changing the search term or removing a filter.
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          display: flex;
          background: #f8f5f9;
          color: #302437;
          font-family:
            Inter,
            Arial,
            Helvetica,
            sans-serif;
        }

        .sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          z-index: 40;
          width: 260px;
          display: flex;
          flex-direction: column;
          padding: 24px 18px;
          background: #24182c;
          color: white;
        }

        .sidebarHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 8px 25px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
          color: white;
          text-decoration: none;
        }

        .brandMark {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: linear-gradient(135deg, #e84282, #974bce);
          color: white;
          font-size: 22px;
          font-weight: 900;
        }

        .brandName {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 0.03em;
        }

        .brandName span {
          color: #ff74a9;
        }

        .brandSubtitle {
          margin-top: 4px;
          color: #a998ad;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .closeMenu {
          display: none;
          border: 0;
          background: transparent;
          color: white;
          font-size: 28px;
          cursor: pointer;
        }

        .sidebarNav {
          display: grid;
          gap: 7px;
          margin-top: 28px;
        }

        .navItem {
          min-height: 47px;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 0 15px;
          border-radius: 12px;
          color: #c6b9ca;
          font-size: 13px;
          font-weight: 750;
          text-decoration: none;
          transition: 0.2s ease;
        }

        .navItem:hover {
          background: rgba(255, 255, 255, 0.07);
          color: white;
        }

        .navItem.active {
          background: linear-gradient(
            135deg,
            rgba(231, 65, 130, 0.25),
            rgba(151, 75, 206, 0.22)
          );
          color: white;
        }

        .navIcon {
          width: 25px;
          display: inline-grid;
          place-items: center;
          color: #f175a8;
          font-size: 17px;
        }

        .sidebarFooter {
          margin-top: auto;
          padding-top: 22px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .userCard {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 10px;
        }

        .userAvatar {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.1);
          color: #ff91ba;
          font-size: 11px;
          font-weight: 900;
        }

        .userCard strong {
          display: block;
          font-size: 12px;
        }

        .userCard span {
          display: block;
          margin-top: 4px;
          color: #9d8ea2;
          font-size: 9px;
        }

        .logoutButton {
          width: 100%;
          margin-top: 10px;
          padding: 11px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 11px;
          background: transparent;
          color: #d8ccd9;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }

        .mainContent {
          min-width: 0;
          width: calc(100% - 260px);
          margin-left: 260px;
        }

        .topBar {
          min-height: 88px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 30px;
          padding: 16px 32px;
          border-bottom: 1px solid #eae2eb;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(15px);
        }

        .topBarLeft {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .pageLabel {
          margin: 0 0 4px;
          color: #d53b79;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.13em;
        }

        .topBar h1 {
          margin: 0;
          color: #302437;
          font-size: 24px;
          letter-spacing: -0.03em;
        }

        .mobileMenuButton {
          display: none;
          width: 42px;
          height: 42px;
          border: 1px solid #e8dfe9;
          border-radius: 11px;
          background: white;
          color: #4e3b55;
          font-size: 19px;
          cursor: pointer;
        }

        .addLeadButton {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 17px;
          border-radius: 12px;
          background: linear-gradient(135deg, #e64080, #a04bcc);
          color: white;
          font-size: 12px;
          font-weight: 850;
          text-decoration: none;
          box-shadow: 0 10px 25px rgba(201, 59, 132, 0.23);
        }

        .contentArea {
          padding: 28px 32px 50px;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 18px;
        }

        .summaryCard {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 20px;
          border: 1px solid #ebe3ec;
          border-radius: 17px;
          background: white;
          box-shadow: 0 8px 25px rgba(64, 40, 73, 0.05);
        }

        .summaryIcon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 13px;
          font-weight: 900;
        }

        .summaryIcon.pink {
          background: #fff0f6;
          color: #dc3d7b;
        }

        .summaryIcon.purple {
          background: #f2edff;
          color: #7650c7;
        }

        .summaryIcon.blue {
          background: #edf4ff;
          color: #3c6fc0;
        }

        .summaryIcon.green {
          background: #eaf8ef;
          color: #258456;
        }

        .summaryCard p {
          margin: 0 0 4px;
          color: #897b8d;
          font-size: 10px;
          font-weight: 750;
        }

        .summaryCard strong {
          color: #382b3e;
          font-size: 24px;
        }

        .panel {
          overflow: hidden;
          border: 1px solid #eae2eb;
          border-radius: 19px;
          background: white;
          box-shadow: 0 8px 25px rgba(61, 39, 69, 0.04);
        }

        .panelHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 24px;
          border-bottom: 1px solid #f0e9f1;
        }

        .panelLabel {
          margin: 0 0 6px;
          color: #d63c79;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.11em;
        }

        .panelHeader h2 {
          margin: 0;
          color: #382b3e;
          font-size: 19px;
        }

        .panelHeader > div > span {
          display: block;
          margin-top: 6px;
          color: #958797;
          font-size: 10px;
        }

        .resultCount {
          padding: 7px 10px;
          border-radius: 999px;
          background: #f6eff7;
          color: #7b6382;
          font-size: 9px;
          font-weight: 800;
        }

        .filters {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 190px 180px auto;
          gap: 12px;
          padding: 18px 24px;
          border-bottom: 1px solid #f0e9f1;
          background: #fcfafc;
        }

        .searchBox {
          height: 43px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 14px;
          border: 1px solid #e7dee8;
          border-radius: 11px;
          background: white;
        }

        .searchBox span {
          color: #918395;
        }

        .searchBox input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #48384f;
          font-size: 11px;
        }

        .filters select {
          height: 43px;
          padding: 0 12px;
          border: 1px solid #e7dee8;
          border-radius: 11px;
          outline: 0;
          background: white;
          color: #5d4c63;
          font-size: 10px;
        }

        .clearButton {
          height: 43px;
          padding: 0 14px;
          border: 1px solid #e4dbe6;
          border-radius: 11px;
          background: white;
          color: #8a3c66;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .tableWrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1200px;
          border-collapse: collapse;
        }

        th {
          padding: 14px 16px;
          background: #fbf9fc;
          color: #918494;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.07em;
          text-align: left;
          text-transform: uppercase;
        }

        td {
          padding: 15px 16px;
          border-top: 1px solid #f0eaf1;
          color: #685a6d;
          font-size: 10px;
          vertical-align: middle;
        }

        .patientCell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 170px;
        }

        .patientAvatar {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 12px;
          background: #fff0f6;
          color: #ce3974;
          font-size: 10px;
          font-weight: 900;
        }

        .patientCell strong,
        .contactCell strong,
        .activityCell strong {
          display: block;
          color: #493a4e;
          font-size: 10px;
        }

        .patientCell span,
        .contactCell span,
        .activityCell span {
          display: block;
          margin-top: 4px;
          color: #9e929f;
          font-size: 8px;
        }

        .serviceText {
          display: block;
          max-width: 190px;
          line-height: 1.45;
        }

        .statusSelect {
          min-width: 145px;
          padding: 7px 9px;
          border: 0;
          border-radius: 999px;
          outline: 0;
          font-size: 8px;
          font-weight: 850;
          cursor: pointer;
        }

        .rowActions {
          display: flex;
          gap: 7px;
        }

        .viewButton,
        .editButton {
          padding: 7px 9px;
          border-radius: 8px;
          font-size: 8px;
          font-weight: 850;
          text-decoration: none;
        }

        .viewButton {
          background: #fff0f6;
          color: #bd336d;
        }

        .editButton {
          border: 1px solid #e5dce7;
          color: #73577b;
        }

        .emptyState {
          display: grid;
          place-items: center;
          padding: 55px 20px;
          text-align: center;
        }

        .emptyIcon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          margin-bottom: 13px;
          border-radius: 15px;
          background: #f7eff8;
          color: #b13b70;
          font-size: 22px;
        }

        .emptyState strong {
          color: #554459;
          font-size: 13px;
        }

        .emptyState span {
          margin-top: 6px;
          color: #9a8c9c;
          font-size: 10px;
        }

        .menuOverlay {
          display: none;
        }

        @media (max-width: 1100px) {
          .summaryGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .filters {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 850px) {
          .sidebar {
            transform: translateX(-100%);
            transition: transform 0.25s ease;
          }

          .sidebarOpen {
            transform: translateX(0);
          }

          .closeMenu {
            display: block;
          }

          .menuOverlay {
            position: fixed;
            inset: 0;
            z-index: 30;
            display: block;
            border: 0;
            background: rgba(28, 19, 32, 0.5);
          }

          .mainContent {
            width: 100%;
            margin-left: 0;
          }

          .mobileMenuButton {
            display: block;
          }

          .topBar {
            padding: 15px 20px;
          }

          .contentArea {
            padding: 22px 20px 40px;
          }
        }

        @media (max-width: 620px) {
          .summaryGrid,
          .filters {
            grid-template-columns: 1fr;
          }

          .panelHeader {
            align-items: flex-start;
          }

          .resultCount {
            display: none;
          }

          .addLeadButton {
            padding: 0 13px;
          }
        }

        @media (max-width: 430px) {
          .addLeadButton {
            font-size: 0;
          }

          .addLeadButton span {
            font-size: 18px;
          }

          .summaryGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
