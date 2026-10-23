import Navbar from "../components/landing/layout/Navbar";
import Footer from "../components/landing/layout/Footer";
import { siteConfig } from "../config/site";

export default function RefundPolicy() {
  return (
    <div>
      <Navbar />

      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          {/* Header */}
          <div className="mb-12">
            <span className="text-[#125EF2] font-semibold text-sm uppercase tracking-wider">
              Legal & Compliance
            </span>
            <h1 className="text-3xl font-bold text-gray-900 mt-3 mb-2">
              Cancellation and Refund Policy
            </h1>
            <p className="text-sm text-gray-400">
              Last updated: January 2025
            </p>
          </div>

          {/* Content */}
          <div className="space-y-8 text-sm text-gray-600 leading-relaxed">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                1. Overview
              </h2>
              <p>
                At {siteConfig.brand} ({siteConfig.domain}), we are committed to providing a reliable WhatsApp marketing and customer engagement platform. This Cancellation and Refund Policy outlines the terms under which cancellations and refunds are handled for our subscription plans and digital services.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                2. Subscription Cancellation
              </h2>
              <ul className="list-disc pl-5 space-y-2 text-gray-600">
                <li>
                  <strong>Cancel Anytime:</strong> You can cancel your subscription at any time directly through your account dashboard under <em>Settings &rarr; Billing</em> or by contacting our support team at{" "}
                  <a href={`mailto:${siteConfig.emails.support}`} className="text-[#125EF2] underline">
                    {siteConfig.emails.support}
                  </a>.
                </li>
                <li>
                  <strong>Active Period:</strong> Upon cancellation, your account will remain active and retain all plan benefits until the end of your current paid billing period (monthly or annual).
                </li>
                <li>
                  <strong>Autopay / Recurring Payments:</strong> Once cancelled, no further recurring charges or automated renewals will be processed on your payment method.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                3. Refund Policy
              </h2>
              <ul className="list-disc pl-5 space-y-2 text-gray-600">
                <li>
                  <strong>7-Day Money-Back Guarantee:</strong> If you are not satisfied with your initial paid subscription, you may request a full refund within <strong>7 days</strong> of your first purchase.
                </li>
                <li>
                  <strong>Technical or Billing Issues:</strong> If you experienced a billing error (e.g., duplicate charge) or a severe technical issue preventing service usage that could not be resolved by our support team, you are eligible for a full refund for the affected billing cycle.
                </li>
                <li>
                  <strong>Meta / WhatsApp Conversation Fees:</strong> WhatsApp conversation fees charged directly by Meta or pre-funded usage credits are non-refundable once consumed.
                </li>
                <li>
                  <strong>Fair Usage & Policy Violations:</strong> Accounts terminated due to violation of our Terms of Service, anti-spam policies, or WhatsApp Commerce Policies are not eligible for refunds.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                4. Refund Processing Timeline
              </h2>
              <p className="mb-2">
                Approved refunds will be processed through our payment gateway (Razorpay) back to your original method of payment (UPI, Credit/Debit Card, Net Banking):
              </p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li><strong>Refund Initiation:</strong> Within 1–2 business days of request approval.</li>
                <li><strong>Bank Settlement:</strong> 5–7 working days for the credit to reflect in your bank account or card statement, depending on your bank's processing cycle.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                5. How to Request a Refund
              </h2>
              <p>
                To request a refund or raise a billing inquiry, please email us with your registered account email and payment transaction details:
              </p>
              <div className="mt-3 p-4 bg-gray-50 border border-gray-100 rounded-lg text-xs space-y-1 text-gray-700">
                <p><strong>Support Email:</strong> <a href={`mailto:${siteConfig.emails.support}`} className="text-[#125EF2]">{siteConfig.emails.support}</a></p>
                <p><strong>Response Time:</strong> Within 24 hours (Monday – Saturday)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
