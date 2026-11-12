// tenant-web/src/pages/auth/AuthRightPanel.jsx (do not remove this comment)
import { Link } from "react-router-dom";

/**
 * AuthRightPanel — Form side of the auth screen.
 *
 * SIZING CONTRACT:
 * ────────────────
 * • Fills remaining width × full viewport height.
 * • Internally: form card uses fluid padding + max-width that shrinks
 *   on short/narrow viewports so it always fits without page scroll.
 * • A scroll SAFETY NET exists inside this panel only (not the page)
 *   for very tall forms (e.g. 7-field signup on a 600px tall screen).
 *   The page itself NEVER scrolls — only this panel does, if needed.
 * • Mobile branding header shows when <lg (left panel is hidden).
 * • Mobile: a thin blue gradient strip at the very top maintains brand
 *   presence when the left panel is hidden.
 *
 * To redesign this panel visually, edit THIS file only.
 * The form itself (Login/Signup card) is passed as {children}.
 */
export default function AuthRightPanel({
  activeMode,
  isTransitioning,
  children,
}) {
  return (
    <section className="relative flex-1 h-full min-h-0 flex flex-col items-center overflow-y-auto sr-custom-scrollbar sr-right-panel-bg">
      {/* ── Mobile-only top brand gradient strip ── */}
      <div
        className="lg:hidden absolute top-0 left-0 right-0 h-1 z-10"
        style={{
          background:
            "linear-gradient(90deg, #0c3aa6 0%, #125fe2 50%, #1547a8 100%)",
        }}
      />

      {/*
        Inner wrapper uses min-h-full + justify-center so:
        • On tall screens, form is vertically centered.
        • On short screens, form sits at top and the panel scrolls
          INSIDE itself (not the whole page).
      */}
      <div
        className="w-full flex flex-col items-center justify-center relative z-[1]"
        style={{
          minHeight: "100%",
          paddingTop: "clamp(1.25rem, 3vh, 2.5rem)",
          paddingBottom: "clamp(1.25rem, 3vh, 2.5rem)",
          paddingLeft: "clamp(1rem, 3vw, 2rem)",
          paddingRight: "clamp(1rem, 3vw, 2rem)",
        }}
      >
        {/* ── Mobile branding (only visible when left panel is hidden) ── */}
        <div className="flex flex-col items-center text-center lg:hidden mb-[2vh] flex-shrink-0">
          <Link to="/" className="inline-flex items-center mb-3">
            <img
              src="/sudo2.png"
              alt="SudoReply Logo"
              className="h-10 w-auto object-contain"
            />
          </Link>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {activeMode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-xs">
            {activeMode === "signup"
              ? "Launch your company WhatsApp platform and start interacting at scale."
              : "Access your WhatsApp broadcasting dashboard and manage campaigns."}
          </p>
        </div>

        {/* ── Form container with transition ── */}
        <div
          className={`w-full ${
            isTransitioning
              ? "sr-animate-fade-out-slide"
              : "sr-animate-fade-in-slide"
          }`}
          style={{
            maxWidth: "clamp(320px, 42vw, 480px)",
          }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}