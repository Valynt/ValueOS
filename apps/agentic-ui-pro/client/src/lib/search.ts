// ============================================================
// AGENTIC UI PRO — Search Engine
// Keyword + tag-based search with filter support
// ============================================================

import type { Pattern, Workflow, SearchFilters, SearchResult } from '@/types';
import { patterns } from '@/data/patterns';
import { workflows } from '@/data/workflows';

function scorePattern(pattern: Pattern, query: string): number {
  if (!query.trim()) return 1;
  const q = query.toLowerCase();
  let score = 0;

  if (pattern.name.toLowerCase().includes(q)) score += 10;
  if (pattern.summary.toLowerCase().includes(q)) score += 5;
  if (pattern.tags.some(t => t.toLowerCase().includes(q))) score += 8;
  if (pattern.category.toLowerCase().includes(q)) score += 6;
  if (pattern.idealUseCases.some(u => u.toLowerCase().includes(q))) score += 4;
  if (pattern.agenticCapabilities.some(c => c.toLowerCase().includes(q))) score += 7;
  if (pattern.recommendedComponents.some(c => c.toLowerCase().includes(q))) score += 3;

  // Multi-word query: score each word
  const words = q.split(/\s+/).filter(w => w.length > 2);
  for (const word of words) {
    if (pattern.name.toLowerCase().includes(word)) score += 3;
    if (pattern.tags.some(t => t.toLowerCase().includes(word))) score += 2;
    if (pattern.summary.toLowerCase().includes(word)) score += 1;
  }

  return score;
}

function scoreWorkflow(workflow: Workflow, query: string): number {
  if (!query.trim()) return 1;
  const q = query.toLowerCase();
  let score = 0;

  if (workflow.name.toLowerCase().includes(q)) score += 10;
  if (workflow.summary.toLowerCase().includes(q)) score += 5;
  if (workflow.tags.some(t => t.toLowerCase().includes(q))) score += 8;
  if (workflow.category.toLowerCase().includes(q)) score += 6;
  if (workflow.agenticCapabilities.some(c => c.toLowerCase().includes(q))) score += 7;

  const words = q.split(/\s+/).filter(w => w.length > 2);
  for (const word of words) {
    if (workflow.name.toLowerCase().includes(word)) score += 3;
    if (workflow.tags.some(t => t.toLowerCase().includes(word))) score += 2;
    if (workflow.summary.toLowerCase().includes(word)) score += 1;
  }

  return score;
}

export function searchPatterns(filters: SearchFilters): Pattern[] {
  let results = patterns;

  // Category filter
  if (filters.categories.length > 0) {
    results = results.filter(p => filters.categories.includes(p.category));
  }

  // Persona filter
  if (filters.personas.length > 0) {
    results = results.filter(p => p.personaFit.some(persona => filters.personas.includes(persona)));
  }

  // Interaction mode filter
  if (filters.interactionModes.length > 0) {
    results = results.filter(p => filters.interactionModes.includes(p.interactionMode));
  }

  // Density filter
  if (filters.densities.length > 0) {
    results = results.filter(p => filters.densities.includes(p.dataDensity));
  }

  // Complexity filter
  if (filters.complexities.length > 0) {
    results = results.filter(p => filters.complexities.includes(p.complexity));
  }

  // Agentic capabilities filter
  if (filters.agenticCapabilities.length > 0) {
    results = results.filter(p =>
      filters.agenticCapabilities.some(cap => p.agenticCapabilities.includes(cap))
    );
  }

  // Keyword search + scoring
  if (filters.query.trim()) {
    results = results
      .map(p => ({ pattern: p, score: scorePattern(p, filters.query) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(r => r.pattern);
  }

  return results;
}

export function searchWorkflows(query: string): Workflow[] {
  if (!query.trim()) return workflows;

  return workflows
    .map(w => ({ workflow: w, score: scoreWorkflow(w, query) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(r => r.workflow);
}

export function search(filters: SearchFilters): SearchResult {
  const matchedPatterns = searchPatterns(filters);
  const matchedWorkflows = searchWorkflows(filters.query);

  return {
    patterns: matchedPatterns,
    workflows: matchedWorkflows,
    totalCount: matchedPatterns.length + matchedWorkflows.length,
  };
}

export function getPatternById(id: string): Pattern | undefined {
  return patterns.find(p => p.id === id);
}

export function getWorkflowById(id: string): Workflow | undefined {
  return workflows.find(w => w.id === id);
}

export function getRelatedPatterns(pattern: Pattern, limit = 4): Pattern[] {
  return patterns
    .filter(p => p.id !== pattern.id)
    .map(p => {
      let score = 0;
      if (p.category === pattern.category) score += 5;
      const sharedTags = p.tags.filter(t => pattern.tags.includes(t));
      score += sharedTags.length * 2;
      const sharedPersonas = p.personaFit.filter(persona => pattern.personaFit.includes(persona));
      score += sharedPersonas.length;
      const sharedCaps = p.agenticCapabilities.filter(c => pattern.agenticCapabilities.includes(c));
      score += sharedCaps.length * 2;
      return { pattern: p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.pattern);
}
