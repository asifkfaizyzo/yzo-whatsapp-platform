import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      {/* Main Footer */}
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          {/* Column 1 — Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="mb-4 inline-flex items-center gap-3">
              <img
                src="/sudo_bg.png"
                alt="SudoReply Logo"
                className="h-20 w-20 object-contain shrink-0"
              />
              
            </Link>

            <p className="mb-4 max-w-xs text-sm leading-relaxed">
              The #1 WhatsApp Business API platform to engage customers at scale.
            </p>

            {/* Social Icons */}
            <div className="flex gap-3">
              {["𝕏", "in", "f", "▶"].map((icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-xs text-gray-400 transition-all duration-300 hover:bg-[#125EF2] hover:text-white"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Column 2 — Product */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">Product</h4>
            <ul className="space-y-3">
              {[
                { name: "Features", path: "/features" },
                { name: "Pricing", path: "/pricing" },
                { name: "Integrations", path: "/features" },
                { name: "API Docs", path: "#" },
              ].map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    className="text-sm transition-colors duration-200 hover:text-white"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Company */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">Company</h4>
            <ul className="space-y-3">
              {[
                { name: "About Us", path: "#" },
                { name: "Blog", path: "#" },
                { name: "Careers", path: "#" },
                { name: "Contact", path: "/contact" },
              ].map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    className="text-sm transition-colors duration-200 hover:text-white"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 — Support */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-white">Support</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/help" className="text-sm transition hover:text-white">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-sm transition hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-sm transition hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/status" className="text-sm transition hover:text-white">
                  Status
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-5 md:flex-row">
          <p className="text-xs">© 2026 sudoreply All rights reserved.</p>

          <div className="flex gap-6">
            <Link to="/privacy" className="text-xs transition hover:text-white">
              Privacy
            </Link>
            <Link to="/terms" className="text-xs transition hover:text-white">
              Terms
            </Link>
            <Link to="/privacy" className="text-xs transition hover:text-white">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}