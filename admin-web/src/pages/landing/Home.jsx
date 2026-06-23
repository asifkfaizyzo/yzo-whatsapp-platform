import { Link } from "react-router-dom";

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="py-20 md:py-32 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <span className="inline-block bg-green-50 text-green-600 
                           text-sm font-medium px-4 py-1.5 
                           rounded-full mb-6">
            WhatsApp Broadcasting Platform
          </span>
          <h1 className="text-4xl md:text-5xl font-bold 
                         text-gray-900 leading-tight mb-6">
            Broadcast Messages to{" "}
            <span className="text-green-600">Thousands</span>
            {" "}— Instantly
          </h1>
          <p className="text-lg text-gray-500 max-w-xl 
                        mx-auto mb-10 leading-relaxed">
            Manage tenants, users, and contacts in one place. 
            Send bulk WhatsApp messages at scale.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Link to="/register"
              className="bg-green-600 text-white px-7 py-3 
                         rounded-lg font-medium text-sm 
                         hover:bg-green-700 transition-all 
                         hover:-translate-y-0.5 shadow-sm">
              Start Free Trial →
            </Link>
            <Link to="/contact"
              className="border border-gray-200 text-gray-600 
                         px-7 py-3 rounded-lg font-medium text-sm 
                         hover:border-gray-300 hover:text-gray-900 
                         transition-all">
              Book a Demo
            </Link>
          </div>
          <p className="text-sm text-gray-400">
            ✅ No credit card &nbsp; 
            ✅ Free trial &nbsp; 
            ✅ Cancel anytime
          </p>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="py-8 border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-xs text-gray-400 uppercase 
                        tracking-widest text-center mb-6">
            Trusted by 5,000+ businesses worldwide
          </p>
          <div className="flex flex-wrap justify-center 
                          items-center gap-10">
            {["BMW", "KFC", "Skoda", "Danone", "Netflix"].map((name) => (
              <span key={name}
                className="text-lg font-bold text-gray-200 
                           hover:text-gray-400 transition">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 
                         text-center mb-12">
            Why teams choose{" "}
            <span className="text-green-600">sudoreply</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "📡",
                title: "Broadcast Messages",
                desc: "Send WhatsApp messages to thousands in one click.",
              },
              {
                icon: "🏢",
                title: "Multi-Tenant",
                desc: "Manage multiple businesses from one dashboard.",
              },
              {
                icon: "📱",
                title: "Contact Management",
                desc: "Import, organize, and segment contacts easily.",
              },
            ].map((f) => (
              <div key={f.title}
                className="bg-white rounded-xl p-6 text-center 
                           border border-gray-100 
                           hover:-translate-y-1 hover:shadow-md 
                           transition-all duration-300">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-sm font-semibold 
                               text-gray-900 mb-1">
                  {f.title}
                </h3>
                <p className="text-sm text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Ready to get started?
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Start broadcasting today. No credit card required.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/register"
              className="bg-gray-900 text-white px-7 py-3 
                         rounded-lg font-medium text-sm 
                         hover:bg-gray-800 transition">
              Start Free Trial →
            </Link>
            <Link to="/contact"
              className="border border-gray-200 text-gray-600 
                         px-7 py-3 rounded-lg font-medium text-sm 
                         hover:border-gray-300 transition">
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}