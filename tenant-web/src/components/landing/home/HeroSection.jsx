import { Link } from "react-router-dom";

export default function HeroSection() {
  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="max-w-3xl mx-auto px-6 text-center">

        {/* Badge */}
        <span className="inline-block bg-green-50 text-green-600 
                         text-sm font-medium px-4 py-1.5 
                         rounded-full mb-6">
          WhatsApp Broadcasting Platform
        </span>

        {/* Heading */}
        <h1 className="text-4xl md:text-5xl font-bold 
                       text-gray-900 leading-tight mb-6">
          Broadcast Messages to{" "}
          <span className="text-green-600">Thousands</span>
          {" "}— Instantly
        </h1>

        {/* Sub Text */}
        <p className="text-lg text-gray-500 max-w-xl 
                      mx-auto mb-10 leading-relaxed">
          Manage tenants, users, and contacts in one place. 
          Send bulk WhatsApp messages at scale.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <Link
            to="/auth/register"
            className="bg-green-600 text-white px-7 py-3 
                       rounded-lg font-medium text-sm 
                       hover:bg-green-700 transition-all 
                       duration-300 hover:-translate-y-0.5 
                       shadow-sm"
          >
            Start Free Trial →
          </Link>

          <Link
            to="/contact"
            className="border border-gray-200 text-gray-600 
                       px-7 py-3 rounded-lg font-medium text-sm 
                       hover:border-gray-300 hover:text-gray-900 
                       transition-all duration-300"
          >
            Book a Demo
          </Link>
        </div>

        {/* Trust Text */}
        <p className="text-sm text-gray-400">
          ✅ No credit card &nbsp; ✅ Free trial &nbsp; ✅ Cancel anytime
        </p>

      </div>
    </section>
  );
}