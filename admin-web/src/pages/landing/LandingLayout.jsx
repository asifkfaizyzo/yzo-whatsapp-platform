import { Outlet } from "react-router-dom";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Features", path: "/features" },
    { name: "Pricing", path: "/pricing" },
    { name: "Testimonials", path: "/testimonials" },
    { name: "Contact", path: "/contact" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md 
                        border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="/sudo_bg.png" 
              alt="SudoReply Logo" 
              className="h-9 w-auto rounded-lg"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`px-4 py-2 rounded-lg text-sm font-medium 
                           transition-all duration-200
                           ${isActive(item.path)
                             ? "text-[#125EF2] bg-[#EAF2FE]"
                             : "text-gray-600 hover:text-[#125EF2] hover:bg-[#EAF2FE]"
                           }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Desktop Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-gray-600 
                         hover:text-[#125EF2] transition px-4 py-2"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="text-sm font-medium text-white bg-[#125EF2] 
                         px-5 py-2.5 rounded-lg hover:bg-[#0F4FCC] 
                         transition-all duration-200 shadow-sm 
                         hover:shadow-md hover:shadow-[#125EF2]/20"
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg 
                       hover:bg-gray-100 transition"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? (
              <svg className="w-6 h-6 text-gray-600" fill="none" 
                   stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" 
                      strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-gray-600" fill="none" 
                   stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden pb-4 border-t border-gray-100 mt-2">
            <nav className="flex flex-col gap-1 pt-3">
              {navLinks.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`px-4 py-2.5 rounded-lg text-sm 
                             font-medium transition
                             ${isActive(item.path)
                               ? "text-[#125EF2] bg-[#EAF2FE]"
                               : "text-gray-600 hover:bg-gray-50"
                             }`}
                >
                  {item.name}
                </Link>
              ))}

              <div className="flex flex-col gap-2 mt-3 pt-3 
                              border-t border-gray-100">
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="text-sm font-medium text-gray-600 
                             px-4 py-2.5 rounded-lg 
                             hover:bg-gray-50"
                >
                  Log in
                </Link>
                <Link
                  to="/auth/signup"
                  onClick={() => setIsOpen(false)}
                  className="text-sm font-medium text-white 
                             bg-[#125EF2] px-4 py-2.5 
                             rounded-lg text-center 
                             hover:bg-[#0F4FCC]"
                >
                  Get Started Free
                </Link>
              </div>
            </nav>
          </div>
        )}

      </div>
    </header>
  );
}

/* ==========================================
   FOOTER
   ========================================== */
function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">

          {/* Column 1 — Brand */}
          <div className="col-span-2 md:col-span-1">
          <Link to="/" className="mb-4 inline-flex items-center gap-3">
              <img
                src="/sudo_bg.png"
                alt="SudoReply Logo"
                className="h-20 w-20 object-contain shrink-0"
              />
              
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

/* ==========================================
   LAYOUT — Wraps all landing pages
   ========================================== */
export default function LandingLayout() {
  return (
    <div>
      <Navbar />
      <Outlet />
      <Footer />
    </div>
  );
}