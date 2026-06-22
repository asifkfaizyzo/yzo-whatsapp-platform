
import { useState } from "react";

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
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">

          {/* Header */}
          <div className="text-center mb-14">
            <span className="text-green-600 font-semibold text-sm 
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
                 className="text-green-600 hover:underline">
                support@sudoreply
              </a>
            </p>
          </div>

        </div>
      </section>

    
    </div>
  );
}