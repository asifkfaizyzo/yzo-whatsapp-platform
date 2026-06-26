export default function QuickFeatures() {
  const features = [
    {
      icon: "📡",
      title: "Broadcast Messages",
      desc: "Send WhatsApp messages to thousands of contacts in one click.",
    },
    {
      icon: "🏢",
      title: "Multi-Tenant",
      desc: "Manage multiple businesses from a single dashboard.",
    },
    {
      icon: "📱",
      title: "Contact Management",
      desc: "Import, organize, and segment contacts easily.",
    },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-6">

        <h2 className="text-2xl font-bold text-gray-900 
                       text-center mb-12">
          Why teams choose{" "}
          <span className="text-[#125EF2]">sudoreply</span>
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-xl p-6 text-center
                         border border-gray-100"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                {f.title}
              </h3>
              <p className="text-sm text-gray-400">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}