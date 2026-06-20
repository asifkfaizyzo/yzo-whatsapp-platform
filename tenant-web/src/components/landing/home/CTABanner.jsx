import { Link } from "react-router-dom";

export default function CTABanner() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 text-center">

        {/* Small Icon */}
        <div className="w-14 h-14 bg-green-100 rounded-2xl 
                        flex items-center justify-center 
                        text-2xl mx-auto mb-6">
          🚀
        </div>

        {/* Heading */}
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          Ready to get started?
        </h2>

        {/* Sub Text */}
        <p className="text-gray-400 mb-8">
          Start your free trial today. No credit card required.
        </p>

        {/* Buttons */}
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/auth/register"
            className="bg-gray-900 text-white px-7 py-3 
                       rounded-lg font-medium text-sm
                       hover:bg-gray-800 transition-all 
                       duration-300 hover:-translate-y-0.5 
                       hover:shadow-lg"
          >
            Start Free Trial →
          </Link>

          <Link
            to="/contact"
            className="bg-white text-gray-600 px-7 py-3 
                       rounded-lg font-medium text-sm
                       border border-gray-200
                       hover:border-gray-300 hover:text-gray-900
                       transition-all duration-300"
          >
            Talk to Sales
          </Link>
        </div>

      </div>
    </section>
  );
}