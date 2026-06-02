import { Link } from "react-router-dom";
import { siteConfig } from "../config/site";

export default function Navbar() {
  return (
    <header
      className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="container-shell flex h-16 items-center justify-between">
        <Link to="/" className="text-xl font-semibold tracking-tight">
          {siteConfig.brand}
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-sm text-[color:var(--muted)] transition hover:text-[color:var(--text)]"
          >
            Features
          </a>
          <a
            href="#why-us"
            className="text-sm text-[color:var(--muted)] transition hover:text-[color:var(--text)]"
          >
            Why Us
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-secondary">
            Login
          </Link>
          <Link to="/register" className="btn-primary">
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}