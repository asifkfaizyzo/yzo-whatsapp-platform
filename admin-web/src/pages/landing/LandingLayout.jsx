import { Outlet } from "react-router-dom";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { siteConfig } from "../../config/site";




function FacebookIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 
        5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43
        c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953
        H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796
        v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 
        1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 
        3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058
        -1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771
        -1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013
        -3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 
        1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272
        .273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 
        4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 
        0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073
        -1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78
        -6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 
        12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406
        -11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 
        12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186
        C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136
        c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 
        002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 
        15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852
        -3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h
        .046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455
        v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 
        112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771
        C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 
        24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const socialItems = [                                     // ← ADD LINE 2 (array)
  { key: "facebook",  label: "Facebook",  Icon: FacebookIcon,  hoverClass: "hover:bg-blue-600 hover:text-white" },
  { key: "instagram", label: "Instagram", Icon: InstagramIcon, hoverClass: "hover:bg-pink-600 hover:text-white" },
  { key: "youtube",   label: "YouTube",   Icon: YoutubeIcon,   hoverClass: "hover:bg-red-600 hover:text-white"  },
  { key: "linkedin",  label: "LinkedIn",  Icon: LinkedinIcon,  hoverClass: "hover:bg-blue-500 hover:text-white" },
];



/* ==========================================
   NAVBAR
   ========================================== */
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
  {socialItems.map(({ key, label, Icon, hoverClass }) => {
    const url = siteConfig.social[key];
    return (
      <a
        key={key}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Follow SudoReply on ${label}`}
        title={label}
        className={`
          w-8 h-8 bg-gray-800 rounded-lg
          flex items-center justify-center
          text-gray-400
          transition-all duration-300
          hover:scale-110
          ${hoverClass}
        `}
      >
        <Icon />
      </a>
    );
  })}
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