export function TemplatesPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
        <span className="text-blue-600 text-xl">📋</span>
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">
        Templates Library
      </h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Reusable value case templates are coming soon. This surface will allow
        you to create, share, and apply templates across your organisation.
      </p>
    </div>
  );
}
