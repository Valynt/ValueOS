interface MiniCTAProps {
  text: string;
}

export function MiniCTA({ text }: MiniCTAProps) {
  return (
    <div className="flex justify-center py-12">
      <button className="h-12 px-8 rounded-full text-base font-semibold transition-all" style={{
        backgroundColor: '#18C3A5',
        color: '#0B0C0F',
        boxShadow: '0 0 20px rgba(24, 195, 165, 0.3)'
      }}>
        {text}
      </button>
    </div>
  );
}
