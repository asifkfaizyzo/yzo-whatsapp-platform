// src/components/landing/layout/Navbar.jsx

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
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
              to="/auth/login"
              className="text-sm font-medium text-gray-600 
                         hover:text-[#125EF2] transition px-4 py-2"
            >
              Log in
            </Link>
            <Link
              to="/auth/register"
              className="text-sm font-medium text-white bg-[#125EF2] 
                         px-5 py-2.5 rounded-lg hover:bg-[#0F4FCC] 
                         transition-all duration-200 shadow-sm 
                         hover:shadow-md hover:shadow-green-200"
            >
              Get Started Free
            </Link>
          </div>

                 {/* ===== Mobile Menu Button ===== */}
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
                  to="/auth/login"
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