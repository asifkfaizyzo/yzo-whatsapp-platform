import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">

          {/* Column 1 — Brand */}
          <div className="col-span-2 md:col-span-1">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-green-600 rounded-lg 
                              flex items-center justify-center">
                <span className="text-white font-bold text-sm">s</span>
              </div>
              <span className="text-lg font-bold text-white">
                sudoreply
                {/* <span className="text-green-500">.io</span> */}
              </span>
            </Link>

            <p className="text-sm leading-relaxed mb-4">
              The #1 WhatsApp Business API platform
              to engage customers at scale.
            </p>

            {/* Social Icons */}
            <div className="flex gap-3">
              {["𝕏", "in", "f", "▶"].map((icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 bg-gray-800 rounded-lg 
                             flex items-center justify-center 
                             text-xs text-gray-400 
                             hover:bg-green-600 hover:text-white 
                             transition-all duration-300"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Column 2 — Product */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">
              Product
            </h4>
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
                    className="text-sm hover:text-white 
                               transition-colors duration-200"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Company */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">
              Company
            </h4>
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
                    className="text-sm hover:text-white 
                               transition-colors duration-200"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>


          {/* Column 4 — Support */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">
              Support
            </h4>
            <ul className="space-y-3">
              <li>
                <Link to="/help" className="text-sm hover:text-white transition">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-sm hover:text-white transition">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-sm hover:text-white transition">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/status" className="text-sm hover:text-white transition">
                  Status
                </Link>
              </li>
            </ul>
          </div>

        </div>
      </div>


      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-5 
                  flex flex-col md:flex-row 
                  justify-between items-center gap-4">

          <p className="text-xs">
            © 2026 sudoreply All rights reserved.
          </p>

          <div className="flex gap-6">
            <Link to="/privacy" className="text-xs hover:text-white transition">
              Privacy
            </Link>
            <Link to="/terms" className="text-xs hover:text-white transition">
              Terms
            </Link>
            <Link to="/privacy" className="text-xs hover:text-white transition">
              Cookies
            </Link>
          </div>

        </div>
      </div>

    </footer>
  );
}