import { Link } from "react-router-dom";

export default function HeroSection() {
  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="max-w-3xl mx-auto px-6 text-center">

        {/* Badge */}
        <span className="inline-block bg-[#EAF2FE] text-[#125EF2] 
                         text-sm font-medium px-4 py-1.5 
                         rounded-full mb-6">
          WhatsApp Broadcasting Platform
        </span>

        {/* Heading */}
        <h1 className="text-4xl md:text-5xl font-bold 
                       text-gray-900 leading-tight mb-6">
          Broadcast Messages to{" "}
          <span className="text-[#125EF2]">Thousands</span>
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
            to="/register"
            className="bg-[#125EF2] text-white px-7 py-3 
                       rounded-lg font-medium text-sm 
                       hover:bg-[#0F4FCC] transition-all 
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

      
       {/* Trust Text (With Brand Blue Ticks) */}
        <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm text-gray-400 font-medium">
          <span className="flex items-center">
            <svg 
              className="w-4 h-4 text-[#125EF2] mr-1.5 stroke-[3]" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            No credit card
          </span>
          <span className="flex items-center">
            <svg 
              className="w-4 h-4 text-[#125EF2] mr-1.5 stroke-[3]" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Free trial
          </span>
          <span className="flex items-center">
            <svg 
              className="w-4 h-4 text-[#125EF2] mr-1.5 stroke-[3]" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Cancel anytime
          </span>
        </div>
      </div>
    </section>
  );
}