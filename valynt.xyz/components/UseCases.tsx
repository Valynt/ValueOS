import { CheckCircle } from 'lucide-react';

export function UseCases() {
  return (
    <section id="use-cases" className="py-24 max-w-7xl mx-auto px-6">
      <div className="mb-16">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">Value Intelligence in Action</h2>
        <p className="max-w-xl text-sm md:text-base" style={{ color: '#707070' }}>
          Real scenarios where VALYNT autonomous agents orchestrate outcomes across the value lifecycle.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="group glass-card p-6 rounded-xl border border-transparent hover:border-white/10 transition-all">
          <div className="h-px w-full bg-gradient-to-r from-white/20 to-transparent mb-6"></div>
          <h3 className="text-lg font-semibold text-white mb-1">Scenario A</h3>
          <p className="text-xs font-mono mb-4" style={{ color: '#707070' }}>The "Perfect" Discovery Call</p>

          <div className="flex items-center gap-3 mb-6">
            <div className="px-2 py-1 rounded text-xs font-medium" style={{
              backgroundColor: 'rgba(24, 195, 165, 0.15)',
              color: '#18C3A5'
            }}>Opportunity Agent</div>
          </div>

          <ul className="space-y-4 mb-8">
            <li className="flex gap-3 items-start">
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#18C3A5' }} />
              <p className="text-sm" style={{ color: '#707070' }}>Instantly analyzes unstructured notes and transcripts.</p>
            </li>
            <li className="flex gap-3 items-start">
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#18C3A5' }} />
              <p className="text-sm" style={{ color: '#707070' }}>Generates "Persona Fit" reports before you hang up.</p>
            </li>
          </ul>
        </div>

        <div className="group glass-card p-6 rounded-xl border border-transparent hover:border-white/10 transition-all">
          <div className="h-px w-full bg-gradient-to-r from-white/20 to-transparent mb-6"></div>
          <h3 className="text-lg font-semibold text-white mb-1">Scenario B</h3>
          <p className="text-xs font-mono mb-4" style={{ color: '#707070' }}>The "CFO-Proof" Business Case</p>

          <div className="flex items-center gap-3 mb-6">
            <div className="px-2 py-1 rounded text-xs font-medium" style={{
              backgroundColor: 'rgba(0, 174, 239, 0.15)',
              color: '#00AEEF'
            }}>Integrity Agent</div>
          </div>

          <ul className="space-y-4 mb-8">
            <li className="flex gap-3 items-start">
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#00AEEF' }} />
              <p className="text-sm" style={{ color: '#707070' }}>Audits every ROI calculation against manifesto rules.</p>
            </li>
            <li className="flex gap-3 items-start">
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#00AEEF' }} />
              <p className="text-sm" style={{ color: '#707070' }}>Flags hype and enforces conservative estimates.</p>
            </li>
          </ul>
        </div>

        <div className="group glass-card p-6 rounded-xl border border-transparent hover:border-white/10 transition-all">
          <div className="h-px w-full bg-gradient-to-r from-white/20 to-transparent mb-6"></div>
          <h3 className="text-lg font-semibold text-white mb-1">Scenario C</h3>
          <p className="text-xs font-mono mb-4" style={{ color: '#707070' }}>The "Auto-Pilot" Expansion</p>

          <div className="flex items-center gap-3 mb-6">
            <div className="px-2 py-1 rounded text-xs font-medium" style={{
              backgroundColor: 'rgba(24, 195, 165, 0.15)',
              color: '#18C3A5'
            }}>Expansion Agent</div>
          </div>

          <ul className="space-y-4 mb-8">
            <li className="flex gap-3 items-start">
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#18C3A5' }} />
              <p className="text-sm" style={{ color: '#707070' }}>Monitors realization data against benchmarks.</p>
            </li>
            <li className="flex gap-3 items-start">
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#18C3A5' }} />
              <p className="text-sm" style={{ color: '#707070' }}>Drafts sales-ready upsell cases automatically.</p>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
