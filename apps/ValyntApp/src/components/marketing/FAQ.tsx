export function FAQ() {
  return (
    <section className="py-24 max-w-5xl mx-auto px-6">
      <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-16 text-center">
        Common Questions
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
        <div>
          <h4 className="text-lg font-medium text-white mb-2">
            AI hallucinates. Can I trust these numbers?
          </h4>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Trust is our core product. We employ a specialized whose sole job is
            to audit other agents. It enforces "Manifesto Compliance," ensuring
            every metric is traceable, evidence-based, and conservative.
          </p>
        </div>
        <div>
          <h4 className="text-lg font-medium text-white mb-2">
            Is my customer data safe?
          </h4>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Absolutely. ValueCanvas is built on a multi-tenant architecture with
            strict and enterprise-grade secrets management. Your data is
            isolated, encrypted, and governed by strict compliance.
          </p>
        </div>
        <div>
          <h4 className="text-lg font-medium text-white mb-2">
            Will this replace my team?
          </h4>
          <p className="text-sm text-zinc-400 leading-relaxed">
            No. It creates a . By automating the research and modeling grunt
            work, your team focuses on strategic relationships. We don't replace
            the strategist; we replace the spreadsheet drudgery.
          </p>
        </div>
        <div>
          <div className="glass-card p-6 rounded-xl">
            <h4 className="text-white font-medium mb-1">
              Have more questions?
            </h4>
            <p className="text-sm text-zinc-400 mb-4">
              Our solution engineers are ready to walk you through the
              architecture.
            </p>
            <a
              href="#"
              className="text-sm text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
            >
              Contact Sales
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
