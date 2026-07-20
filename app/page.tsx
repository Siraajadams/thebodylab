"use client";

import Link from "next/link";
import { useState } from "react";

const features = [
  {
    number: "01",
    title: "Lead Management",
    description:
      "Capture, organise and follow up with prospective weight-loss patients from WhatsApp, social media, website enquiries and manual referrals.",
  },
  {
    number: "02",
    title: "WhatsApp Conversations",
    description:
      "Manage patient conversations, send personalised replies and guide leads from their first enquiry to a confirmed consultation.",
  },
  {
    number: "03",
    title: "Consultation Bookings",
    description:
      "Schedule GP weight-loss consultations, record appointment details and keep your team informed about upcoming bookings.",
  },
  {
    number: "04",
    title: "Patient Journey",
    description:
      "Track every lead through New Lead, Contacted, Consultation Booked, Converted or Lost stages.",
  },
  {
    number: "05",
    title: "Team Activity",
    description:
      "Record calls, notes, messages and follow-up actions so that every team member has a complete patient history.",
  },
  {
    number: "06",
    title: "Performance Dashboard",
    description:
      "View leads, conversions, appointments and outstanding follow-ups from one central CRM dashboard.",
  },
];

const workflow = [
  {
    step: "1",
    title: "Lead captured",
    description:
      "A prospective patient contacts BodyLab through WhatsApp, social media, email, phone or the website.",
  },
  {
    step: "2",
    title: "Lead assessed",
    description:
      "The team confirms the patient's goals, preferred service and readiness to book a consultation.",
  },
  {
    step: "3",
    title: "Consultation booked",
    description:
      "A GP weight-loss consultation is scheduled and the patient receives the necessary booking information.",
  },
  {
    step: "4",
    title: "Patient converted",
    description:
      "The patient joins the BodyLab weight-loss programme and continues through the clinical care pathway.",
  },
];

const services = [
  "GP Weight-Loss Consultation",
  "GLP-1 Treatment Programme",
  "Appointment Management",
  "WhatsApp Lead Follow-up",
  "Patient Notes and Activity History",
  "Conversion and Pipeline Reporting",
];

export default function BodyLabLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="page">
      <header className="header">
        <div className="headerInner">
          <Link href="/" className="brand" aria-label="BodyLab CRM home">
            <div className="brandMark">B</div>

            <div>
              <div className="brandName">
                BODY<span>LAB</span>
              </div>
              <div className="brandSubtitle">Weight-Loss CRM</div>
            </div>
          </Link>

          <nav className={`nav ${menuOpen ? "navOpen" : ""}`}>
            <a href="#features" onClick={() => setMenuOpen(false)}>
              Features
            </a>

            <a href="#workflow" onClick={() => setMenuOpen(false)}>
              How it works
            </a>

            <a href="#services" onClick={() => setMenuOpen(false)}>
              Services
            </a>

            <a href="#security" onClick={() => setMenuOpen(false)}>
              Security
            </a>

            <Link
              href="/login"
              className="mobileLogin"
              onClick={() => setMenuOpen(false)}
            >
              Staff login
            </Link>
          </nav>

          <div className="headerActions">
            <Link href="/login" className="loginButton">
              Staff login
            </Link>

            <button
              type="button"
              className="menuButton"
              aria-label="Open navigation menu"
              onClick={() => setMenuOpen((current) => !current)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="heroGlow heroGlowOne" />
        <div className="heroGlow heroGlowTwo" />

        <div className="heroInner">
          <div className="heroContent">
            <div className="eyebrow">
              <span className="eyebrowDot" />
              BODYLAB PATIENT ENGAGEMENT PLATFORM
            </div>

            <h1>
              Turn weight-loss enquiries into
              <span> confirmed patients.</span>
            </h1>

            <p className="heroText">
              A central CRM for managing BodyLab leads, WhatsApp conversations,
              consultation bookings, follow-ups and patient conversions.
            </p>

            <div className="heroActions">
  <Link href="/login" className="primaryButton">
    Access BodyLab CRM
    <span aria-hidden="true">→</span>
  </Link>

  <a href="#features" className="secondaryButton">
    Explore features
  </a>
</div>

              <a href="#features" className="secondaryButton">
                Explore features
              </a>
            </div>

            <div className="heroTrust">
              <div className="trustItem">
                <div className="trustIcon">✓</div>
                Secure staff access
              </div>

              <div className="trustItem">
                <div className="trustIcon">✓</div>
                Centralised lead tracking
              </div>

              <div className="trustItem">
                <div className="trustIcon">✓</div>
                WhatsApp-enabled workflow
              </div>
            </div>
          </div>

          <div className="heroVisual">
            <div className="dashboardCard">
              <div className="dashboardTop">
                <div>
                  <p className="dashboardLabel">BodyLab CRM</p>
                  <h2>Lead Overview</h2>
                </div>

                <div className="liveBadge">
                  <span />
                  Live
                </div>
              </div>

              <div className="metricGrid">
                <div className="metricCard">
                  <div className="metricIcon pink">↗</div>
                  <p>New leads</p>
                  <strong>48</strong>
                  <small>+14% this month</small>
                </div>

                <div className="metricCard">
                  <div className="metricIcon purple">✓</div>
                  <p>Consultations</p>
                  <strong>31</strong>
                  <small>12 upcoming</small>
                </div>

                <div className="metricCard">
                  <div className="metricIcon green">◎</div>
                  <p>Converted</p>
                  <strong>22</strong>
                  <small>45.8% conversion</small>
                </div>
              </div>

              <div className="pipelineCard">
                <div className="pipelineHeader">
                  <div>
                    <p>Lead pipeline</p>
                    <strong>Active patient enquiries</strong>
                  </div>
                  <span>This month</span>
                </div>

                <div className="pipelineRow">
                  <div className="pipelineName">
                    <span className="pipelineDot new" />
                    New Lead
                  </div>
                  <div className="pipelineBar">
                    <div style={{ width: "88%" }} />
                  </div>
                  <strong>48</strong>
                </div>

                <div className="pipelineRow">
                  <div className="pipelineName">
                    <span className="pipelineDot contacted" />
                    Contacted
                  </div>
                  <div className="pipelineBar">
                    <div style={{ width: "70%" }} />
                  </div>
                  <strong>38</strong>
                </div>

                <div className="pipelineRow">
                  <div className="pipelineName">
                    <span className="pipelineDot booked" />
                    Consultation booked
                  </div>
                  <div className="pipelineBar">
                    <div style={{ width: "57%" }} />
                  </div>
                  <strong>31</strong>
                </div>

                <div className="pipelineRow">
                  <div className="pipelineName">
                    <span className="pipelineDot converted" />
                    Converted
                  </div>
                  <div className="pipelineBar">
                    <div style={{ width: "41%" }} />
                  </div>
                  <strong>22</strong>
                </div>
              </div>
            </div>

            <div className="floatingCard followUpCard">
              <div className="floatingIcon">↗</div>
              <div>
                <p>Conversion rate</p>
                <strong>45.8%</strong>
              </div>
            </div>

            <div className="floatingCard messageCard">
              <div className="messageAvatar">WA</div>
              <div>
                <p>WhatsApp lead</p>
                <strong>New enquiry received</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="statsSection">
        <div className="statsGrid">
          <div className="stat">
            <strong>1</strong>
            <span>Central platform</span>
          </div>

          <div className="stat">
            <strong>5</strong>
            <span>Pipeline stages</span>
          </div>

          <div className="stat">
            <strong>24/7</strong>
            <span>Lead capture</span>
          </div>

          <div className="stat">
            <strong>100%</strong>
            <span>Patient journey visibility</span>
          </div>
        </div>
      </section>

      <section id="features" className="section lightSection">
        <div className="sectionHeader">
          <div className="sectionEyebrow">CRM FEATURES</div>
          <h2>Everything your team needs to manage the patient journey</h2>
          <p>
            BodyLab CRM brings lead capture, communication, appointments and
            follow-up activities into one organised platform.
          </p>
        </div>

        <div className="featureGrid">
          {features.map((feature) => (
            <article className="featureCard" key={feature.title}>
              <div className="featureNumber">{feature.number}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="section workflowSection">
        <div className="workflowLayout">
          <div className="workflowIntro">
            <div className="sectionEyebrow darkEyebrow">
              SIMPLE PATIENT WORKFLOW
            </div>

            <h2>From first enquiry to treatment programme</h2>

            <p>
              Give your team a clear process for responding to leads and
              supporting patients through each stage of their BodyLab journey.
            </p>

            <Link href="/login" className="whiteButton">
              Open the CRM
              <span>→</span>
            </Link>
          </div>

          <div className="workflowSteps">
            {workflow.map((item) => (
              <div className="workflowItem" key={item.step}>
                <div className="stepNumber">{item.step}</div>

                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="services" className="section servicesSection">
        <div className="servicesLayout">
          <div className="servicesCard">
            <div className="servicesCardHeader">
              <div className="servicesLogo">B</div>

              <div>
                <p>BodyLab</p>
                <strong>Weight-Loss Programme</strong>
              </div>
            </div>

            <div className="serviceMockup">
              <div className="serviceMockupTop">
                <span>Patient journey</span>
                <span className="activeStatus">Active</span>
              </div>

              <div className="journeyItem completed">
                <div>✓</div>
                <span>Lead captured</span>
              </div>

              <div className="journeyLine" />

              <div className="journeyItem completed">
                <div>✓</div>
                <span>Patient contacted</span>
              </div>

              <div className="journeyLine" />

              <div className="journeyItem current">
                <div>3</div>
                <span>Consultation booked</span>
              </div>

              <div className="journeyLine mutedLine" />

              <div className="journeyItem pending">
                <div>4</div>
                <span>Programme enrolment</span>
              </div>
            </div>
          </div>

          <div className="servicesContent">
            <div className="sectionEyebrow">BODYLAB SERVICES</div>

            <h2>Built for a doctor-supervised weight-loss service</h2>

            <p>
              The CRM supports the operational journey behind BodyLab&apos;s
              weight-loss consultations and GLP-1 treatment programme.
            </p>

            <div className="serviceList">
              {services.map((service) => (
                <div className="serviceItem" key={service}>
                  <span>✓</span>
                  {service}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="security" className="section securitySection">
        <div className="securityCard">
          <div className="securityIcon">◈</div>

          <div className="securityContent">
            <div className="sectionEyebrow darkEyebrow">
              SECURE TEAM ACCESS
            </div>

            <h2>Patient information managed responsibly</h2>

            <p>
              BodyLab CRM is designed for authorised team members, with secure
              access, organised activity records and centralised patient
              communication.
            </p>
          </div>

          <div className="securityPoints">
            <div>
              <span>✓</span>
              Authorised staff access
            </div>

            <div>
              <span>✓</span>
              Central patient records
            </div>

            <div>
              <span>✓</span>
              Activity and follow-up history
            </div>
          </div>
        </div>
      </section>

      <section className="ctaSection">
        <div className="ctaGlow" />

        <div className="ctaContent">
          <div className="sectionEyebrow darkEyebrow">BODYLAB CRM</div>

          <h2>Manage every weight-loss lead from one platform.</h2>

          <p>
            Sign in to view leads, conversations, appointments, patient notes
            and conversion activity.
          </p>

          <Link href="/login" className="whiteButton largeButton">
            Staff login
            <span>→</span>
          </Link>
        </div>
      </section>

      <footer className="footer">
        <div className="footerInner">
          <div className="footerBrand">
            <div className="brandMark smallMark">B</div>

            <div>
              <div className="brandName footerBrandName">
                BODY<span>LAB</span>
              </div>
              <p>Weight-Loss CRM</p>
            </div>
          </div>

          <p className="footerText">
            A patient engagement and lead-management platform for the BodyLab
            weight-loss programme.
          </p>

          <div className="footerLinks">
            <Link href="/login">Staff login</Link>
            <a href="#features">Features</a>
            <a href="#security">Security</a>
          </div>
        </div>

        <div className="footerBottom">
          <p>© {new Date().getFullYear()} BodyLab. All rights reserved.</p>
          <p>Powered by Videomed</p>
        </div>
      </footer>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        .page {
          min-height: 100vh;
          overflow-x: hidden;
          background: #ffffff;
          color: #251c33;
          font-family:
            Inter,
            Arial,
            Helvetica,
            sans-serif;
        }

        .header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(255, 255, 255, 0.94);
          border-bottom: 1px solid rgba(61, 37, 76, 0.08);
          backdrop-filter: blur(18px);
        }

        .headerInner {
          width: min(1180px, calc(100% - 40px));
          height: 78px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 30px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          color: inherit;
          text-decoration: none;
        }

        .brandMark {
          width: 43px;
          height: 43px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          background: linear-gradient(135deg, #ef4e8b, #8a4bd9);
          color: white;
          font-size: 23px;
          font-weight: 900;
          box-shadow: 0 10px 28px rgba(199, 67, 139, 0.25);
        }

        .brandName {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 0.03em;
          line-height: 1;
        }

        .brandName span {
          color: #e94386;
        }

        .brandSubtitle {
          margin-top: 5px;
          color: #806f8d;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .nav {
          display: flex;
          align-items: center;
          gap: 31px;
        }

        .nav a {
          color: #5f5269;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          transition: 0.2s ease;
        }

        .nav a:hover {
          color: #df3e80;
        }

        .mobileLogin {
          display: none;
        }

        .headerActions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .loginButton {
          padding: 12px 20px;
          border-radius: 12px;
          background: #33233e;
          color: white;
          font-size: 14px;
          font-weight: 800;
          text-decoration: none;
          box-shadow: 0 9px 25px rgba(51, 35, 62, 0.18);
          transition: 0.2s ease;
        }

        .loginButton:hover {
          transform: translateY(-2px);
          background: #4a2e59;
        }

        .menuButton {
          width: 42px;
          height: 42px;
          display: none;
          padding: 0;
          border: 0;
          border-radius: 12px;
          background: #f7f1f7;
          cursor: pointer;
        }

        .menuButton span {
          width: 19px;
          height: 2px;
          display: block;
          margin: 4px auto;
          border-radius: 2px;
          background: #3d2b47;
        }

        .hero {
          position: relative;
          overflow: hidden;
          padding: 88px 0 100px;
          background:
            radial-gradient(
              circle at 12% 10%,
              rgba(255, 188, 216, 0.34),
              transparent 29%
            ),
            radial-gradient(
              circle at 88% 90%,
              rgba(173, 133, 232, 0.25),
              transparent 31%
            ),
            linear-gradient(135deg, #fff8fb 0%, #faf8ff 53%, #f7effb 100%);
        }

        .heroGlow {
          position: absolute;
          border-radius: 999px;
          filter: blur(4px);
          pointer-events: none;
        }

        .heroGlowOne {
          width: 280px;
          height: 280px;
          top: -150px;
          right: 15%;
          background: rgba(244, 105, 160, 0.13);
        }

        .heroGlowTwo {
          width: 240px;
          height: 240px;
          bottom: -150px;
          left: 8%;
          background: rgba(132, 81, 200, 0.12);
        }

        .heroInner {
          position: relative;
          z-index: 2;
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(460px, 0.95fr);
          align-items: center;
          gap: 70px;
        }

        .eyebrow,
        .sectionEyebrow {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          color: #db3c7b;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .eyebrow {
          padding: 9px 13px;
          border: 1px solid rgba(224, 68, 130, 0.17);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.7);
        }

        .eyebrowDot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #e94788;
          box-shadow: 0 0 0 5px rgba(233, 71, 136, 0.13);
        }

        .hero h1 {
          max-width: 710px;
          margin: 25px 0 24px;
          color: #2f2138;
          font-size: clamp(46px, 5.4vw, 73px);
          font-weight: 900;
          letter-spacing: -0.055em;
          line-height: 1.02;
        }

        .hero h1 span {
          display: block;
          background: linear-gradient(90deg, #e94082, #a64fd3);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .heroText {
          max-width: 630px;
          margin: 0;
          color: #6d5e76;
          font-size: 18px;
          line-height: 1.75;
        }

        .heroButtons {
          display: flex;
          flex-wrap: wrap;
          gap: 13px;
          margin-top: 34px;
        }

        .primaryButton,
        .secondaryButton,
        .whiteButton {
          min-height: 53px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 0 24px;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 850;
          text-decoration: none;
          transition: 0.2s ease;
        }

        .primaryButton {
          background: linear-gradient(135deg, #e94182, #a349cf);
          color: white;
          box-shadow: 0 15px 35px rgba(205, 64, 138, 0.27);
        }

        .primaryButton:hover {
          transform: translateY(-3px);
          box-shadow: 0 18px 40px rgba(205, 64, 138, 0.34);
        }

        .secondaryButton {
          border: 1px solid rgba(74, 45, 84, 0.15);
          background: rgba(255, 255, 255, 0.78);
          color: #473653;
        }

        .secondaryButton:hover {
          transform: translateY(-2px);
          border-color: rgba(223, 62, 128, 0.35);
        }

        .heroTrust {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin-top: 34px;
        }

        .trustItem {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #716278;
          font-size: 13px;
          font-weight: 700;
        }

        .trustIcon {
          width: 21px;
          height: 21px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #ecf9f1;
          color: #258a55;
          font-size: 12px;
          font-weight: 900;
        }

        .heroVisual {
          position: relative;
          min-height: 570px;
          display: flex;
          align-items: center;
        }

        .dashboardCard {
          position: relative;
          z-index: 2;
          width: 100%;
          padding: 27px;
          border: 1px solid rgba(83, 56, 95, 0.1);
          border-radius: 29px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 35px 90px rgba(89, 55, 104, 0.17);
          backdrop-filter: blur(20px);
          transform: rotate(1.5deg);
        }

        .dashboardTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 23px;
        }

        .dashboardLabel {
          margin: 0 0 5px;
          color: #df4282;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .dashboardTop h2 {
          margin: 0;
          color: #35263f;
          font-size: 22px;
        }

        .liveBadge {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 10px;
          border-radius: 999px;
          background: #e9f8ef;
          color: #217a4c;
          font-size: 11px;
          font-weight: 800;
        }

        .liveBadge span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #2ba668;
        }

        .metricGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 11px;
        }

        .metricCard {
          padding: 15px;
          border: 1px solid #f0e9f2;
          border-radius: 18px;
          background: #fff;
        }

        .metricIcon {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          margin-bottom: 12px;
          border-radius: 10px;
          font-weight: 900;
        }

        .metricIcon.pink {
          background: #fff0f6;
          color: #e83f81;
        }

        .metricIcon.purple {
          background: #f3edff;
          color: #8a4bd9;
        }

        .metricIcon.green {
          background: #eaf8ef;
          color: #23865a;
        }

        .metricCard p {
          margin: 0 0 5px;
          color: #87788e;
          font-size: 11px;
          font-weight: 700;
        }

        .metricCard strong {
          display: block;
          color: #33263c;
          font-size: 24px;
        }

        .metricCard small {
          color: #9a8da0;
          font-size: 9px;
        }

        .pipelineCard {
          margin-top: 18px;
          padding: 19px;
          border-radius: 19px;
          background: #faf7fb;
        }

        .pipelineHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 18px;
        }

        .pipelineHeader p {
          margin: 0 0 4px;
          color: #9a899f;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .pipelineHeader strong {
          color: #43334d;
          font-size: 13px;
        }

        .pipelineHeader > span {
          color: #9a8ba0;
          font-size: 10px;
        }

        .pipelineRow {
          display: grid;
          grid-template-columns: 132px 1fr 25px;
          align-items: center;
          gap: 10px;
          margin-top: 13px;
        }

        .pipelineName {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #6c5e72;
          font-size: 10px;
          font-weight: 700;
        }

        .pipelineDot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .pipelineDot.new {
          background: #eb4787;
        }

        .pipelineDot.contacted {
          background: #9d56d8;
        }

        .pipelineDot.booked {
          background: #5c79db;
        }

        .pipelineDot.converted {
          background: #30a66a;
        }

        .pipelineBar {
          height: 7px;
          overflow: hidden;
          border-radius: 999px;
          background: #ece3ef;
        }

        .pipelineBar div {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #e94686, #a84fd2);
        }

        .pipelineRow > strong {
          color: #4d3b56;
          font-size: 11px;
          text-align: right;
        }

        .floatingCard {
          position: absolute;
          z-index: 4;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 13px 16px;
          border: 1px solid rgba(84, 58, 94, 0.1);
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 19px 45px rgba(81, 51, 92, 0.17);
        }

        .floatingCard p {
          margin: 0 0 3px;
          color: #9b8ba1;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .floatingCard strong {
          color: #49364f;
          font-size: 12px;
        }

        .followUpCard {
          right: -27px;
          top: 75px;
        }

        .floatingIcon {
          width: 37px;
          height: 37px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: #eaf8f0;
          color: #258b59;
          font-weight: 900;
        }

        .messageCard {
          left: -42px;
          bottom: 61px;
        }

        .messageAvatar {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #e7f8ee;
          color: #208553;
          font-size: 10px;
          font-weight: 900;
        }

        .statsSection {
          position: relative;
          z-index: 5;
          width: min(1050px, calc(100% - 40px));
          margin: -42px auto 0;
          padding: 27px 35px;
          border: 1px solid rgba(76, 51, 87, 0.08);
          border-radius: 23px;
          background: white;
          box-shadow: 0 20px 55px rgba(64, 41, 73, 0.11);
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }

        .stat {
          padding: 3px 25px;
          text-align: center;
          border-right: 1px solid #eee6ef;
        }

        .stat:last-child {
          border-right: 0;
        }

        .stat strong {
          display: block;
          margin-bottom: 6px;
          color: #db3f7e;
          font-size: 27px;
          font-weight: 900;
        }

        .stat span {
          color: #7c6e83;
          font-size: 12px;
          font-weight: 700;
        }

        .section {
          padding: 110px 0;
        }

        .lightSection {
          background: #fff;
        }

        .sectionHeader {
          width: min(740px, calc(100% - 40px));
          margin: 0 auto 55px;
          text-align: center;
        }

        .sectionHeader h2,
        .servicesContent h2,
        .workflowIntro h2,
        .securityContent h2,
        .ctaContent h2 {
          margin: 15px 0 18px;
          color: #302139;
          font-size: clamp(34px, 4vw, 52px);
          font-weight: 900;
          letter-spacing: -0.04em;
          line-height: 1.1;
        }

        .sectionHeader p,
        .servicesContent > p,
        .workflowIntro > p,
        .securityContent p,
        .ctaContent p {
          margin: 0;
          color: #74667b;
          font-size: 16px;
          line-height: 1.75;
        }

        .featureGrid {
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }

        .featureCard {
          min-height: 275px;
          padding: 29px;
          border: 1px solid #eee6ef;
          border-radius: 23px;
          background: linear-gradient(145deg, #ffffff, #fdfafe);
          transition: 0.25s ease;
        }

        .featureCard:hover {
          transform: translateY(-7px);
          border-color: rgba(226, 67, 129, 0.23);
          box-shadow: 0 22px 50px rgba(86, 56, 96, 0.1);
        }

        .featureNumber {
          width: 45px;
          height: 45px;
          display: grid;
          place-items: center;
          margin-bottom: 25px;
          border-radius: 14px;
          background: #fff0f6;
          color: #df3f7e;
          font-size: 12px;
          font-weight: 900;
        }

        .featureCard h3 {
          margin: 0 0 13px;
          color: #392a42;
          font-size: 20px;
        }

        .featureCard p {
          margin: 0;
          color: #7a6c81;
          font-size: 14px;
          line-height: 1.75;
        }

        .workflowSection {
          background: linear-gradient(135deg, #30203b, #4b2d59 55%, #6a3260);
        }

        .workflowLayout {
          width: min(1120px, calc(100% - 40px));
          margin: 0 auto;
          display: grid;
          grid-template-columns: 0.85fr 1.15fr;
          gap: 90px;
          align-items: center;
        }

        .darkEyebrow {
          color: #ff9fc5;
        }

        .workflowIntro h2,
        .securityContent h2,
        .ctaContent h2 {
          color: white;
        }

        .workflowIntro > p {
          color: #d6c9db;
        }

        .whiteButton {
          margin-top: 30px;
          background: white;
          color: #472b53;
          box-shadow: 0 14px 35px rgba(25, 12, 31, 0.22);
        }

        .whiteButton:hover {
          transform: translateY(-3px);
        }

        .workflowSteps {
          display: grid;
          gap: 14px;
        }

        .workflowItem {
          display: grid;
          grid-template-columns: 54px 1fr;
          gap: 18px;
          align-items: flex-start;
          padding: 22px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 19px;
          background: rgba(255, 255, 255, 0.07);
          backdrop-filter: blur(12px);
        }

        .stepNumber {
          width: 50px;
          height: 50px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          background: linear-gradient(135deg, #ef4f8c, #9e4fd2);
          color: white;
          font-weight: 900;
        }

        .workflowItem h3 {
          margin: 2px 0 8px;
          color: white;
          font-size: 18px;
        }

        .workflowItem p {
          margin: 0;
          color: #d9ccdc;
          font-size: 13px;
          line-height: 1.65;
        }

        .servicesSection {
          background: #fbf8fc;
        }

        .servicesLayout {
          width: min(1120px, calc(100% - 40px));
          margin: 0 auto;
          display: grid;
          grid-template-columns: 0.9fr 1fr;
          gap: 90px;
          align-items: center;
        }

        .servicesCard {
          padding: 28px;
          border: 1px solid #eee5ef;
          border-radius: 29px;
          background: white;
          box-shadow: 0 30px 70px rgba(78, 49, 88, 0.12);
        }

        .servicesCardHeader {
          display: flex;
          align-items: center;
          gap: 13px;
          padding-bottom: 22px;
          border-bottom: 1px solid #f0e8f1;
        }

        .servicesLogo {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          background: linear-gradient(135deg, #ee4b89, #964bd1);
          color: white;
          font-size: 22px;
          font-weight: 900;
        }

        .servicesCardHeader p {
          margin: 0 0 4px;
          color: #e24381;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .servicesCardHeader strong {
          color: #493651;
          font-size: 15px;
        }

        .serviceMockup {
          padding: 27px 10px 10px;
        }

        .serviceMockupTop {
          display: flex;
          justify-content: space-between;
          margin-bottom: 27px;
          color: #847489;
          font-size: 12px;
          font-weight: 800;
        }

        .activeStatus {
          padding: 5px 9px;
          border-radius: 999px;
          background: #e9f8ef;
          color: #258454;
          font-size: 10px;
        }

        .journeyItem {
          display: grid;
          grid-template-columns: 36px 1fr;
          align-items: center;
          gap: 12px;
          color: #57475d;
          font-size: 13px;
          font-weight: 800;
        }

        .journeyItem > div {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          font-weight: 900;
        }

        .journeyItem.completed > div {
          background: #eaf8ef;
          color: #27895a;
        }

        .journeyItem.current > div {
          background: linear-gradient(135deg, #ed4887, #a14ed1);
          color: white;
        }

        .journeyItem.pending {
          color: #a99eac;
        }

        .journeyItem.pending > div {
          background: #f1edf2;
          color: #9d90a2;
        }

        .journeyLine {
          width: 2px;
          height: 30px;
          margin: 3px 0 3px 17px;
          background: #b8e3c8;
        }

        .mutedLine {
          background: #e5dfe7;
        }

        .serviceList {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
          margin-top: 30px;
        }

        .serviceItem {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #57485e;
          font-size: 13px;
          font-weight: 750;
        }

        .serviceItem span {
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 50%;
          background: #fff0f6;
          color: #dd3d7c;
          font-size: 11px;
          font-weight: 900;
        }

        .securitySection {
          background: #fff;
        }

        .securityCard {
          width: min(1120px, calc(100% - 40px));
          margin: 0 auto;
          display: grid;
          grid-template-columns: 80px 1fr 0.8fr;
          gap: 35px;
          align-items: center;
          padding: 48px;
          border-radius: 29px;
          background: linear-gradient(135deg, #34213e, #64355f);
          box-shadow: 0 28px 75px rgba(65, 38, 74, 0.19);
        }

        .securityIcon {
          width: 72px;
          height: 72px;
          display: grid;
          place-items: center;
          border-radius: 21px;
          background: rgba(255, 255, 255, 0.12);
          color: #ff9fc5;
          font-size: 32px;
        }

        .securityContent h2 {
          margin-top: 12px;
          font-size: 36px;
        }

        .securityContent p {
          color: #dacdde;
          font-size: 14px;
        }

        .securityPoints {
          display: grid;
          gap: 13px;
        }

        .securityPoints div {
          display: flex;
          align-items: center;
          gap: 11px;
          color: white;
          font-size: 13px;
          font-weight: 750;
        }

        .securityPoints span {
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.12);
          color: #ffadd0;
        }

        .ctaSection {
          position: relative;
          overflow: hidden;
          padding: 105px 20px;
          background:
            radial-gradient(
              circle at 25% 30%,
              rgba(236, 79, 143, 0.26),
              transparent 30%
            ),
            linear-gradient(135deg, #291a34, #512b58);
          text-align: center;
        }

        .ctaGlow {
          position: absolute;
          width: 420px;
          height: 420px;
          right: -160px;
          bottom: -220px;
          border-radius: 50%;
          background: rgba(176, 72, 192, 0.18);
        }

        .ctaContent {
          position: relative;
          z-index: 2;
          width: min(760px, 100%);
          margin: 0 auto;
        }

        .ctaContent p {
          max-width: 650px;
          margin: 0 auto;
          color: #d9cddd;
        }

        .largeButton {
          min-width: 185px;
        }

        .footer {
          padding: 55px 0 25px;
          background: #1d1423;
          color: white;
        }

        .footerInner {
          width: min(1120px, calc(100% - 40px));
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1.2fr auto;
          align-items: center;
          gap: 40px;
          padding-bottom: 35px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.09);
        }

        .footerBrand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .smallMark {
          width: 39px;
          height: 39px;
          border-radius: 12px;
          font-size: 20px;
        }

        .footerBrandName {
          color: white;
          font-size: 18px;
        }

        .footerBrand p {
          margin: 5px 0 0;
          color: #9e90a4;
          font-size: 11px;
        }

        .footerText {
          margin: 0;
          color: #aa9dad;
          font-size: 12px;
          line-height: 1.65;
        }

        .footerLinks {
          display: flex;
          gap: 22px;
        }

        .footerLinks a {
          color: #cfc3d2;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
        }

        .footerBottom {
          width: min(1120px, calc(100% - 40px));
          margin: 22px auto 0;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          color: #837587;
          font-size: 11px;
        }

        .footerBottom p {
          margin: 0;
        }

        @media (max-width: 1000px) {
          .nav {
            position: absolute;
            top: 78px;
            left: 0;
            right: 0;
            display: none;
            padding: 20px;
            border-bottom: 1px solid #eee5ef;
            background: white;
            box-shadow: 0 18px 30px rgba(57, 34, 65, 0.1);
          }

          .navOpen {
            display: grid;
            gap: 18px;
          }

          .mobileLogin {
            display: inline-flex !important;
            color: #de3d7c !important;
          }

          .loginButton {
            display: none;
          }

          .menuButton {
            display: block;
          }

          .heroInner {
            grid-template-columns: 1fr;
            gap: 45px;
          }

          .heroContent {
            text-align: center;
          }

          .eyebrow {
            margin: 0 auto;
          }

          .hero h1,
          .heroText {
            margin-left: auto;
            margin-right: auto;
          }

          .heroButtons,
          .heroTrust {
            justify-content: center;
          }

          .heroVisual {
            width: min(620px, 100%);
            min-height: auto;
            margin: 0 auto;
          }

          .featureGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .workflowLayout,
          .servicesLayout {
            grid-template-columns: 1fr;
            gap: 55px;
          }

          .securityCard {
            grid-template-columns: 70px 1fr;
          }

          .securityPoints {
            grid-column: 2;
          }

          .footerInner {
            grid-template-columns: 1fr 1fr;
          }

          .footerLinks {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 720px) {
          .headerInner {
            width: min(100% - 28px, 1180px);
            height: 70px;
          }

          .nav {
            top: 70px;
          }

          .hero {
            padding: 67px 0 80px;
          }

          .heroInner,
          .featureGrid,
          .workflowLayout,
          .servicesLayout {
            width: min(100% - 28px, 1180px);
          }

          .hero h1 {
            font-size: 45px;
          }

          .heroText {
            font-size: 16px;
          }

          .heroButtons {
            display: grid;
          }

          .primaryButton,
          .secondaryButton {
            width: 100%;
          }

          .heroTrust {
            display: grid;
            justify-content: start;
            width: fit-content;
            margin-left: auto;
            margin-right: auto;
            text-align: left;
          }

          .dashboardCard {
            padding: 18px;
            border-radius: 22px;
            transform: none;
          }

          .metricGrid {
            grid-template-columns: 1fr;
          }

          .metricCard {
            display: grid;
            grid-template-columns: 38px 1fr auto;
            align-items: center;
            column-gap: 10px;
          }

          .metricIcon {
            grid-row: 1 / 3;
            margin: 0;
          }

          .metricCard p,
          .metricCard strong {
            margin: 0;
          }

          .metricCard small {
            grid-column: 3;
          }

          .pipelineRow {
            grid-template-columns: 105px 1fr 23px;
          }

          .followUpCard {
            right: -3px;
            top: -38px;
          }

          .messageCard {
            left: -2px;
            bottom: -38px;
          }

          .statsSection {
            margin-top: 10px;
            padding: 20px;
          }

          .statsGrid {
            grid-template-columns: repeat(2, 1fr);
            gap: 20px 0;
          }

          .stat {
            border-right: 0;
          }

          .section {
            padding: 80px 0;
          }

          .featureGrid {
            grid-template-columns: 1fr;
          }

          .featureCard {
            min-height: auto;
          }

          .serviceList {
            grid-template-columns: 1fr;
          }

          .securityCard {
            width: min(100% - 28px, 1120px);
            grid-template-columns: 1fr;
            padding: 32px 24px;
          }

          .securityPoints {
            grid-column: 1;
          }

          .securityContent h2 {
            font-size: 32px;
          }

          .footerInner {
            grid-template-columns: 1fr;
          }

          .footerLinks {
            grid-column: auto;
            flex-wrap: wrap;
          }

          .footerBottom {
            flex-direction: column;
          }
        }

        @media (max-width: 430px) {
          .brandSubtitle {
            display: none;
          }

          .hero h1 {
            font-size: 39px;
          }

          .dashboardTop h2 {
            font-size: 18px;
          }

          .pipelineName {
            font-size: 9px;
          }

          .floatingCard {
            display: none;
          }

          .statsGrid {
            grid-template-columns: 1fr;
          }

          .stat {
            padding: 12px 0;
            border-bottom: 1px solid #eee6ef;
          }

          .stat:last-child {
            border-bottom: 0;
          }

          .workflowItem {
            grid-template-columns: 44px 1fr;
            padding: 18px;
          }

          .stepNumber {
            width: 42px;
            height: 42px;
          }
        }
      `}</style>
    </main>
  );
}
