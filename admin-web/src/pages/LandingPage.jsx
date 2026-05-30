import { Link } from "react-router-dom";
import LandingPageNavbar from "../components/LandingPageNavbar";
import { siteConfig } from "../config/site";

const stats = [
  { label: "Messages", value: "12.4k" },
  { label: "Open Rate", value: "82%" },
  { label: "Agents", value: "08" },
];

const contacts = ["Riya Patel", "David Lee", "Acme Sales", "Emma Johnson"];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingPageNavbar />

      <main>
        <section className="relative overflow-hidden py-20 sm:py-24">
          <div className="container-shell grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="pill">WhatsApp • Support • Campaigns</span>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                {siteConfig.hero.title}
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-8 text-[color:var(--muted)]">
                {siteConfig.hero.subtitle}
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/register" className="btn-primary">
                  Start Free
                </Link>
                <a href="#features" className="btn-secondary">
                  Explore Features
                </a>
              </div>

              <div className="mt-10 grid max-w-xl grid-cols-3 gap-4">
                {stats.map((item) => (
                  <div key={item.label} className="card p-4 text-center">
                    <p className="text-2xl font-semibold">{item.value}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[40px] bg-emerald-100 blur-3xl opacity-70" />

              <div className="card p-4 sm:p-6">
                <div className="grid gap-4 lg:grid-cols-[220px,1fr]">
                  <div className="rounded-2xl bg-[color:var(--surface-2)] p-4">
                    <p className="text-sm font-semibold">Inbox</p>
                    <div className="mt-4 space-y-3">
                      {contacts.map((name, index) => (
                        <div
                          key={name}
                          className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3"
                        >
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                            style={{ backgroundColor: "var(--primary)" }}
                          >
                            {name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{name}</p>
                            <p className="text-xs text-[color:var(--muted)]">
                              {index === 0 ? "Interested in pricing" : "Recent chat"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className="rounded-2xl border p-4"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Riya Patel</p>
                        <p className="text-sm text-[color:var(--muted)]">
                          Interested in pricing
                        </p>
                      </div>
                      <span className="pill">Online</span>
                    </div>

                    <div className="mt-6 space-y-4">
                      <div className="max-w-[80%] rounded-2xl bg-[color:var(--surface-2)] px-4 py-3 text-sm">
                        Hi, can you share your pricing plans?
                      </div>

                      <div
                        className="ml-auto max-w-[80%] rounded-2xl px-4 py-3 text-sm text-white"
                        style={{ backgroundColor: "var(--primary)" }}
                      >
                        Sure — we have Starter, Growth, and Enterprise plans.
                      </div>

                      <div className="max-w-[70%] rounded-2xl bg-[color:var(--surface-2)] px-4 py-3 text-sm">
                        Great. Can I book a quick demo?
                      </div>
                    </div>

                    <div
                      className="mt-6 rounded-2xl border px-4 py-3 text-sm text-[color:var(--muted)]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      Type a message...
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[color:var(--surface-2)] p-4">
                    <p className="text-sm text-[color:var(--muted)]">Reply Rate</p>
                    <p className="mt-1 text-xl font-semibold">91%</p>
                  </div>
                  <div className="rounded-2xl bg-[color:var(--surface-2)] p-4">
                    <p className="text-sm text-[color:var(--muted)]">Broadcast Sent</p>
                    <p className="mt-1 text-xl font-semibold">3,420</p>
                  </div>
                  <div className="rounded-2xl bg-[color:var(--surface-2)] p-4">
                    <p className="text-sm text-[color:var(--muted)]">Active Agents</p>
                    <p className="mt-1 text-xl font-semibold">08</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-20">
          <div className="container-shell">
            <div className="max-w-2xl">
              <span className="pill">Features</span>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Everything you need to start simple
              </h2>
              <p className="mt-4 text-[color:var(--muted)]">
                Keep this as a lightweight starter UI and expand it later however
                you want.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {siteConfig.features.map((item, index) => (
                <div key={item.title} className="card p-6">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-semibold text-white"
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mt-6 text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="why-us" className="pb-20">
          <div className="container-shell grid gap-6 lg:grid-cols-2">
            <div className="card p-8">
              <h3 className="text-2xl font-semibold">Built for global edits</h3>
              <p className="mt-4 text-[color:var(--muted)]">
                Change colors, branding, and reusable styles from one place
                without rewriting all components.
              </p>

              <ul className="mt-6 space-y-3 text-sm text-[color:var(--muted)]">
                <li>• Update theme colors in <strong>index.css</strong></li>
                <li>• Update brand text in <strong>site.js</strong></li>
                <li>• Reuse common buttons, cards, and inputs everywhere</li>
              </ul>
            </div>

            <div className="card p-8">
              <h3 className="text-2xl font-semibold">Ready to extend later</h3>
              <p className="mt-4 text-[color:var(--muted)]">
                You can easily add dashboard screens, analytics, inbox modules,
                settings, and user roles later.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <span className="pill">Landing Page</span>
                <span className="pill">Login</span>
                <span className="pill">Signup</span>
                <span className="pill">React Router</span>
                <span className="pill">Tailwind CSS</span>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-20">
          <div className="container-shell">
            <div
              className="rounded-[32px] px-8 py-10 text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary), var(--primary-dark))",
              }}
            >
              <h3 className="text-3xl font-semibold">
                Start with a clean Wati-style UI
              </h3>
              <p className="mt-3 max-w-2xl text-white/80">
                Minimal frontend, easy to maintain, and simple to customize for
                your own SaaS.
              </p>
              <div className="mt-6">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-900"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer
        className="border-t py-8"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="container-shell flex flex-col gap-3 text-sm text-[color:var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {siteConfig.brand}. All rights reserved.</p>
          <p>Simple frontend UI starter built with React + Tailwind.</p>
        </div>
      </footer>
    </div>
  );
}