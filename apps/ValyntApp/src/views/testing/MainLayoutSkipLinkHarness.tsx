export function MainLayoutSkipLinkHarness() {
  return (
    <div className="min-h-full bg-background px-6 py-8 text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <p className="text-sm font-medium text-muted-foreground">Accessibility harness</p>
        <h1 className="text-3xl font-semibold tracking-tight">Main layout skip link</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          This route exists so automated accessibility tests can verify keyboard users can skip directly to the main
          application region.
        </p>
        <button
          type="button"
          className="inline-flex w-fit items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Harness action
        </button>
      </div>
    </div>
  );
}
