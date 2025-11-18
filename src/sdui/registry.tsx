import React from 'react';
import {
  DiscoveryCard,
  ExpansionBlock,
  InfoBanner,
  SectionErrorFallback,
  UnknownComponentFallback,
  ValueTreeCard,
} from '../components/SDUI';
import { SDUIComponentSection } from './schema';

export interface RegistryEntry {
  component: React.ComponentType<any>;
  versions: number[];
  requiredProps?: string[];
  description?: string;
}

const baseRegistry: Record<string, RegistryEntry> = {
  InfoBanner: {
    component: InfoBanner,
    versions: [1, 2],
    requiredProps: ['title'],
    description: 'High-level lifecycle banner for SDUI templates.',
  },
  DiscoveryCard: {
    component: DiscoveryCard,
    versions: [1, 2],
    requiredProps: ['questions'],
    description: 'Discovery prompts for opportunity framing.',
  },
  ValueTreeCard: {
    component: ValueTreeCard,
    versions: [1, 2],
    requiredProps: ['title', 'nodes'],
    description: 'Nested value drivers for target outcomes.',
  },
  ExpansionBlock: {
    component: ExpansionBlock,
    versions: [1, 2],
    requiredProps: ['gaps', 'roi'],
    description: 'ROI snapshot for expansion stage.',
  },
};

const registry = new Map<string, RegistryEntry>(Object.entries(baseRegistry));

export const RegistryPlaceholderComponent = UnknownComponentFallback;

export function listRegisteredComponents(): RegistryEntry[] {
  return Array.from(registry.values());
}

export function getRegistryEntry(name: string): RegistryEntry | undefined {
  return registry.get(name);
}

export function registerComponent(name: string, entry: RegistryEntry): void {
  registry.set(name, entry);
}

export function resetRegistry(): void {
  registry.clear();
  Object.entries(baseRegistry).forEach(([name, entry]) => registry.set(name, entry));
}

export function hotSwapComponent(name: string, component: React.ComponentType<any>): RegistryEntry | undefined {
  const current = registry.get(name);
  if (!current) return undefined;
  const updated: RegistryEntry = { ...current, component };
  registry.set(name, updated);
  return updated;
}

export function resolveComponent(section: SDUIComponentSection): RegistryEntry | undefined {
  const entry = registry.get(section.component);
  if (!entry) return undefined;
  if (!entry.versions.includes(section.version)) {
    return { ...entry, description: `${entry.description ?? ''} (coerced version)` };
  }
  return entry;
}

export const SectionErrorWrapper: React.FC<{ componentName: string; children: React.ReactNode }> = ({
  componentName,
  children,
}) => (
  <SectionErrorFallback componentName={componentName}>
    {children}
  </SectionErrorFallback>
);
