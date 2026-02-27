import { Outlet } from "react-router-dom";
import {
  Analytics,
  Footer,
  Navigation,
  ScrollToTop,
  SEO,
  SkipNav,
} from "@/components/marketing";

export function MarketingLayout() {
  return (
    <>
      <SEO />
      <SkipNav />
      <ScrollToTop />
      <Analytics />
      <div className="fixed inset-0 z-0 bg-grid pointer-events-none" aria-hidden="true"></div>
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-transparent via-transparent to-[var(--bg-dark)] pointer-events-none" aria-hidden="true"></div>

      <Navigation />
      <main id="main-content" className="relative z-10" style={{ backgroundColor: 'var(--bg-dark)' }}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
