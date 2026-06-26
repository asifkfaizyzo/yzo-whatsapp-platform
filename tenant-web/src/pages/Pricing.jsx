import Navbar from "../components/landing/layout/Navbar";
import Footer from "../components/landing/layout/Footer";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getPublicPlans } from "../services/plan.service";

export default function Pricing() {
  // ── Live from DB ──
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPlans = async () => {
      setLoading(true);
      const res = await getPublicPlans();
      if (res.success) {
        setPlans(res.data);
      } else {
        setError(res.message);
      }
      setLoading(false);
    };
    loadPlans();
  }, []);

  // ── Hardcoded sections (update later from DB if needed) ──
  const annualBilling = [
    { plan: "Starter", monthly: "₹1,999", annual: "₹1,499", savings: "₹6,000/year" },
    { plan: "Growth",  monthly: "₹4,999", annual: "₹3,749", savings: "₹15,000/year" },
    { plan: "Scale",   monthly: "₹9,999", annual: "₹7,499", savings: "₹30,000/year" },
  ];

  const addons = [
    { name: "Extra Agent",               price: "₹500/agent/month" },
    { name: "Green Tick Verification",   price: "₹2,999 one-time" },
    { name: "Extra AI Copilot Credits",  price: "₹299 per 500 credits" },
    { name: "Extra Organization",        price: "₹999/month" },
    { name: "Priority Onboarding",       price: "₹4,999 one-time" },
  ];

  const competitors = [
    { platform: "Our Platform", plan1: "₹1,999", plan2: "₹4,999", plan3: "₹9,999",  markup: "0%" },
    { platform: "Wati",         plan1: "₹2,199", plan2: "₹4,899", plan3: "₹14,799", markup: "~20%" },
    { platform: "Interakt",     plan1: "₹3,499", plan2: "₹7,699", plan3: "₹10,499", markup: "Low" },
    { platform: "Mark360.ai",   plan1: "₹1,999", plan2: "₹3,500", plan3: "₹8,500",  markup: "Low" },
    { platform: "AiSensy",      plan1: "₹1,395", plan2: "₹2,999", plan3: "-",        markup: "0%" },
    { platform: "Gallabox",     plan1: "₹2,399", plan2: "₹5,599", plan3: "₹13,599", markup: "Varies" },
  ];

  const advantages = [
    { competitor: "AiSensy Basic",      theirPrice: "₹1,395",  plan: "Starter", advantage: "More features + omnichannel inbox" },
    { competitor: "Mark360 Scale",      theirPrice: "₹1,999",  plan: "Starter", advantage: "Better automation + integrations" },
    { competitor: "Wati Pro",           theirPrice: "₹4,899",  plan: "Growth",  advantage: "AI copilot + drip campaigns + 0% markup" },
    { competitor: "Gallabox Essential", theirPrice: "₹5,599",  plan: "Growth",  advantage: "Cheaper + more features" },
    { competitor: "Wati Business",      theirPrice: "₹14,799", plan: "Scale",   advantage: "Same features — 33% cheaper" },
    { competitor: "Gallabox Advanced",  theirPrice: "₹13,599", plan: "Scale",   advantage: "AI voice + cheaper + 0% markup" },
    { competitor: "Interakt Advanced",  theirPrice: "₹10,499", plan: "Scale",   advantage: "Better AI + more integrations" },
  ];

  return (
    <div>
      <Navbar />

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">

          {/* Header */}
          <div className="text-center mb-14">
            <span className="text-[#125EF2] font-semibold text-sm uppercase tracking-wider">
              Pricing
            </span>
            <h1 className="text-4xl font-bold text-gray-900 mt-3 mb-4">
              Simple,{" "}
              <span className="text-[#125EF2]">Transparent</span> Pricing
            </h1>
            <p className="text-gray-500">
              0% Meta Markup • Free 14-Day Trial • No Credit Card Required
            </p>
          </div>

          {/* ── Pricing Cards — Live from DB ── */}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20 mb-20">
              <div className="flex items-center gap-3 text-gray-400">
                <svg
                  className="animate-spin w-5 h-5 text-[#125EF2]"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12" cy="12" r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
                <span className="text-sm">Loading plans...</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="text-center py-10 mb-20">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          {/* Plans */}
          {!loading && !error && (
            <div className="grid md:grid-cols-3 gap-6 mb-20">
              {plans.map((plan, index) => {
                const isPopular = index === 1; // middle plan = most popular
                return (
                  <div
                    key={plan.id}
                    className={
                      isPopular
                        ? "rounded-2xl p-6 bg-gray-900 text-white ring-2 ring-[#125EF2]"
                        : "rounded-2xl p-6 bg-gray-50 border border-gray-100"
                    }
                  >
                    {/* Popular Badge */}
                    {isPopular && (
                      <span
                        className="inline-block bg-[#125EF2] text-white
                                   text-xs font-semibold px-3 py-1
                                   rounded-full mb-4"
                      >
                        Most Popular
                      </span>
                    )}

                    {/* Name */}
                    <h3 className="text-xl font-bold">{plan.name}</h3>

                    {/* Price */}
                    <div className="mt-2 mb-2">
                      <span className="text-4xl font-bold">
                        ₹{plan.monthlyPrice.toLocaleString()}
                      </span>
                      <span
                        className={
                          isPopular
                            ? "text-gray-400 text-sm ml-1"
                            : "text-gray-500 text-sm ml-1"
                        }
                      >
                        /month
                      </span>
                    </div>

                    {/* Annual */}
                    {plan.annualPrice && (
                      <p className="text-xs text-[#125EF2] font-medium mb-1">
                        ₹{plan.annualPrice.toLocaleString()}/mo billed annually
                      </p>
                    )}

                    {/* Description */}
                    <p
                      className={
                        isPopular
                          ? "text-gray-400 text-sm mb-6"
                          : "text-gray-500 text-sm mb-6"
                      }
                    >
                      {plan.description}
                    </p>

                    {/* Features */}
                    <ul className="space-y-2 mb-8">
                      {plan.features.map((pf) => (
                        <li
                          key={pf.id}
                          className={
                            isPopular
                              ? "flex gap-2 text-sm text-gray-300"
                              : "flex gap-2 text-sm text-gray-600"
                          }
                        >
                          <span className="text-[#125EF2]">&#10003;</span>
                          {pf.feature.name}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Link
                      to="/register"
                      className={
                        isPopular
                          ? "block text-center py-3 rounded-lg bg-[#125EF2] text-white hover:bg-[#0F4FCC] font-medium text-sm transition-all duration-300 hover:-translate-y-0.5"
                          : "block text-center py-3 rounded-lg bg-white border border-gray-200 hover:shadow-sm font-medium text-sm transition-all duration-300 hover:-translate-y-0.5"
                      }
                    >
                      Start Free Trial
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          {/* Annual Billing — hardcoded */}
          <h2 className="text-3xl font-bold text-center mb-8">
            Annual Billing (25% Discount)
          </h2>
          <div className="overflow-x-auto mb-20">
            <table className="w-full border">
              <thead className="bg-[#125EF2] text-white">
                <tr>
                  <th className="p-4 text-left">Plan</th>
                  <th className="p-4 text-left">Monthly</th>
                  <th className="p-4 text-left">Annual / Month</th>
                  <th className="p-4 text-left">Savings</th>
                </tr>
              </thead>
              <tbody>
                {annualBilling.map((item) => (
                  <tr key={item.plan} className="border-b">
                    <td className="p-4">{item.plan}</td>
                    <td className="p-4">{item.monthly}</td>
                    <td className="p-4">{item.annual}</td>
                    <td className="p-4 text-[#125EF2] font-semibold">
                      {item.savings}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Addons — hardcoded */}
          <h2 className="text-3xl font-bold text-center mb-8">
            Add-Ons (Available on All Plans)
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
            {addons.map((addon) => (
              <div
                key={addon.name}
                className="bg-gray-50 border border-gray-100 rounded-xl p-6
                           hover:border-[#CFE0FD] hover:shadow-sm
                           transition-all duration-300"
              >
                <h3 className="font-semibold text-gray-900">{addon.name}</h3>
                <p className="text-[#125EF2] font-bold mt-2">{addon.price}</p>
              </div>
            ))}
          </div>

          {/* Competitor Pricing — hardcoded */}
          <h2 className="text-3xl font-bold text-center mb-8">
            Competitor Pricing Comparison
          </h2>
          <div className="overflow-x-auto mb-20">
            <table className="w-full border">
              <thead className="bg-gray-900 text-white">
                <tr>
                  <th className="p-4 text-left">Platform</th>
                  <th className="p-4 text-left">Plan 1</th>
                  <th className="p-4 text-left">Plan 2</th>
                  <th className="p-4 text-left">Plan 3</th>
                  <th className="p-4 text-left">Meta Markup</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((row) => (
                  <tr key={row.platform} className="border-b">
                    <td className="p-4 font-medium">{row.platform}</td>
                    <td className="p-4">{row.plan1}</td>
                    <td className="p-4">{row.plan2}</td>
                    <td className="p-4">{row.plan3}</td>
                    <td className="p-4">{row.markup}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Key Advantages — hardcoded */}
          <h2 className="text-3xl font-bold text-center mb-8">
            Our Key Advantages
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border">
              <thead className="bg-[#125EF2] text-white">
                <tr>
                  <th className="p-4 text-left">Competitor</th>
                  <th className="p-4 text-left">Their Price</th>
                  <th className="p-4 text-left">Our Plan</th>
                  <th className="p-4 text-left">Advantage</th>
                </tr>
              </thead>
              <tbody>
                {advantages.map((item) => (
                  <tr key={item.competitor} className="border-b">
                    <td className="p-4">{item.competitor}</td>
                    <td className="p-4">{item.theirPrice}</td>
                    <td className="p-4">{item.plan}</td>
                    <td className="p-4">{item.advantage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Banner */}
          <div className="mt-20">
            <div
              className="bg-gradient-to-r from-[#125EF2] to-[#0F4FCC]
                          rounded-2xl px-8 py-6 text-center text-white"
            >
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
                <span className="font-semibold">&#10003; 0% Meta Markup on All Plans</span>
                <span className="hidden md:block opacity-50">|</span>
                <span className="font-semibold">&#10003; Free 14-Day Trial</span>
                <span className="hidden md:block opacity-50">|</span>
                <span className="font-semibold">&#10003; No Credit Card Required</span>
                <span className="hidden md:block opacity-50">|</span>
                <span className="font-semibold">&#10003; Annual Billing Saves Up To 25%</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}