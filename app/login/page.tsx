"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setLoading(true);

    const validPin = process.env.NEXT_PUBLIC_BODYLAB_PIN || "bodylab2026";

    if (pin.trim() !== validPin) {
      setMessage("Incorrect access PIN.");
      setLoading(false);
      return;
    }

    localStorage.setItem("bodylab_authenticated", "true");
    router.push("/crm");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "linear-gradient(135deg, #fff7fb 0%, #f8fafc 55%, #f5edf7 100%)",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "430px",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "38px",
          boxShadow: "0 24px 70px rgba(42, 20, 35, 0.12)",
          border: "1px solid #f0e4eb",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <div
            style={{
              width: "58px",
              height: "58px",
              margin: "0 auto 14px",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #8b2f63, #c5487b)",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: "28px",
            }}
          >
            B
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "30px",
              color: "#171217",
              fontWeight: 800,
            }}
          >
            Staff login
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              color: "#70636b",
              lineHeight: 1.6,
            }}
          >
            Enter your BodyLab access PIN to open the CRM.
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <label
            htmlFor="pin"
            style={{
              display: "block",
              marginBottom: "8px",
              color: "#31272d",
              fontWeight: 700,
            }}
          >
            Access PIN
          </label>

          <input
            id="pin"
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="Enter PIN"
            autoComplete="current-password"
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "15px 16px",
              borderRadius: "12px",
              border: "1px solid #d8ccd3",
              fontSize: "16px",
              outline: "none",
              marginBottom: "16px",
            }}
          />

          {message && (
            <p
              style={{
                margin: "0 0 16px",
                padding: "12px",
                borderRadius: "10px",
                background: "#fff1f2",
                color: "#b42336",
                fontSize: "14px",
              }}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              border: "none",
              borderRadius: "12px",
              padding: "15px 18px",
              background: loading
                ? "#b99cab"
                : "linear-gradient(135deg, #822956, #bd3f72)",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Open CRM"}
          </button>
        </form>

        <a
          href="/"
          style={{
            display: "block",
            marginTop: "22px",
            textAlign: "center",
            color: "#82305b",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Return to homepage
        </a>
      </section>
    </main>
  );
}
