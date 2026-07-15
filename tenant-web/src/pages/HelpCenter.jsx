import Navbar from "../components/landing/layout/Navbar";
import Footer from "../components/landing/layout/Footer";
import { useState } from "react";
import { siteConfig } from "../config/site";         


// ── SVG Icons + socialItems ───────────────────────────────────────────────────
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
        M12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 
        8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 
        6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 
        4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0
        -3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98
        C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 
        6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 
        1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}
function YoutubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 
        12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 
        8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871
        .505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122
        -2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432
        L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
function LinkedinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037
        -1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c
        .477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286z
        M5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 
        2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 
        .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 
        23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const socialItems = [
  { key: "facebook",  label: "Facebook",  Icon: FacebookIcon,  hoverClass: "hover:bg-blue-600 hover:border-blue-600 hover:text-white"  },
  { key: "instagram", label: "Instagram", Icon: InstagramIcon, hoverClass: "hover:bg-pink-600 hover:border-pink-600 hover:text-white"  },
  { key: "youtube",   label: "YouTube",   Icon: YoutubeIcon,   hoverClass: "hover:bg-red-600 hover:border-red-600 hover:text-white"    },
  { key: "linkedin",  label: "LinkedIn",  Icon: LinkedinIcon,  hoverClass: "hover:bg-blue-500 hover:border-blue-500 hover:text-white"  },
];

export default function HelpCenter() {
  const faqs = [
    {
      q: "How do I create a broadcast campaign?",
      a: "Go to your dashboard, click 'New Campaign', select your contacts, write your message, and hit send. Your broadcast will be delivered instantly.",
    },
    {
      q: "How do I add contacts?",
      a: "You can import contacts via CSV file, add them manually, or use our API to sync contacts from your CRM or database.",
    },
    {
      q: "What is a Tenant?",
      a: "A Tenant is a separate business or organization within the platform. Each tenant has their own users, contacts, and campaigns.",
    },
    {
      q: "How many messages can I send?",
      a: "Depends on your plan. Starter allows 10,000 messages/month, Growth allows 50,000, and Enterprise offers unlimited messaging.",
    },
    {
      q: "How do I add users to my tenant?",
      a: "Go to Settings → Users → Invite User. Enter their email and assign a role. They will receive an invitation to join.",
    },
    {
      q: "Is there an API available?",
      a: "Yes! Our REST API is available on Growth and Enterprise plans. You can integrate broadcasting into your own applications.",
    },
    {
      q: "What message templates are supported?",
      a: "We support text messages, media messages (images, videos, documents), and interactive messages with buttons and lists.",
    },
    {
      q: "How do I track campaign performance?",
      a: "Each campaign shows real-time analytics including delivery rate, read receipts, and response rate in your dashboard.",
    },
  ];

  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div>
      <Navbar />

      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">

          {/* Header */}
          <div className="text-center mb-14">
            <span className="text-[#125EF2] font-semibold text-sm 
                             uppercase tracking-wider">
              Help Center
            </span>
            <h1 className="text-3xl font-bold text-gray-900 mt-3 mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-gray-500 text-sm">
              Find quick answers to common questions.
            </p>
          </div>

          {/* FAQ List */}
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border border-gray-100 rounded-xl 
                           overflow-hidden"
              >
                {/* Question */}
                <button
                  onClick={() => toggle(index)}
                  className="w-full flex justify-between items-center 
                             px-6 py-4 text-left bg-gray-50 
                             hover:bg-gray-100 transition"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {faq.q}
                  </span>
                  <span className="text-gray-400 text-lg ml-4">
                    {openIndex === index ? "−" : "+"}
                  </span>
                </button>

                {/* Answer */}
                {openIndex === index && (
                  <div className="px-6 py-4 bg-white">
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Contact Support */}
          <div className="text-center mt-14 bg-gray-50 
                          rounded-xl p-8 border border-gray-100">
            <p className="text-sm text-gray-600 mb-1">
              Can't find what you're looking for?
            </p>
            <p className="text-sm text-gray-400">
              Email us at{" "}
              <a href="mailto:support@sudoreply" 
                 className="text-[#125EF2] hover:underline">
                support@sudoreply
              </a>
            </p>

 <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-400 mb-4">
                Or reach us on social media
              </p>
              <div className="flex justify-center gap-3">
                {socialItems.map(({ key, label, Icon, hoverClass }) => (
                  <a
                    key={key}
                    href={siteConfig.social[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`SudoReply on ${label}`}
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

          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}