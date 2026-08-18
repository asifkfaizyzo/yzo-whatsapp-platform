import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/* ─────────────────────────────────────────────────────────────────────────
   WhatsApp Connecting Loader
   Shows after the user closes the Meta embedded-signup window.
   Cycles through meaningful step messages with animated progress rings.
   ───────────────────────────────────────────────────────────────────────── */
const WA_STEPS = [
  { icon: "🔐", label: "Exchanging secure token with Meta…" },
  { icon: "📱", label: "Verifying your WhatsApp number…" },
  { icon: "🔗", label: "Linking to your Sudoreply workspace…" },
  { icon: "✅", label: "Finalising connection…" },
];

export function WhatsAppLoader({ visible }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!visible) {
      setStepIdx(0);
      setProgress(0);
      return;
    }

    // Advance step every ~1.4 s
    const stepTimer = setInterval(() => {
      setStepIdx((prev) => (prev < WA_STEPS.length - 1 ? prev + 1 : prev));
    }, 1400);

    return () => {
      clearInterval(stepTimer);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const target = Math.min(90, ((stepIdx + 1) / WA_STEPS.length) * 100);
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= target) {
          clearInterval(progressTimer);
          return prev;
        }
        return prev + 1;
      });
    }, 30);
    return () => clearInterval(progressTimer);
  }, [visible, stepIdx]);

  if (!visible) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(15, 23, 42, 0.72)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: "wlFadeIn 0.25s ease",
      }}
    >
      <style>{`
        @keyframes wlFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes wlSpin   { to { transform: rotate(360deg) } }
        @keyframes wlSlideUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes wlOrbit {
          0%   { transform: rotate(0deg)   translateX(34px) rotate(0deg) }
          100% { transform: rotate(360deg) translateX(34px) rotate(-360deg) }
        }
      `}</style>

      <div
        style={{
          background: "#ffffff",
          borderRadius: "24px",
          padding: "40px 36px",
          maxWidth: "400px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 32px 80px rgba(0,0,0,0.25)",
        }}
      >
        {/* Spinning ring with WhatsApp icon */}
        <div style={{ position: "relative", width: "88px", height: "88px", margin: "0 auto 28px" }}>
          {/* Outer ring */}
          <svg width="88" height="88" style={{ position: "absolute", top: 0, left: 0, animation: "wlSpin 1.4s linear infinite" }} viewBox="0 0 88 88">
            <circle cx="44" cy="44" r="40" fill="none" stroke="#dcfce7" strokeWidth="6" />
            <circle cx="44" cy="44" r="40" fill="none" stroke="#16a34a" strokeWidth="6"
              strokeDasharray="60 192" strokeLinecap="round" strokeDashoffset="0" />
          </svg>
          {/* Inner icon */}
          <div style={{
            position: "absolute", inset: "10px",
            background: "linear-gradient(135deg,#22c55e,#16a34a)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "28px",
          }}>
            💬
          </div>
          {/* Orbiting dot */}
          <div style={{
            position: "absolute", top: "44px", left: "44px",
            animation: "wlOrbit 1.4s linear infinite",
          }}>
            <div style={{
              width: "10px", height: "10px", borderRadius: "50%",
              background: "#16a34a", marginLeft: "-5px", marginTop: "-5px",
              boxShadow: "0 0 0 3px #dcfce7",
            }} />
          </div>
        </div>

        {/* Headline */}
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
          Connecting WhatsApp…
        </h2>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 28px" }}>
          Please keep this tab open. This only takes a moment.
        </p>

        {/* Steps */}
        <div style={{ textAlign: "left", marginBottom: "24px" }}>
          {WA_STEPS.map((step, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  marginBottom: "6px",
                  background: active ? "#f0fdf4" : "transparent",
                  border: active ? "1px solid #bbf7d0" : "1px solid transparent",
                  opacity: i > stepIdx ? 0.35 : 1,
                  transition: "all 0.4s ease",
                  animation: active ? "wlSlideUp 0.3s ease" : "none",
                }}
              >
                {/* Status indicator */}
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: done ? "#16a34a" : active ? "#dcfce7" : "#f1f5f9",
                  transition: "background 0.4s",
                }}>
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : active ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" style={{ animation: "wlSpin 0.9s linear infinite" }}>
                      <circle cx="12" cy="12" r="10" strokeDasharray="40 20" />
                    </svg>
                  ) : (
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>{i + 1}</span>
                  )}
                </div>
                <span style={{
                  fontSize: "13px",
                  fontWeight: active ? 600 : done ? 500 : 400,
                  color: active ? "#166534" : done ? "#15803d" : "#94a3b8",
                  transition: "color 0.3s",
                }}>
                  {step.icon} {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div style={{ background: "#f1f5f9", borderRadius: "99px", height: "6px", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${progress}%`,
            background: "linear-gradient(90deg,#22c55e,#16a34a)",
            borderRadius: "99px",
            transition: "width 0.3s ease",
          }} />
        </div>
        <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "10px" }}>
          🔒 Secured by Meta — we never store your Facebook credentials
        </p>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Razorpay Payment Verifying Loader
   Shows as a full-screen overlay after Razorpay popup closes while we
   verify the payment signature on the backend.
   ───────────────────────────────────────────────────────────────────────── */
export function PaymentVerifyingLoader({ visible }) {
  const [dots, setDots] = useState(0);
  const [sigVerified, setSigVerified] = useState(false);

  useEffect(() => {
    if (!visible) {
      setDots(0);
      setSigVerified(false);
      return;
    }
    const t = setInterval(() => setDots((d) => (d + 1) % 4), 500);
    const sv = setTimeout(() => setSigVerified(true), 1500);
    return () => {
      clearInterval(t);
      clearTimeout(sv);
    };
  }, [visible]);

  if (!visible) return null;

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        background: "rgba(15, 23, 42, 0.80)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        animation: "wlFadeIn 0.2s ease",
      }}
    >
      <style>{`
        @keyframes pvSpin { to { transform: rotate(360deg) } }
        @keyframes pvPop  { 0% { transform:scale(0.8); opacity:0 } 100% { transform:scale(1); opacity:1 } }
      `}</style>
      <div
        style={{
          background: "#fff",
          borderRadius: "24px",
          padding: "44px 36px",
          maxWidth: "360px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 40px 100px rgba(0,0,0,0.3)",
          animation: "pvPop 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* Concentric counter-rotating rings */}
        <div style={{ position: "relative", width: "80px", height: "80px", margin: "0 auto 24px" }}>
          <svg width="80" height="80" viewBox="0 0 80 80" style={{ position: "absolute", animation: "pvSpin 1.1s linear infinite" }}>
            <circle cx="40" cy="40" r="35" fill="none" stroke="#e0e7ff" strokeWidth="6" />
            <circle cx="40" cy="40" r="35" fill="none" stroke="#4f46e5" strokeWidth="6"
              strokeDasharray="55 165" strokeLinecap="round" />
          </svg>
          <svg width="80" height="80" viewBox="0 0 80 80" style={{ position: "absolute", animation: "pvSpin 0.75s linear infinite reverse" }}>
            <circle cx="40" cy="40" r="24" fill="none" stroke="#e0e7ff" strokeWidth="4" />
            <circle cx="40" cy="40" r="24" fill="none" stroke="#818cf8" strokeWidth="4"
              strokeDasharray="25 126" strokeLinecap="round" />
          </svg>
          <div style={{
            position: "absolute", inset: "18px",
            background: "linear-gradient(135deg,#6366f1,#4f46e5)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px",
          }}>
            🔒
          </div>
        </div>

        <h2 style={{ fontSize: "19px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
          Verifying Payment{".".repeat(dots)}
        </h2>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 20px", lineHeight: 1.6 }}>
          We're confirming your payment with Razorpay. <br />
          <strong>Please don't close or refresh</strong> this page.
        </p>

        {/* 3 animated status pills */}
        {[
          { label: "Payment received", done: true },
          { label: "Verifying signature", done: sigVerified },
          { label: "Activating plan", done: false },
        ].map((item, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "8px 14px",
            borderRadius: "10px",
            marginBottom: "6px",
            background: item.done ? "#eef2ff" : "#f8fafc",
            border: `1px solid ${item.done ? "#c7d2fe" : "#e2e8f0"}`,
            transition: "all 0.3s ease",
          }}>
            <div style={{
              width: "20px", height: "20px", borderRadius: "50%", flexShrink: 0,
              background: item.done ? "#4f46e5" : "#e2e8f0",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.3s ease",
            }}>
              {item.done ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#cbd5e1" }} />
              )}
            </div>
            <span style={{ fontSize: "12px", fontWeight: item.done ? 600 : 400, color: item.done ? "#3730a3" : "#94a3b8" }}>
              {item.label}
            </span>
          </div>
        ))}

        <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "16px" }}>
          🔒 Secured by Razorpay • 256-bit SSL encrypted
        </p>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Payment Success Screen  (replaces the boring green spinner)
   ───────────────────────────────────────────────────────────────────────── */
export function PaymentSuccessScreen({ planName, email }) {
  const [ringDone, setRingDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRingDone(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg,#f0fdf4 0%,#eff6ff 100%)",
      padding: "16px",
    }}>
      <style>{`
        @keyframes psCheckDraw {
          from { stroke-dashoffset: 100 }
          to   { stroke-dashoffset: 0 }
        }
        @keyframes psCircle {
          from { stroke-dashoffset: 290 }
          to   { stroke-dashoffset: 0 }
        }
        @keyframes psConfetti {
          0%   { transform: translateY(0) rotate(0deg); opacity:1 }
          100% { transform: translateY(-60px) rotate(720deg); opacity:0 }
        }
        @keyframes psSlideUp {
          from { opacity:0; transform:translateY(16px) }
          to   { opacity:1; transform:translateY(0) }
        }
        @keyframes psPulseRing {
          0%   { transform:scale(1); opacity:0.5 }
          100% { transform:scale(1.6); opacity:0 }
        }
        @keyframes pvSpin { to { transform: rotate(360deg) } }
      `}</style>

      <div style={{
        background: "#fff",
        borderRadius: "28px",
        padding: "52px 40px",
        maxWidth: "420px",
        width: "100%",
        textAlign: "center",
        boxShadow: "0 24px 80px rgba(0,0,0,0.12)",
        animation: "psSlideUp 0.5s cubic-bezier(0.34,1.56,0.64,1)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Confetti dots */}
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: "8px", height: "8px", borderRadius: "2px",
            background: ["#22c55e","#3b82f6","#f59e0b","#ec4899","#8b5cf6","#14b8a6","#f97316","#06b6d4"][i],
            top: `${10 + (i % 3) * 15}%`,
            left: `${5 + i * 12}%`,
            animation: `psConfetti ${0.8 + i * 0.1}s ease-out ${i * 0.07}s both`,
          }} />
        ))}

        {/* Checkmark circle */}
        <div style={{ position: "relative", width: "100px", height: "100px", margin: "0 auto 28px" }}>
          {/* Pulse rings */}
          {[0, 1].map((i) => (
            <div key={i} style={{
              position: "absolute",
              inset: "-8px",
              borderRadius: "50%",
              border: "2px solid #22c55e",
              animation: `psPulseRing 1.6s ease-out ${i * 0.4}s infinite`,
            }} />
          ))}
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46"
              fill="none"
              stroke="#22c55e"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="290"
              style={{
                strokeDashoffset: ringDone ? "0" : "290",
                transition: "stroke-dashoffset 0.6s ease",
              }}
            />
            <polyline
              points="30,52 44,66 72,36"
              fill="none" stroke="#22c55e" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="100"
              style={{
                strokeDashoffset: ringDone ? "0" : "100",
                transition: "stroke-dashoffset 0.4s ease 0.5s",
              }}
            />
          </svg>
        </div>

        <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a", margin: "0 0 8px", animation: "psSlideUp 0.5s ease 0.2s both" }}>
          Payment Successful! 🎉
        </h1>
        <p style={{ fontSize: "14px", color: "#475569", margin: "0 0 4px", animation: "psSlideUp 0.5s ease 0.3s both" }}>
          Welcome to the <strong style={{ color: "#125EF2" }}>{planName}</strong> plan.
        </p>
        {email && (
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 24px", animation: "psSlideUp 0.5s ease 0.35s both" }}>
            Invoice sent to <strong>{email}</strong>
          </p>
        )}

        {/* Redirect notice */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
          padding: "12px 20px",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "12px",
          animation: "psSlideUp 0.5s ease 0.45s both",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"
            style={{ animation: "pvSpin 1.2s linear infinite" }}>
            <circle cx="12" cy="12" r="10" strokeDasharray="42 20" />
          </svg>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#15803d" }}>
            Redirecting you to your dashboard…
          </span>
        </div>

        <p style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "20px", animation: "psSlideUp 0.5s ease 0.5s both" }}>
          🔒 Secured by Razorpay • PCI DSS Compliant
        </p>
      </div>
    </div>
  );
}
