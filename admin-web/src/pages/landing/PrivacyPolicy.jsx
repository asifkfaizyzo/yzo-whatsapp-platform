export default function PrivacyPolicy() {
  return (
    <div>
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">

          {/* Header */}
          <div className="mb-12">
            <span className="text-blue-600 font-semibold text-sm 
                             uppercase tracking-wider">
              Legal
            </span>
            <h1 className="text-3xl font-bold text-gray-900 mt-3 mb-2">
              Privacy Policy
            </h1>
            <p className="text-sm text-gray-400">
              Last updated: June 2026
            </p>
          </div>

          {/* Content */}
          <div className="space-y-8 text-sm text-gray-600 leading-relaxed">

            {/* Section 1 */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                1. Information We Collect
              </h2>
              <p>
                We collect information you provide directly to us, 
                including your name, email address, phone number, 
                company name, and any other information you choose 
                to provide when creating an account or contacting us.
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
              </ul>
            </div>

            {/* Section 3 */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                3. Data Storage & Security
              </h2>
              <p>
                We implement industry-standard security measures to 
                protect your data. All data is encrypted in transit 
                and at rest. We use secure servers and follow best 
                practices for data protection.
              </p>
            </div>

            {/* Section 4 */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                4. Data Sharing
              </h2>
              <p>
                We do not sell, trade, or otherwise transfer your 
                personal information to third parties. We may share 
                data only with service providers who assist us in 
                operating our platform, subject to confidentiality 
                agreements.
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
                If you would like to request deletion of your personal 
                data from Sudoreply, you can submit a request by 
                contacting us at{" "}
                <a
                  href="mailto:privacy@sudoreply.com"
                  className="text-blue-600 hover:underline"
                >
                  privacy@sudoreply.com
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
                <li>
                  Your WhatsApp Business account number (if applicable)
                </li>
              </ul>
              <p className="mb-3">Upon receiving your request we will:</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-500 mb-3">
                <li>Confirm receipt of your request within 48 hours</li>
                <li>Process the deletion within 30 days</li>
                <li>
                  Notify you once your data has been permanently deleted
                </li>
              </ul>
              <p>
                All personal data associated with your account, including 
                connected WhatsApp Business account information, message 
                history stored in our systems, and profile data, will be 
                permanently deleted unless retention is required by law.
              </p>
            </div>

            {/* Section 7 - Previously Section 6 */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                7. Contact Us
              </h2>
              <p>
                If you have any questions about this Privacy Policy, 
                please contact us at{" "}
                <a
                  href="mailto:privacy@sudoreply.com"
                  className="text-blue-600 hover:underline"
                >
                  privacy@sudoreply.com
                </a>
              </p>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}