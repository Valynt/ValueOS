export function CTA() {
  return (
    <section className="py-32 border-t relative overflow-hidden" style={{
      borderColor: 'rgba(224, 224, 224, 0.05)',
      background: 'linear-gradient(to bottom, #0A0A0A, #1E1E1E)'
    }}>
      <div className="absolute inset-0 bg-grid-small opacity-30 pointer-events-none"></div>
      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tighter text-white mb-6">Run your business on value.</h2>
        <p className="text-lg mb-4 leading-relaxed" style={{ color: '#707070' }}>
          Every company runs on value. Now you can measure it, model it, and prove it continuously. Transform your organization with the first Value Operating System.
        </p>
        <p className="text-base mb-10 font-medium" style={{ color: '#18C3A5' }}>
          Join 200+ enterprises saving $2.4M annually in CAC while cutting sales cycles by 30 days.
        </p>
        <div className="flex justify-center">
          <button className="h-12 px-8 rounded-full text-base font-semibold transition-all" style={{
            backgroundColor: '#18C3A5',
            color: '#0B0C0F',
            boxShadow: '0 0 20px rgba(24, 195, 165, 0.3)'
          }}>
            Book Your VALYNT Demo
          </button>
        </div>
      </div>
    </section>
  );
}
