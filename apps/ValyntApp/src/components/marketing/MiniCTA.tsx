interface MiniCTAProps {
  text: string;
}

export function MiniCTA({ text }: MiniCTAProps) {
  return (
    <div className="flex justify-center py-12">
      <button
        className="h-12 px-8 rounded-full text-base font-semibold transition-all"
        style={{
          backgroundColor: "var(--mkt-brand-primary)",
          color: "var(--mkt-bg-dark)",
          boxShadow: "0 0 20px var(--mkt-border-brand)",
        }}
      >
        {text}
      </button>
    </div>
  );
}
