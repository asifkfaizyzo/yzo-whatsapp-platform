import { useState } from "react";
import Navbar from "../components/landing/layout/Navbar";
import Footer from "../components/landing/layout/Footer";
import { siteConfig } from "../config/site";
import api from "../lib/axios";

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 
        4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 
        1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83
        c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796
        v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 
        4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 
        4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85
        .07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92
        -.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149
        -3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z
        M12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052
        .014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 
        6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 
        4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073
        -4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979
        -6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 
        6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406
        -11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 
        12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186
        C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136
        c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 
        002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 
        15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852
        -3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h
        .046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455
        v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 
        112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771
        C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 
        24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

// ── Social Items ──────────────────────────────────────────────────────────────
const socialItems = [
  { key: "facebook",  label: "Facebook",  Icon: FacebookIcon,  hoverClass: "hover:bg-blue-600 hover:border-blue-600 hover:text-white"  },
  { key: "instagram", label: "Instagram", Icon: InstagramIcon, hoverClass: "hover:bg-pink-600 hover:border-pink-600 hover:text-white"  },
  { key: "youtube",   label: "YouTube",   Icon: YoutubeIcon,   hoverClass: "hover:bg-red-600 hover:border-red-600 hover:text-white"    },
  { key: "linkedin",  label: "LinkedIn",  Icon: LinkedinIcon,  hoverClass: "hover:bg-blue-500 hover:border-blue-500 hover:text-white"  },
];

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post("/enquiries", {
        name,
        email,
        subject: subject || undefined,
        message,
      });

      if (response.data.success) {
        setSubmitted(true);
        // Clear fields
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      } else {
        setError(response.data.message || "Failed to submit enquiry.");
      }
    } catch (err) {
      console.error("Enquiry submission error:", err);
      setError(err.response?.data?.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navbar />

      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">

          <div className="grid md:grid-cols-2 gap-16">

            {/* Left — Info */}
            <div>
              <span className="text-[#125EF2] font-semibold text-sm 
                               uppercase tracking-wider">
                Contact
              </span>
              <h1 className="text-4xl font-bold text-gray-900 mt-3 mb-4">
                Let's talk
              </h1>
              <p className="text-gray-500 mb-10 leading-relaxed">
                Book a personalized demo or reach out to our team. 
                We'd love to hear from you.
              </p>

              {/* Contact Info */}
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#EAF2FE] rounded-lg 
                                  flex items-center justify-center">
                    📧
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="text-sm font-medium text-gray-900">
                      hello@sudoreply.com
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#EAF2FE] rounded-lg 
                                  flex items-center justify-center">
                    💬
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">WhatsApp</p>
                    <p className="text-sm font-medium text-gray-900">
                      +1-234-567-8900
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#EAF2FE] rounded-lg 
                                  flex items-center justify-center">
                    📞
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Phone</p>
                    <p className="text-sm font-medium text-gray-900">
                      +1-234-567-8900
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#EAF2FE] rounded-lg 
                                  flex items-center justify-center">
                    📍
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Office</p>
                    <p className="text-sm font-medium text-gray-900">
                      Hong Kong, Singapore, India
                    </p>
                  </div>
                </div>
              </div>

             
              {/* ── SOCIAL LINKS ──────────────────────────── */}
              <div className="mt-8 pt-8 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 
                              uppercase tracking-wider mb-4">
                  Follow us on social media
                </p>
                <div className="flex gap-3">
                  {socialItems.map(({ key, label, Icon, hoverClass }) => (
                    <a
                      key={key}
                      href={siteConfig.social[key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Follow SudoReply on ${label}`}
                      title={label}
                      className={`
                        w-10 h-10 rounded-xl border border-gray-200
                        flex items-center justify-center
                        text-gray-400 bg-white
                        transition-all duration-300
                        hover:scale-110 hover:shadow-md
                        ${hoverClass}
                      `}
                    >
                      <Icon />
                    </a>
                  ))}
                </div>
              </div>
              {/* ─────────────────────────────────────────────────────── */}



            </div>

            {/* Right — Form or Success */}
            <div>
              {submitted ? (
                <div className="bg-[#EAF2FE] rounded-2xl p-10 
                                border border-[#CFE0FD] text-center animate-fade-in">
                  <div className="w-16 h-16 bg-[#CFE0FD] rounded-full 
                                  flex items-center justify-center 
                                  text-3xl mx-auto mb-4">
                    ✅
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Message Sent!
                  </h3>
                  <p className="text-gray-500 text-sm mb-6">
                    Thank you! We will get back to you soon.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="text-sm font-medium text-[#125EF2] 
                               hover:text-[#0F4FCC]"
                  >
                    Send another message →
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="bg-gray-50 rounded-2xl p-8 
                             border border-gray-100"
                >
                  <div className="space-y-5">
                    {error && (
                      <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
                        {error}
                      </div>
                    )}

                    {/* Full Name */}
                    <div>
                      <label className="block text-sm font-medium 
                                        text-gray-700 mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full px-4 py-2.5 rounded-lg 
                                   border border-gray-200 text-sm 
                                   focus:outline-none focus:ring-2 
                                   focus:ring-[#125EF2] bg-white"
                      />
                    </div>

                    {/* Email Address */}
                    <div>
                      <label className="block text-sm font-medium 
                                        text-gray-700 mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john@company.com"
                        className="w-full px-4 py-2.5 rounded-lg 
                                   border border-gray-200 text-sm 
                                   focus:outline-none focus:ring-2 
                                   focus:ring-[#125EF2] bg-white"
                      />
                    </div>

                    {/* Subject */}
                    <div>
                      <label className="block text-sm font-medium 
                                        text-gray-700 mb-1.5">
                        Subject (Optional)
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="What's this about?"
                        className="w-full px-4 py-2.5 rounded-lg 
                                   border border-gray-200 text-sm 
                                   focus:outline-none focus:ring-2 
                                   focus:ring-[#125EF2] bg-white"
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <label className="block text-sm font-medium 
                                        text-gray-700 mb-1.5">
                        Message
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Tell us about your needs..."
                        className="w-full px-4 py-2.5 rounded-lg 
                                   border border-gray-200 text-sm 
                                   focus:outline-none focus:ring-2 
                                   focus:ring-[#125EF2] bg-white 
                                   resize-none"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gray-900 text-white py-3 
                                 rounded-lg font-medium text-sm 
                                 hover:bg-gray-800 transition-all 
                                 duration-300 hover:-translate-y-0.5
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? "Sending..." : "Send Message"}
                    </button>

                    {/* Privacy Note */}
                    <p className="text-xs text-gray-400 text-center">
                      🔒 Your information is secure and will never be shared.
                    </p>

                  </div>
                </form>
              )}
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}