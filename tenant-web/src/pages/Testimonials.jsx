import Navbar from "../components/landing/layout/Navbar";
import Footer from "../components/landing/layout/Footer";

export default function Testimonials() {
  const reviews = [
    {
      name: "David Chen",
      role: "Marketing Head, E-commerce Co.",
      text: "We send 50K+ WhatsApp messages weekly using sudoreply. The multi-tenant setup lets us manage all our brands from one dashboard. Incredible tool.",
      rating: 5,
    },
    {
      name: "Priya Sharma",
      role: "CEO, Digital Agency",
      text: "Managing 12 clients as separate tenants is a breeze. Each client gets their own contacts, users, and campaigns. Exactly what we needed.",
      rating: 5,
    },
    {
      name: "James Wilson",
      role: "Operations Lead, Retail Chain",
      text: "Broadcasting promotions to our 100K+ contacts takes one click. Delivery rates are consistently above 95%. Our sales jumped 40%.",
      rating: 5,
    },
  ];

  const stats = [
    { number: "5K+", label: "Businesses" },
    { number: "50M+", label: "Messages Sent" },
    { number: "98%", label: "Delivery Rate" },
    { number: "100+", label: "Countries" },
  ];

  return (
    <div>
      <Navbar />

      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">

          {/* Header */}
          <div className="text-center mb-14">
            <span className="text-[#125EF2] font-semibold text-sm 
                             uppercase tracking-wider">
              Testimonials
            </span>
            <h1 className="text-3xl font-bold text-gray-900 mt-3 mb-4">
              Trusted by{" "}
              <span className="text-[#125EF2]">5,000+ businesses</span>
            </h1>
            <p className="text-gray-500 text-sm">
              See why teams choose sudoreply for WhatsApp broadcasting.
            </p>
          </div>

          {/* Review Cards */}
          <div className="grid md:grid-cols-3 gap-5">
            {reviews.map((review) => (
              <div
                key={review.name}
                className="bg-gray-50 rounded-xl p-6 
                           border border-gray-100"
              >
                {/* Stars */}
                <div className="text-yellow-400 text-sm mb-4">
                  {"⭐".repeat(review.rating)}
                </div>

                {/* Quote */}
                <p className="text-gray-600 text-sm leading-relaxed mb-6">
                  "{review.text}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#CFE0FD] rounded-full 
                                  flex items-center justify-center 
                                  text-[#125EF2] font-bold text-sm">
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {review.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {review.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-14">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="text-center bg-gray-50 rounded-xl 
                           p-5 border border-gray-100"
              >
                <p className="text-2xl font-bold text-gray-900">
                  {stat.number}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}