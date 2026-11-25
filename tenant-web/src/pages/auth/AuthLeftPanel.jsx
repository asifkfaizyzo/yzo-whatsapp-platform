// tenant-web/src/pages/auth/AuthLeftPanel.jsx (do not remove this comment)
import { Link } from "react-router-dom";

const benefits = [
  {
    title: "Official WhatsApp Cloud API",
    text: "Direct integration with Meta's official API for maximum reliability and green-tick eligibility.",
  },
  {
    title: "Bulk WhatsApp Broadcasting",
    text: "Send personalized campaign messages to thousands of contacts with a single click.",
  },
  {
    title: "Multi-Agent Shared Inbox",
    text: "Collaborate seamlessly. Assign chats, label contacts, and support customers together.",
  },
];

export default function AuthLeftPanel() {
  return (
    <aside
      className="hidden lg:flex w-5/12 h-screen text-white flex-col justify-between relative overflow-hidden select-none flex-shrink-0"
      style={{
        background:
          "linear-gradient(160deg, #0c3aa6 0%, #125fe2 46%, #1547a8 100%)",
        padding: "clamp(1.5rem, 4vh, 3rem) clamp(1.25rem, 3.5vh, 2.5rem)",
      }}
    >
      {/* ── Background decorations ── */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5 blur-[110px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-24 w-96 h-96 rounded-full bg-[#0c3aa6]/40 blur-[110px] pointer-events-none" />

      {/* ── Message bubble constellation ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute sr-bubble-a"
          style={{
            top: "14%",
            left: "8%",
            width: 92,
            height: 34,
            background: "rgba(255,255,255,0.07)",
            borderRadius: "16px 16px 16px 4px",
          }}
        />
        <div
          className="absolute sr-bubble-b"
          style={{
            top: "22%",
            left: "62%",
            width: 70,
            height: 28,
            background: "rgba(255,255,255,0.10)",
            borderRadius: "16px 16px 4px 16px",
          }}
        />
        <div
          className="absolute sr-bubble-c"
          style={{
            top: "38%",
            left: "18%",
            width: 56,
            height: 24,
            background: "rgba(255,255,255,0.06)",
            borderRadius: "16px 16px 16px 4px",
          }}
        />
        <div
          className="absolute sr-bubble-a"
          style={{
            top: "46%",
            left: "70%",
            width: 84,
            height: 30,
            background: "rgba(255,255,255,0.08)",
            borderRadius: "16px 16px 4px 16px",
          }}
        />
        <div
          className="absolute sr-bubble-b"
          style={{
            top: "62%",
            left: "6%",
            width: 64,
            height: 26,
            background: "rgba(255,255,255,0.06)",
            borderRadius: "16px 16px 16px 4px",
          }}
        />
        <div
          className="absolute rounded-full bg-emerald-400 sr-pulse-dot"
          style={{ top: "31%", left: "56%", width: 8, height: 8 }}
        />
        <div
          className="absolute rounded-full bg-white/40 sr-pulse-dot"
          style={{
            top: "57%",
            left: "24%",
            width: 6,
            height: 6,
            animationDelay: "0.8s",
          }}
        />
      </div>

      {/* ── Logo ── */}
      <div className="relative z-10 flex-shrink-0">
        <Link to="/" className="inline-flex items-center">
          <img
            src="/sudo2.png"
            alt="SudoReply Logo"
            className="w-auto object-contain filter drop-shadow-md brightness-110"
            style={{ height: "clamp(10rem, 6vh, 5rem)" }}
          />
        </Link>
      </div>

      {/* ── Headline + Subtext + Benefit Cards (single block, centers vertically) ── */}
      <div
        className="relative z-10 flex-1 min-h-0 flex flex-col justify-center"
        style={{
          gap: "clamp(1.5rem, 3vh, 2.5rem)",
          padding: "clamp(1rem, 2vh, 2rem) 0",
        }}
      >
        {/* Text group */}
        <div className="flex flex-col">
          <p
            className="font-semibold uppercase tracking-[0.22em] text-blue-200/80"
            style={{ fontSize: "clamp(0.65rem, 1.1vh, 0.75rem)" }}
          >
            SudoReply Workspace
          </p>
          <h1
            className="font-bold tracking-tight leading-[1.15]"
            style={{
              fontSize: "clamp(1.5rem, 3.2vh, 2.75rem)",
              marginTop: "clamp(0.5rem, 1.5vh, 1rem)",
            }}
          >
            Scale your customer relationships on WhatsApp.
          </h1>
          <p
            className="leading-relaxed text-blue-100/70"
            style={{
              fontSize: "clamp(0.8rem, 1.4vh, 0.95rem)",
              marginTop: "clamp(0.75rem, 2vh, 1.25rem)",
              maxWidth: "28vw",
            }}
          >
            Enterprises rely on SudoReply to orchestrate bulk campaigns,
            maintain shared team inboxes, and process customer interactions on
            Meta's official WhatsApp Cloud API.
          </p>
        </div>

        {/* Cards group */}
        <div
          className="flex flex-col"
          style={{ gap: "clamp(0.5rem, 1.2vh, 0.75rem)" }}
        >
          {benefits.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md transition-colors duration-200 hover:bg-white/[0.09]"
              style={{
                padding:
                  "clamp(0.75rem, 1.5vh, 1rem) clamp(0.85rem, 1.8vh, 1.25rem)",
              }}
            >
              <h3
                className="font-semibold text-white flex items-center gap-2"
                style={{ fontSize: "clamp(0.75rem, 1.3vh, 0.875rem)" }}
              >
                <CheckIcon />
                {item.title}
              </h3>
              <p
                className="text-blue-100/60 leading-relaxed"
                style={{
                  fontSize: "clamp(0.7rem, 1.15vh, 0.8rem)",
                  marginTop: "clamp(0.15rem, 0.5vh, 0.3rem)",
                  paddingLeft: "clamp(1.25rem, 2.2vh, 1.5rem)",
                }}
              >
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function CheckIcon() {
  return (
    <svg
      className="text-emerald-300 stroke-[3px] shrink-0"
      style={{
        height: "clamp(0.85rem, 1.6vh, 1rem)",
        width: "clamp(0.85rem, 1.6vh, 1rem)",
      }}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
