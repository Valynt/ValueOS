import React, { useMemo } from 'react';
import { ErrorBoundary } from '../components/Common/ErrorBoundary';
import { UnknownComponentFallback, SectionErrorFallback } from '../components/SDUI';
import { SDUIComponentSection, SDUIPageDefinition, validateSDUISchema } from './schema';
import { RegistryPlaceholderComponent, resolveComponent } from './registry';

interface SDUIRendererProps {
  schema: unknown;
  debugOverlay?: boolean;
  onValidationError?: (errors: string[]) => void;
  onHydrationWarning?: (warnings: string[]) => void;
}

interface HydrationTraceProps {
  section: SDUIComponentSection;
  status: 'rendered' | 'placeholder' | 'error';
  warning?: string;
}

const HydrationTrace: React.FC<HydrationTraceProps> = ({ section, status, warning }) => {
  const tone = status === 'rendered' ? 'text-emerald-700 bg-emerald-50' : status === 'error' ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50';
  return (
    <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${tone}`}>
      <div className="flex items-center justify-between">
        <p className="font-semibold">{section.component}</p>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] uppercase tracking-wide">v{section.version}</span>
      </div>
      <p className="text-[11px] text-current/80">Status: {status}</p>
      {warning && <p className="text-[11px] text-current/80">{warning}</p>}
    </div>
  );
};

const InvalidSchemaFallback: React.FC<{ errors: string[] }> = ({ errors }) => (
  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900" role="alert" data-testid="invalid-schema">
    <p className="text-sm font-semibold mb-2">SDUI schema failed validation</p>
    <ul className="list-disc pl-5 space-y-1 text-sm">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  </div>
);

const renderSection = (section: SDUIComponentSection, index: number, debugOverlay?: boolean) => {
  const entry = resolveComponent(section);
  if (!entry) {
    return (
      <div key={`${section.component}-${index}`}>
        <RegistryPlaceholderComponent componentName={section.component} />
        {debugOverlay && (
          <HydrationTrace
            section={section}
            status="placeholder"
            warning="Component not found in registry"
          />
        )}
      </div>
    );
  }

  const Component = entry.component;

  return (
    <div key={`${section.component}-${index}`} className="space-y-2">
      <ErrorBoundary fallback={<SectionErrorFallback componentName={section.component} />}>
        <Component {...section.props} />
      </ErrorBoundary>
      {debugOverlay && <HydrationTrace section={section} status="rendered" warning={entry.description} />}
    </div>
  );
};

export const SDUIRenderer: React.FC<SDUIRendererProps> = ({
  schema,
  debugOverlay = false,
  onValidationError,
  onHydrationWarning,
}) => {
  const validation = useMemo(() => validateSDUISchema(schema), [schema]);

  if (!validation.success) {
    onValidationError?.(validation.errors);
    return <InvalidSchemaFallback errors={validation.errors} />;
  }

  if (validation.warnings.length) {
    onHydrationWarning?.(validation.warnings);
  }

  const page: SDUIPageDefinition = validation.page;

  return (
    <div className="space-y-4" data-testid="sdui-renderer">
      {page.sections.map((section, index) => renderSection(section, index, debugOverlay || page.metadata?.debug))}
    </div>
  );
};
