import Navbar from "../components/landing/layout/Navbar";
import Footer from "../components/landing/layout/Footer";
import { siteConfig } from "../config/site";

export default function ShippingPolicy() {
  return (
    <div>
      <Navbar />

      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          {/* Header */}
          <div className="mb-12">
            <span className="text-[#125EF2] font-semibold text-sm uppercase tracking-wider">
              Legal & Delivery
            </span>
            <h1 className="text-3xl font-bold text-gray-900 mt-3 mb-2">
              Shipping & Delivery Policy
            </h1>
            <p className="text-sm text-gray-400">
              Last updated: January 2025
            </p>
          </div>

          {/* Content */}
          <div className="space-y-8 text-sm text-gray-600 leading-relaxed">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                1. Nature of Services
              </h2>
              <p>
                {siteConfig.brand} ({siteConfig.domain}) provides cloud-based SaaS (Software-as-a-Service) solutions for WhatsApp marketing, team inboxes, broadcasts, and automation. We do not sell or ship physical goods. All services are delivered digitally through electronic means.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                2. Digital Delivery & Fulfillment Process
              </h2>
              <ul className="list-disc pl-5 space-y-2 text-gray-600">
                <li>
                  <strong>Instant Online Access:</strong> Upon successful payment and subscription checkout, your {siteConfig.brand} workspace and plan features are activated instantly.
                </li>
                <li>
                  <strong>Email Confirmation:</strong> A payment receipt, invoice, and account confirmation details will be sent immediately to your registered account email address.
                </li>
                <li>
                  <strong>Access Credentials:</strong> You can log in to your tenant dashboard immediately using your registered credentials at{" "}
                  <a href={`https://${siteConfig.domain}/login`} className="text-[#125EF2] underline">
                    https://{siteConfig.domain}/login
                  </a>.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                3. Delivery Timeline & Charges
              </h2>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li><strong>Delivery Timeline:</strong> Immediate / Real-time (within seconds of payment confirmation).</li>
                <li><strong>Shipping / Delivery Fees:</strong> ₹0.00 (There are no shipping or handling charges applicable for our digital software services).</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                4. Issues with Digital Delivery or Account Access
              </h2>
              <p>
                If you have completed payment but have not received your account confirmation or are unable to access your purchased features, please contact our support team immediately. We will resolve your access within 2 hours during business hours:
              </p>
              <div className="mt-3 p-4 bg-gray-50 border border-gray-100 rounded-lg text-xs space-y-1 text-gray-700">
                <p><strong>Support Email:</strong> <a href={`mailto:${siteConfig.emails.support}`} className="text-[#125EF2]">{siteConfig.emails.support}</a></p>
                <p><strong>Website:</strong> <a href={`https://${siteConfig.domain}`} className="text-[#125EF2]">https://{siteConfig.domain}</a></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
