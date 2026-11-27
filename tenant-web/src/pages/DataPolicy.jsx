// tenant-web/src/pages/DataPolicy.jsx (do not remove this comment)
import Navbar from "../components/landing/layout/Navbar";
import Footer from "../components/landing/layout/Footer";
import { siteConfig } from "../config/site";

export default function PrivacyPolicy() {
  return (
    <div>
      <Navbar />

      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          {/* Header */}
          <div className="mb-12">
            <span
              className="text-[#125EF2] font-semibold text-sm 
                             uppercase tracking-wider"
            >
              Legal
            </span>
            <h1 className="text-3xl font-bold text-gray-900 mt-3 mb-2">
              Privacy Policy
            </h1>
            <p className="text-sm text-gray-400">Last updated: June 2026</p>
          </div>

          {/* Content */}
          <div className="space-y-8 text-sm text-gray-600 leading-relaxed">
            {/* Section 1 */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                1. Information We Collect
              </h2>
              <p>
                We collect information you provide directly to us, including
                your name, email address, phone number, company name, and any
                other information you choose to provide when creating an account
                or contacting us. Additionally, when you connect third-party platforms
                such as Shopify, we may collect store, product, inventory, customer, order,
                and checkout information necessary to provide our integration services.
              </p>
            </div>

            {/* Section 2 */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                2. How We Use Your Information
              </h2>
              <p className="mb-3">We use the information we collect to:</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-500">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Monitor and analyze usage trends</li>
                <li>Synchronize data with third-party platforms to provide integration features</li>
              </ul>
            </div>

            {/* Section 3 */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                3. Data Storage & Security
              </h2>
              <p>
                We implement industry-standard security measures to protect your
                data. All data is encrypted in transit and at rest. We use
                secure servers and follow best practices for data protection.
                As part of operating our services, we may also use third-party hosting
                and infrastructure providers to store and process data securely.
              </p>
            </div>

            {/* Section 4 */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                4. Data Sharing
              </h2>
              <p>
                We do not sell, trade, or otherwise transfer your personal
                information to third parties. We may share data only with
                service providers who assist us in operating our platform,
                subject to confidentiality agreements. These may include hosting
                and infrastructure providers, as well as third-party platforms
                such as WhatsApp/Meta, Shopify, Google Sheets, and Zoho when you
                choose to use their integrations.
              </p>
            </div>

            {/* Section 5 */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                5. Your Rights
              </h2>
              <p className="mb-3">You have the right to:</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-500">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data</li>
                <li>Opt-out of marketing communications</li>
              </ul>
            </div>

            {/* Section 6 - NEW DATA DELETION SECTION */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                6. Data Deletion Request
              </h2>
              <p className="mb-3">
                If you would like to request deletion of your personal data from
                Sudoreply, you can submit a request by contacting us at{" "}
                <a
                  href="mailto:info@sudoreply.com"
                  className="text-[#125EF2] hover:underline"
                >
                  info@sudoreply.com
                </a>{" "}
                with the subject line{" "}
                <span className="font-medium text-gray-700">
                  "Data Deletion Request"
                </span>
                .
              </p>
              <p className="mb-3">Please include in your request:</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-500 mb-3">
                <li>Your full name</li>
                <li>Your registered email address</li>
                <li>Your WhatsApp Business account number (if applicable)</li>
              </ul>
              <p className="mb-3">Upon receiving your request we will:</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-500 mb-3">
                <li>Confirm receipt of your request within 48 hours</li>
                <li>Process the deletion within 30 days</li>
                <li>Notify you once your data has been permanently deleted</li>
              </ul>
              <p>
                All personal data associated with your account, including
                connected WhatsApp Business account information, message history
                stored in our systems, and profile data, will be permanently
                deleted unless retention is required by law.
              </p>
              <p>For Shopify-connected stores, we also handle customer data and
                deletion requests in accordance with Shopify’s requirements. Once disconnected,
                integration access stops and stored data is deleted as required.</p>
            </div>

            {/* Section 7 - Previously Section 6 */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                7. Contact Us
              </h2>
              <p>
                If you have any questions about this Privacy Policy, please
                contact us at{" "}
                <a
                  href="mailto:info@sudoreply.com"
                  className="text-blue-600 hover:underline"
                >
                  info@sudoreply.com
                </a>
              </p>
            </div>

             {/* Section 8 - NEW DATA DELETION SECTION */}
              <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                8. Device Permissions and Data Collection
              </h2>
              <p className="mb-3">
                The Sudo Reply mobile application may request access to certain
                device features to provide its communication and CRM functionality.
                These permissions are used as follows:
              </p>

              <h3 className="font-semibold text-gray-800 mb-2">
                Microphone and Audio
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-500 mb-3">
                <li>Microphone access is used for supported WhatsApp voice calling and recording or sending voice messages.</li>
                <li>Audio data may be processed to enable voice communication and voice-note functionality.</li>
                <li>Audio recordings are stored only where the relevant feature explicitly supports recording and the recording is initiated.</li>
              </ul>

              <h3 className="font-semibold text-gray-800 mb-2">
                Contacts
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-500 mb-3">
                <li>Contacts permission allows users to access and manage contact information through CRM functionality.</li>
                <li>Contact information may include names and phone numbers.</li>
                <li>Contact information is processed to support contact management and customer communication.</li>
              </ul>

              <h3 className="font-semibold text-gray-800 mb-2">
                Camera and Photos
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-500 mb-3">
                <li>Camera access allows users to capture images for sharing.</li>
                <li>Photo and video access allows users to select and send media attachments in conversations.</li>
                <li>Selected media may be uploaded to our servers or associated service providers to facilitate message delivery.</li>
              </ul>

              <h3 className="font-semibold text-gray-800 mb-2">
                Notifications
              </h3>
              <p>
                Notification permissions are used to deliver alerts about
                incoming messages, calls, and relevant account activity.
              </p>
              </div>

               {/* Section 9 - Third-Party Services */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                9. Third-Party Services
              </h2>
              <p className="mb-3">
                Sudo Reply integrates with third-party services, including
                Meta WhatsApp Business Platform and infrastructure providers,
                to deliver messaging, calling, media sharing, and CRM
                functionality.
              </p>
              <p className="mb-3">
                Information processed through these integrations may be
                subject to the respective third-party privacy policies and
                terms.
              </p>
              <p>
                We only process information necessary to provide the
                requested functionality.
              </p>
            </div>

              {/* Section 10 - Data Retention */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                10. Data Retention
              </h2>
              <p className="mb-3">
                We retain personal information for as long as necessary to
                provide our services, comply with legal obligations, resolve
                disputes, and enforce our agreements.
              </p>
              <p>
                Users may request deletion of their personal information using
                the contact details provided in Section 6.
              </p>
            </div>

            {/* Section 11 - Account and Data Deletion */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                11. Account and Data Deletion
              </h2>
              <p className="mb-3">
                Users have the right to request the deletion of their account
                and all associated personal data at any time.
              </p>

              <h3 className="font-semibold text-gray-800 mb-2">
                How to request account and data deletion:
              </h3>
              <ol className="list-decimal pl-5 space-y-1 text-gray-500 mb-3">
                <li>
                  <span className="font-medium text-gray-700">
                    Via Dashboard / Settings:
                  </span>{" "}
                  Mobile app users can delete their account through the
                  Account Settings section of the Sudo Reply mobile app,
                  if this feature is available.
                </li>
                <li>
                  <span className="font-medium text-gray-700">
                    Via Email Request:
                  </span>{" "}
                  Users can submit an account and data deletion request by
                  emailing{" "}
                  <a
                    href="mailto:info@sudoreply.com"
                    className="text-[#125EF2] hover:underline"
                  >
                    info@sudoreply.com
                  </a>{" "}
                  with the subject line{" "}
                  <span className="font-medium text-gray-700">
                    "Account Deletion Request"
                  </span>
                  . Please send the request from the email address registered
                  with your Sudo Reply account.
                </li>
              </ol>

              <h3 className="font-semibold text-gray-800 mb-2">
                What data will be deleted:
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-500 mb-3">
                <li>User profile information, including name, email address, password hash, and profile image.</li>
                <li>Contact lists and customer data associated with the tenant workspace.</li>
                <li>Stored chat messages, call logs, and uploaded media files.</li>
                <li>Device tokens and notification identifiers.</li>
              </ul>

              <h3 className="font-semibold text-gray-800 mb-2">
                Data retention:
              </h3>
              <p className="mb-3">
                Upon receipt of a verified deletion request, all personal data
                and account records will be permanently deleted from our active
                databases within 30 days.
              </p>
              <p>
                Certain billing and transactional records may be retained for
                up to 7 years solely to comply with legal, tax, and regulatory
                obligations.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
