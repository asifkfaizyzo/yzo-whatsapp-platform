
import { Link } from "react-router-dom";

export default function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "$39",
      desc: "For small businesses getting started",
      features: [
        "1 Tenant",
        "3 Users",
        "5,000 Contacts",
        "10,000 Messages/mo",
        "Basic templates",
        "Email support",
      ],
      cta: "Start Free",
      popular: false,
    },
    {
      name: "Growth",
      price: "$79",
      desc: "For growing businesses",
      features: [
        "5 Tenants",
        "15 Users",
        "25,000 Contacts",
        "50,000 Messages/mo",
        "Advanced templates",
        "Campaign analytics",
        "Priority support",
      ],
      cta: "Start Free",
      popular: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      desc: "For large organizations",
      features: [
        "Unlimited Tenants",
        "Unlimited Users",
        "Unlimited Contacts",
        "Unlimited Messages",
        "Custom templates",
        "Dedicated account manager",
        "API access",
        "SLA guarantee",
      ],
      cta: "Contact Sales",
      popular: false,
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
              Pricing
            </span>
            <h1 className="text-3xl font-bold text-gray-900 mt-3 mb-4">
              Simple,{" "}
              <span className="text-green-600">transparent</span> pricing
            </h1>
            <p className="text-gray-500 text-sm">
              Start free. Scale as you grow. No hidden fees.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-5">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6
                           ${plan.popular
                             ? "bg-gray-900 text-white ring-2 ring-green-500"
                             : "bg-gray-50 text-gray-900 border border-gray-100"
                           }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <span className="inline-block bg-green-500 text-white 
                                   text-xs font-semibold px-3 py-1 
                                   rounded-full mb-4">
                    Most Popular
                  </span>
                )}

                {/* Plan Name */}
                <h3 className="text-base font-semibold">
                  {plan.name}
                </h3>

                {/* Price */}
                <div className="mt-2 mb-1">
                  <span className="text-3xl font-bold">
                    {plan.price}
                  </span>
                  {plan.price !== "Custom" && (
                    <span className={`text-sm ${
                      plan.popular ? "text-gray-400" : "text-gray-500"
                    }`}>
                      /month
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className={`text-sm mb-6 ${
                  plan.popular ? "text-gray-400" : "text-gray-500"
                }`}>
                  {plan.desc}
                </p>

                {/* Features */}
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className={`flex items-center gap-2 text-sm ${
                        plan.popular ? "text-gray-300" : "text-gray-600"
                      }`}
                    >
                      <span className="text-green-500">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Link
                  to={plan.name === "Enterprise" 
                      ? "/contact" 
                      : "/auth/register"}
                  className={`block text-center py-2.5 rounded-lg 
                             font-medium text-sm transition-all 
                             duration-300 hover:-translate-y-0.5
                             ${plan.popular
                               ? "bg-green-500 text-white hover:bg-green-600"
                               : "bg-white text-gray-900 border border-gray-200 hover:border-gray-300 hover:shadow-sm"
                             }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Bottom Note */}
          <p className="text-center text-xs text-gray-400 mt-10">
            All plans include WhatsApp Business API access. 
            14-day free trial on Starter & Growth plans.
          </p>

        </div>
      </section>

    </div>
  );
}