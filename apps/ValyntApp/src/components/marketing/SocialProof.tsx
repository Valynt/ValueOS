import { Quote } from "lucide-react";

export function SocialProof() {
  return (
    <section
      className="py-24 border-t"
      style={{
        borderColor: "rgba(224, 224, 224, 0.05)",
        backgroundColor: "var(--mkt-bg-card)",
      }}
    >
      <div className="max-w-4xl mx-auto px-6 text-center">
        <Quote className="w-8 h-8 mx-auto mb-8" style={{ color: "var(--mkt-brand-primary)" }} />
        <blockquote className="text-xl md:text-2xl font-light text-white leading-relaxed mb-8">
          "Before VALYNT, our QBRs were opinions. Now, they are mathematical
          proofs of success. We've doubled our expansion revenue because the
          system hands us verified business cases automatically."
        </blockquote>
        <div className="flex flex-col items-center gap-1">
          <div className="font-semibold text-white">Sarah Chen</div>
          <div className="text-sm" style={{ color: "var(--mkt-text-muted)" }}>
            VP of Customer Success, TechScale
          </div>
        </div>
      </div>
    </section>
  );
}
