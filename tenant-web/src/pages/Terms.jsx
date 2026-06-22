import Navbar from "../components/landing/layout/Navbar";
import Footer from "../components/landing/layout/Footer";
import { siteConfig } from "../config/site";

export default function Terms() {
  return (
    <div>
      <Navbar />

      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">

          {/* Header */}
          <div className="mb-12">
            <span className="text-green-600 font-semibold text-sm 
                             uppercase tracking-wider">
              Legal
            </span>
            <h1 className="text-3xl font-bold text-gray-900 mt-3 mb-2">
              Terms of Service
            </h1>
            <p className="text-sm text-gray-400">
              Last updated: January 2025
            </p>
          </div>

          {/* Content */}
          <div className="space-y-8 text-sm text-gray-600 leading-relaxed">

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing and using {siteConfig.brand} platform, you agree 
                to be bound by these Terms of Service. If you do not 
                agree, please do not use our services.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                2. Use of Service
              </h2>
              <p className="mb-3">You agree to:</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-500">
                <li>Use the platform only for lawful purposes</li>
                <li>Not send spam or unsolicited messages</li>
                <li>Comply with WhatsApp Business policies</li>
                <li>Not attempt to hack or disrupt the service</li>
                <li>Keep your account credentials secure</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                3. Account Management
              </h2>
              <p>
                You are responsible for maintaining the security of 
                your account. Each tenant admin is responsible for 
                managing users and contacts within their workspace. 
                Superadmins have full control over all tenants.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                4. Payment Terms
              </h2>
              <p>
                Paid plans are billed monthly or annually. All fees 
                are non-refundable unless stated otherwise. We reserve 
                the right to modify pricing with 30 days notice.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                5. Service Availability
              </h2>
              <p>
                We strive for 99.9% uptime but do not guarantee 
                uninterrupted service. Scheduled maintenance will 
                be communicated in advance. Check our Status page 
                for real-time service health.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                6. Termination
              </h2>
              <p>
                We may suspend or terminate your account if you 
                violate these terms. You may cancel your account 
                at any time from your dashboard settings.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                7. Contact
              </h2>
              <p>
                Questions about these terms? Contact us at{" "}
                <a href={`mailto:${siteConfig.emails.legal}`} 
                   className="text-green-600 hover:underline">
                  {siteConfig.emails.legal}
                </a>
              </p>
            </div>

          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}