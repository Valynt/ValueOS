export function SkipNav() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-6 focus:py-3 focus:bg-white focus:text-black focus:rounded-lg focus:font-semibold focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-400"
    >
      Skip to main content
    </a>
  );
}
