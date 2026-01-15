import { Link } from "react-router-dom";
import { Logo } from "./Logo";

export function Navigation() {
  return (
    <nav
      className="fixed top-0 w-full z-50 border-b backdrop-blur-md"
      role="navigation"
      aria-label="Main navigation"
      style={{
        borderColor: "rgba(224, 224, 224, 0.05)",
        backgroundColor: "rgba(10, 10, 10, 0.5)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 group"
          aria-label="VALYNT home"
        >
          <Logo gradientId="logo_grad_nav" />
          <span className="text-xl font-brand font-bold tracking-tight text-white group-hover:opacity-90 transition-opacity">
            VALYNT
          </span>
        </Link>

        <ul
          className="hidden md:flex items-center gap-8 text-xs font-medium"
          style={{ color: "#707070" }}
        >
          <li>
            <a href="#problem" className="hover:text-white transition-colors">
              The Problem
            </a>
          </li>
          <li>
            <a href="#solution" className="hover:text-white transition-colors">
              The VOS
            </a>
          </li>
          <li>
            <a
              href="#how-it-works"
              className="hover:text-white transition-colors"
            >
              How It Works
            </a>
          </li>
          <li>
            <a href="#use-cases" className="hover:text-white transition-colors">
              Agents
            </a>
          </li>
          <li>
            <Link to="/blog" className="hover:text-white transition-colors">
              Blog
            </Link>
          </li>
        </ul>

        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="text-xs font-medium hover:text-white transition-colors hidden sm:block"
            style={{ color: "#E0E0E0" }}
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="group relative px-4 py-2 text-xs font-semibold rounded-full overflow-hidden transition-all"
            aria-label="Deploy Value Operating System"
            style={{
              backgroundColor: "#18C3A5",
              color: "#0B0C0F",
            }}
          >
            <span className="relative z-10">Deploy VOS</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
