import { useState } from "react";
import Navbar from "../components/landing/layout/Navbar";
import Footer from "../components/landing/layout/Footer";

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div>
      <Navbar />

      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">

          <div className="grid md:grid-cols-2 gap-16">

            {/* Left — Info */}
            <div>
              <span className="text-green-600 font-semibold text-sm 
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
                  <div className="w-10 h-10 bg-green-50 rounded-lg 
                                  flex items-center justify-center">
                    📧
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="text-sm font-medium text-gray-900">
                      hello@wati.io
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-50 rounded-lg 
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
                  <div className="w-10 h-10 bg-green-50 rounded-lg 
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
                  <div className="w-10 h-10 bg-green-50 rounded-lg 
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
            </div>

            {/* Right — Form or Success */}
            <div>
              {submitted ? (
                <div className="bg-green-50 rounded-2xl p-10 
                                border border-green-100 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full 
                                  flex items-center justify-center 
                                  text-3xl mx-auto mb-4">
                    ✅
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Message Sent!
                  </h3>
                  <p className="text-gray-500 text-sm mb-6">
                    Thanks for reaching out. Our team will get 
                    back to you within 24 hours.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="text-sm font-medium text-green-600 
                               hover:text-green-700"
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

                    {/* Name & Phone — Side by Side */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Full Name */}
                      <div>
                        <label className="block text-sm font-medium 
                                          text-gray-700 mb-1.5">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="John Doe"
                          className="w-full px-4 py-2.5 rounded-lg 
                                     border border-gray-200 text-sm 
                                     focus:outline-none focus:ring-2 
                                     focus:ring-green-500 bg-white"
                        />
                      </div>

                      {/* Phone Number */}
                      <div>
                        <label className="block text-sm font-medium 
                                          text-gray-700 mb-1.5">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="+1 234 567 8900"
                          className="w-full px-4 py-2.5 rounded-lg 
                                     border border-gray-200 text-sm 
                                     focus:outline-none focus:ring-2 
                                     focus:ring-green-500 bg-white"
                        />
                      </div>
                    </div>

                    {/* Email & Company — Side by Side */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Work Email */}
                      <div>
                        <label className="block text-sm font-medium 
                                          text-gray-700 mb-1.5">
                          Work Email
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="john@company.com"
                          className="w-full px-4 py-2.5 rounded-lg 
                                     border border-gray-200 text-sm 
                                     focus:outline-none focus:ring-2 
                                     focus:ring-green-500 bg-white"
                        />
                      </div>

                      {/* Company */}
                      <div>
                        <label className="block text-sm font-medium 
                                          text-gray-700 mb-1.5">
                          Company
                        </label>
                        <input
                          type="text"
                          placeholder="Company name"
                          className="w-full px-4 py-2.5 rounded-lg 
                                     border border-gray-200 text-sm 
                                     focus:outline-none focus:ring-2 
                                     focus:ring-green-500 bg-white"
                        />
                      </div>
                    </div>

                    {/* Team Size */}
                    <div>
                      <label className="block text-sm font-medium 
                                        text-gray-700 mb-1.5">
                        Team Size
                      </label>
                      <select
                        className="w-full px-4 py-2.5 rounded-lg 
                                   border border-gray-200 text-sm 
                                   focus:outline-none focus:ring-2 
                                   focus:ring-green-500 bg-white 
                                   text-gray-500"
                      >
                        <option value="">Select team size</option>
                        <option value="1-10">1 - 10 members</option>
                        <option value="11-50">11 - 50 members</option>
                        <option value="51-200">51 - 200 members</option>
                        <option value="200+">200+ members</option>
                      </select>
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
                        placeholder="Tell us about your needs..."
                        className="w-full px-4 py-2.5 rounded-lg 
                                   border border-gray-200 text-sm 
                                   focus:outline-none focus:ring-2 
                                   focus:ring-green-500 bg-white 
                                   resize-none"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="w-full bg-gray-900 text-white py-3 
                                 rounded-lg font-medium text-sm 
                                 hover:bg-gray-800 transition-all 
                                 duration-300 hover:-translate-y-0.5"
                    >
                      Send Message →
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