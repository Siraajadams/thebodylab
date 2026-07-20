"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Lead = {
  id: number;
  name: string;
  phone: string;
  source: string;
  service: string;
  status: string;
  createdAt: string;
};

const sampleLeads: Lead[] = [
  {
    id: 1,
    name: "Cheryl Daniels",
    phone: "082 555 0144",
    source: "WhatsApp",
    service: "GLP-1 Treatment Programme",
    status: "Consultation Booked",
    createdAt: "Today, 09:20",
  },
  {
    id: 2,
    name: "Nabeela Khan",
    phone: "073 555 0186",
    source: "Instagram",
    service: "GP Weight-Loss Consultation",
    status: "Contacted",
    createdAt: "Today, 08:45",
  },
  {
    id: 3,
    name: "Amanda Jacobs",
    phone: "079 555 0128",
    source: "Website",
    service: "GLP-1 Treatment Programme",
    status: "New Lead",
    createdAt: "Yesterday, 16:30",
  },
  {
    id: 4,
    name: "Thandi Molefe",
    phone: "076 555 0119",
    source: "Meta Lead Form",
    service: "GP Weight-Loss Consultation",
    status: "Converted",
    createdAt: "Yesterday, 14:10",
  },
  {
    id: 5,
    name: "Melissa Adams",
    phone: "083 555 0173",
    source: "Phone Call",
    service: "GLP-1 Treatment Programme",
    status: "Follow-up Required",
    createdAt: "Yesterday, 11:50",
  },
];

const statusStyles: Record<
  string,
  { background: string; color: string }
> = {
  "New Lead": {
    background: "#fff0f6",
    color: "#c83371",
  },
  Contacted: {
    background: "#f2edff",
    color: "#7650c7",
  },
  "Consultation Booked": {
    background: "#eaf2ff",
    color: "#3167bd",
  },
  Converted: {
    background: "#e9f8ef",
    color: "#247c4e",
  },
  "Follow-up Required": {
    background: "#fff6df",
    color: "#9b6515",
  },
};

export default function DashboardPage() {
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

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

    if (!query) {
      return sampleLeads;
    }

    return sampleLeads.filter((lead) =>
      [
        lead.name,
        lead.phone,
        lead.source,
        lead.service,
        lead.status,
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [search]);

  function logout() {
    window.localStorage.removeItem("bodylab_authenticated");
    router.replace("/login");
  }

  if (checkingAccess) {
    return (
      <main className="loadingPage">
        <div className="loadingCard">
          <div className="loadingLogo">B</div>
          <p>Opening BodyLab CRM...</p>
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
    <main className="dashboardPage">
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
          <Link href="/dashboard" className="navItem active">
            <span className="navIcon">▦</span>
            Dashboard
          </Link>

          <Link href="/leads" className="navItem">
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
              <p className="pageLabel">BODYLAB CRM</p>
              <h1>Dashboard</h1>
            </div>
          </div>

          <div className="topActions">
            <div className="searchBox">
              <span>⌕</span>
              <input
                type="search"
                placeholder="Search leads..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <Link href="/leads/new" className="addLeadButton">
              <span>＋</span>
              Add lead
            </Link>
          </div>
        </header>

        <div className="contentArea">
          <section className="welcomeCard">
            <div>
              <p className="welcomeLabel">PATIENT ENGAGEMENT OVERVIEW</p>
              <h2>Welcome back to BodyLab</h2>
              <p>
                Review new weight-loss enquiries, consultation bookings,
                follow-ups and patient conversions from one central dashboard.
              </p>
            </div>

            <Link href="/leads/new" className="welcomeButton">
              Capture new lead
              <span>→</span>
            </Link>
          </section>

          <section className="metricsGrid">
            <article className="metricCard">
              <div className="metricTop">
                <div className="metricIcon pink">↗</div>
                <span className="metricChange positive">+14%</span>
              </div>

              <p>New leads</p>
              <strong>48</strong>
              <small>Compared with last month</small>
            </article>

            <article className="metricCard">
              <div className="metricTop">
                <div className="metricIcon blue">□</div>
                <span className="metricChange positive">+8%</span>
              </div>

              <p>Consultations booked</p>
              <strong>31</strong>
              <small>12 appointments upcoming</small>
            </article>

            <article className="metricCard">
              <div className="metricTop">
                <div className="metricIcon green">✓</div>
                <span className="metricChange positive">+11%</span>
              </div>

              <p>Converted patients</p>
              <strong>22</strong>
              <small>45.8% lead conversion</small>
            </article>

            <article className="metricCard">
              <div className="metricTop">
                <div className="metricIcon amber">!</div>
                <span className="metricChange attention">Action</span>
              </div>

              <p>Follow-ups required</p>
              <strong>9</strong>
              <small>Patient responses outstanding</small>
            </article>
          </section>

          <section className="dashboardGrid">
            <article className="panel pipelinePanel">
              <div className="panelHeader">
                <div>
                  <p className="panelLabel">LEAD PIPELINE</p>
                  <h2>Patient conversion journey</h2>
                </div>

                <Link href="/leads">View all</Link>
              </div>

              <div className="pipelineList">
                <div className="pipelineRow">
                  <div className="pipelineDetails">
                    <span className="pipelineDot newLead" />
                    <div>
                      <strong>New Lead</strong>
                      <small>Awaiting first contact</small>
                    </div>
                  </div>

                  <div className="pipelineProgress">
                    <div style={{ width: "100%" }} />
                  </div>

                  <strong className="pipelineCount">48</strong>
                </div>

                <div className="pipelineRow">
                  <div className="pipelineDetails">
                    <span className="pipelineDot contacted" />
                    <div>
                      <strong>Contacted</strong>
                      <small>Initial conversation completed</small>
                    </div>
                  </div>

                  <div className="pipelineProgress">
                    <div style={{ width: "79%" }} />
                  </div>

                  <strong className="pipelineCount">38</strong>
                </div>

                <div className="pipelineRow">
                  <div className="pipelineDetails">
                    <span className="pipelineDot booked" />
                    <div>
                      <strong>Consultation Booked</strong>
                      <small>GP appointment confirmed</small>
                    </div>
                  </div>

                  <div className="pipelineProgress">
                    <div style={{ width: "65%" }} />
                  </div>

                  <strong className="pipelineCount">31</strong>
                </div>

                <div className="pipelineRow">
                  <div className="pipelineDetails">
                    <span className="pipelineDot converted" />
                    <div>
                      <strong>Converted</strong>
                      <small>Joined treatment programme</small>
                    </div>
                  </div>

                  <div className="pipelineProgress">
                    <div style={{ width: "46%" }} />
                  </div>

                  <strong className="pipelineCount">22</strong>
                </div>

                <div className="pipelineRow">
                  <div className="pipelineDetails">
                    <span className="pipelineDot lost" />
                    <div>
                      <strong>Lost</strong>
                      <small>Lead did not proceed</small>
                    </div>
                  </div>

                  <div className="pipelineProgress">
                    <div style={{ width: "15%" }} />
                  </div>

                  <strong className="pipelineCount">7</strong>
                </div>
              </div>
            </article>

            <article className="panel activityPanel">
              <div className="panelHeader">
                <div>
                  <p className="panelLabel">TODAY</p>
                  <h2>Upcoming activity</h2>
                </div>

                <Link href="/appointments">Calendar</Link>
              </div>

              <div className="activityList">
                <div className="activityItem">
                  <div className="activityTime">
                    <strong>09:30</strong>
                    <span>AM</span>
                  </div>

                  <div className="activityContent">
                    <strong>GP weight-loss consultation</strong>
                    <span>Cheryl Daniels</span>
                  </div>

                  <span className="activityStatus confirmed">Confirmed</span>
                </div>

                <div className="activityItem">
                  <div className="activityTime">
                    <strong>11:00</strong>
                    <span>AM</span>
                  </div>

                  <div className="activityContent">
                    <strong>Patient follow-up call</strong>
                    <span>Nabeela Khan</span>
                  </div>

                  <span className="activityStatus followup">Follow-up</span>
                </div>

                <div className="activityItem">
                  <div className="activityTime">
                    <strong>14:30</strong>
                    <span>PM</span>
                  </div>

                  <div className="activityContent">
                    <strong>GLP-1 programme consultation</strong>
                    <span>Amanda Jacobs</span>
                  </div>

                  <span className="activityStatus pending">Pending</span>
                </div>
              </div>
            </article>
          </section>

          <section className="panel leadsPanel">
            <div className="panelHeader leadsHeader">
              <div>
                <p className="panelLabel">RECENT ENQUIRIES</p>
                <h2>Latest patient leads</h2>
              </div>

              <div className="leadHeaderActions">
                <span>{filteredLeads.length} leads shown</span>
                <Link href="/leads">Manage leads</Link>
              </div>
            </div>

            <div className="tableWrapper">
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Source</th>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>

                <tbody>
                  {filteredLeads.map((lead) => {
                    const style =
                      statusStyles[lead.status] ?? statusStyles["New Lead"];

                    return (
                      <tr key={lead.id}>
                        <td>
                          <div className="patientCell">
                            <div className="patientAvatar">
                              {lead.name
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)}
                            </div>

                            <div>
                              <strong>{lead.name}</strong>
                              <span>{lead.phone}</span>
                            </div>
                          </div>
                        </td>

                        <td>{lead.source}</td>

                        <td>
                          <span className="serviceText">{lead.service}</span>
                        </td>

                        <td>
                          <span
                            className="statusBadge"
                            style={{
                              background: style.background,
                              color: style.color,
                            }}
                          >
                            {lead.status}
                          </span>
                        </td>

                        <td>{lead.createdAt}</td>

                        <td>
                          <Link
                            href={`/leads/${lead.id}`}
                            className="viewLeadButton"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredLeads.length === 0 && (
                <div className="emptyState">
                  <strong>No matching leads found.</strong>
                  <span>Try a different name, phone number or status.</span>
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

        .dashboardPage {
          min-height: 100vh;
          display: flex;
          background: #f8f5f9;
          color: #2f2435;
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

        .logoutButton:hover {
          background: rgba(255, 255, 255, 0.06);
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

        .topActions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .searchBox {
          width: 255px;
          height: 44px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 14px;
          border: 1px solid #e7dee8;
          border-radius: 12px;
          background: #fbf9fc;
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
          font-size: 12px;
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

        .welcomeCard {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 30px;
          padding: 31px 34px;
          border-radius: 23px;
          background:
            radial-gradient(
              circle at 90% 20%,
              rgba(244, 107, 161, 0.2),
              transparent 28%
            ),
            linear-gradient(135deg, #34213e, #63345d);
          color: white;
          box-shadow: 0 18px 45px rgba(72, 42, 78, 0.17);
        }

        .welcomeLabel {
          margin: 0 0 9px;
          color: #ff9cc4;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.14em;
        }

        .welcomeCard h2 {
          margin: 0 0 10px;
          font-size: 28px;
          letter-spacing: -0.03em;
        }

        .welcomeCard p:last-child {
          max-width: 680px;
          margin: 0;
          color: #dacddd;
          font-size: 13px;
          line-height: 1.65;
        }

        .welcomeButton {
          min-height: 47px;
          display: inline-flex;
          align-items: center;
          gap: 13px;
          flex: 0 0 auto;
          padding: 0 19px;
          border-radius: 12px;
          background: white;
          color: #4b2e54;
          font-size: 12px;
          font-weight: 850;
          text-decoration: none;
        }

        .metricsGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-top: 20px;
        }

        .metricCard {
          padding: 21px;
          border: 1px solid #ebe3ec;
          border-radius: 18px;
          background: white;
          box-shadow: 0 8px 25px rgba(64, 40, 73, 0.05);
        }

        .metricTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }

        .metricIcon {
          width: 37px;
          height: 37px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          font-weight: 900;
        }

        .metricIcon.pink {
          background: #fff0f6;
          color: #dc3d7b;
        }

        .metricIcon.blue {
          background: #edf4ff;
          color: #3c6fc0;
        }

        .metricIcon.green {
          background: #eaf8ef;
          color: #258456;
        }

        .metricIcon.amber {
          background: #fff5df;
          color: #9e6719;
        }

        .metricChange {
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 850;
        }

        .metricChange.positive {
          background: #eaf8ef;
          color: #267c51;
        }

        .metricChange.attention {
          background: #fff5df;
          color: #946118;
        }

        .metricCard > p {
          margin: 0 0 5px;
          color: #827485;
          font-size: 11px;
          font-weight: 750;
        }

        .metricCard > strong {
          display: block;
          margin-bottom: 5px;
          color: #34283a;
          font-size: 29px;
        }

        .metricCard > small {
          color: #a092a3;
          font-size: 9px;
        }

        .dashboardGrid {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 18px;
          margin-top: 18px;
        }

        .panel {
          border: 1px solid #eae2eb;
          border-radius: 19px;
          background: white;
          box-shadow: 0 8px 25px rgba(61, 39, 69, 0.04);
        }

        .pipelinePanel,
        .activityPanel {
          padding: 24px;
        }

        .panelHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 20px;
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
          font-size: 18px;
        }

        .panelHeader > a,
        .leadHeaderActions a {
          color: #bc3470;
          font-size: 10px;
          font-weight: 850;
          text-decoration: none;
        }

        .pipelineList {
          display: grid;
          gap: 19px;
          padding-top: 22px;
        }

        .pipelineRow {
          display: grid;
          grid-template-columns: 190px 1fr 30px;
          align-items: center;
          gap: 15px;
        }

        .pipelineDetails {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pipelineDot {
          width: 10px;
          height: 10px;
          flex: 0 0 auto;
          border-radius: 50%;
        }

        .pipelineDot.newLead {
          background: #e64583;
        }

        .pipelineDot.contacted {
          background: #9253cb;
        }

        .pipelineDot.booked {
          background: #4f78cf;
        }

        .pipelineDot.converted {
          background: #2e9b62;
        }

        .pipelineDot.lost {
          background: #aaa0ad;
        }

        .pipelineDetails strong {
          display: block;
          color: #4b3b50;
          font-size: 11px;
        }

        .pipelineDetails small {
          display: block;
          margin-top: 3px;
          color: #a093a2;
          font-size: 8px;
        }

        .pipelineProgress {
          height: 7px;
          overflow: hidden;
          border-radius: 999px;
          background: #efe8f0;
        }

        .pipelineProgress div {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #e84281, #a34dce);
        }

        .pipelineCount {
          color: #4d3d53;
          font-size: 11px;
          text-align: right;
        }

        .activityList {
          display: grid;
        }

        .activityItem {
          display: grid;
          grid-template-columns: 50px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 18px 0;
          border-bottom: 1px solid #f1ebf2;
        }

        .activityItem:last-child {
          border-bottom: 0;
        }

        .activityTime strong {
          display: block;
          color: #443548;
          font-size: 11px;
        }

        .activityTime span {
          color: #9e919f;
          font-size: 8px;
        }

        .activityContent strong {
          display: block;
          color: #48394d;
          font-size: 10px;
        }

        .activityContent span {
          display: block;
          margin-top: 4px;
          color: #9a8c9c;
          font-size: 9px;
        }

        .activityStatus {
          padding: 5px 7px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 850;
        }

        .activityStatus.confirmed {
          background: #e9f8ef;
          color: #267d50;
        }

        .activityStatus.followup {
          background: #fff5df;
          color: #996317;
        }

        .activityStatus.pending {
          background: #f2edff;
          color: #7351bd;
        }

        .leadsPanel {
          margin-top: 18px;
          overflow: hidden;
        }

        .leadsHeader {
          padding: 23px 24px;
        }

        .leadHeaderActions {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .leadHeaderActions span {
          color: #998d9b;
          font-size: 9px;
        }

        .tableWrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          padding: 14px 18px;
          background: #fbf9fc;
          color: #918494;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.07em;
          text-align: left;
          text-transform: uppercase;
        }

        td {
          padding: 15px 18px;
          border-top: 1px solid #f0eaf1;
          color: #685a6d;
          font-size: 10px;
          white-space: nowrap;
        }

        .patientCell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .patientAvatar {
          width: 37px;
          height: 37px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 12px;
          background: #fff0f6;
          color: #ce3974;
          font-size: 10px;
          font-weight: 900;
        }

        .patientCell strong {
          display: block;
          color: #493a4e;
          font-size: 10px;
        }

        .patientCell span {
          display: block;
          margin-top: 4px;
          color: #9e929f;
          font-size: 8px;
        }

        .serviceText {
          display: block;
          max-width: 210px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .statusBadge {
          display: inline-flex;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 850;
        }

        .viewLeadButton {
          padding: 6px 9px;
          border: 1px solid #e5dce7;
          border-radius: 8px;
          color: #b2356d;
          font-size: 8px;
          font-weight: 850;
          text-decoration: none;
        }

        .emptyState {
          display: grid;
          gap: 6px;
          place-items: center;
          padding: 45px;
          color: #766879;
        }

        .emptyState strong {
          font-size: 13px;
        }

        .emptyState span {
          color: #a294a4;
          font-size: 10px;
        }

        .menuOverlay {
          display: none;
        }

        @media (max-width: 1100px) {
          .metricsGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .dashboardGrid {
            grid-template-columns: 1fr;
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

          .searchBox {
            display: none;
          }

          .welcomeCard {
            align-items: flex-start;
          }
        }

        @media (max-width: 650px) {
          .topBar {
            align-items: center;
          }

          .topBar h1 {
            font-size: 20px;
          }

          .addLeadButton {
            padding: 0 13px;
          }

          .metricsGrid {
            grid-template-columns: 1fr;
          }

          .welcomeCard {
            display: grid;
            padding: 25px;
          }

          .welcomeCard h2 {
            font-size: 24px;
          }

          .welcomeButton {
            width: fit-content;
          }

          .pipelineRow {
            grid-template-columns: 145px 1fr 25px;
          }

          .leadHeaderActions span {
            display: none;
          }
        }

        @media (max-width: 430px) {
          .addLeadButton {
            font-size: 0;
          }

          .addLeadButton span {
            font-size: 18px;
          }

          .pipelineRow {
            grid-template-columns: 1fr 25px;
          }

          .pipelineProgress {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </main>
  );
}
