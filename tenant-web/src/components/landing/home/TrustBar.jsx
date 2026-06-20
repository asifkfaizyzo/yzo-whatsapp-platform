export default function TrustBar() {
  return (
    <section className="py-8 border-b border-gray-100">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex flex-wrap justify-center 
                        items-center gap-10">
          {["BMW", "KFC", "Skoda", "Danone", "Netflix"].map((name) => (
            <span
              key={name}
              className="text-lg font-bold text-gray-200"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}