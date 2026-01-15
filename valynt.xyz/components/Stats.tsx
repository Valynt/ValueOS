export function Stats() {
  return (
    <section className="py-20 border-b" style={{ borderColor: 'rgba(224, 224, 224, 0.05)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-2">Hard Savings. Real Impact.</h2>
          <p className="text-sm" style={{ color: '#707070' }}>CFO-verified outcomes across 200+ enterprise deployments</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-white mb-2">20%</div>
            <div className="text-sm" style={{ color: '#707070' }}>CAC Reduction</div>
            <div className="text-xs mt-1 font-mono" style={{ color: '#18C3A5' }}>Avg. $2.4M saved</div>
          </div>

          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-white mb-2">30 Days</div>
            <div className="text-sm" style={{ color: '#707070' }}>Shorter Sales Cycles</div>
            <div className="text-xs mt-1 font-mono" style={{ color: '#18C3A5' }}>Velocity increase</div>
          </div>

          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-white mb-2">67%</div>
            <div className="text-sm" style={{ color: '#707070' }}>Churn Eliminated</div>
            <div className="text-xs mt-1 font-mono" style={{ color: '#18C3A5' }}>Net retention lift</div>
          </div>

          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-white mb-2">2.1×</div>
            <div className="text-sm" style={{ color: '#707070' }}>Expansion Revenue Growth</div>
            <div className="text-xs mt-1 font-mono" style={{ color: '#18C3A5' }}>Upsell velocity</div>
          </div>
        </div>
      </div>
    </section>
  );
}
