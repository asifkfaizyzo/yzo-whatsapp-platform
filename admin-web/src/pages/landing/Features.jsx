
import { Link } from "react-router-dom";

export default function Features() {
  const features = [
    {
      icon: "📡",
      title: "Broadcast Messaging",
      desc: "Send WhatsApp messages to thousands of contacts instantly. Schedule campaigns, use templates, and track delivery.",
    },
    {
      icon: "🏢",
      title: "Multi-Tenant System",
      desc: "Manage multiple businesses from one dashboard. Each tenant gets their own workspace, users, and contacts.",
    },
    {
      icon: "👥",
      title: "User Management",
      desc: "Add users under each tenant with role-based access. Control who can send, manage, or view campaigns.",
    },
    {
      icon: "📱",
      title: "Contact Management",
      desc: "Import, organize, and segment contacts. Tag and filter audiences for targeted broadcasting.",
    },
    {
      icon: "📊",
      title: "Campaign Analytics",
      desc: "Track delivery rates, read receipts, and engagement. Real-time reports for every broadcast.",
    },
    {
      icon: "👑",
      title: "Admin Control",
      desc: "Full control over all tenants, users, and campaigns from a single superadmin dashboard.",
    },
  ];

  return (
    <div>
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">

          {/* Header */}
          <div className="text-center mb-14">
            <span className="text-green-600 font-semibold text-sm 
                             uppercase tracking-wider">
              Features
            </span>
            <h1 className="text-3xl font-bold text-gray-900 mt-3 mb-4">
              Everything you need to{" "}
              <span className="text-green-600">broadcast at scale</span>
            </h1>
            <p className="text-gray-500 max-w-lg mx-auto text-sm">
              Simple, powerful tools to manage tenants, 
              users, contacts, and campaigns.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="flex gap-4 bg-gray-50 rounded-xl p-5 
                           border border-gray-100
                           hover:bg-white hover:shadow-sm 
                           hover:border-green-100
                           transition-all duration-300"
              >
                {/* Icon */}
                <div className="w-10 h-10 bg-white rounded-lg 
                                flex items-center justify-center 
                                text-xl shrink-0 border border-gray-100">
                  {f.icon}
                </div>

                {/* Text */}
                <div>
                  <h3 className="text-sm font-semibold 
                                 text-gray-900 mb-1">
                    {f.title}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-14">
            <Link
              to="/auth/register"
              className="bg-gray-900 text-white px-7 py-3 
                         rounded-lg font-medium text-sm 
                         hover:bg-gray-800 transition"
            >
              Start Free Trial →
            </Link>
          </div>

        </div>
      </section>

    </div>
  );
}