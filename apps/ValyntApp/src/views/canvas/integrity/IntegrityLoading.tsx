export function IntegrityLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-16 bg-muted rounded-2xl" />
      <div className="h-20 bg-muted rounded-2xl" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-28 bg-muted rounded-2xl" />
      ))}
    </div>
  );
}
