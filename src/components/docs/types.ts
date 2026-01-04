/**
 * TypeScript types for Documentation Portal
 */

export type UserRole = 'business' | 'executive' | 'admin' | 'member' | 'developer' | 'viewer';

export type DocCategory = 'overview' | 'user-guide' | 'developer-guide' | 'api-reference';

export interface DocSection {
  id: string;
  title: string;
  path: string;
  category: DocCategory;
  version: string;
  lastUpdated: string;
  content?: string;
  mappings?: DocMapping[];
  metadata?: DocMetadata;
  // UI-specific fields
  icon?: string;
  description?: string;
  audience?: UserRole[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime?: string;
}

export interface DocMapping {
  type: 'file' | 'directory' | 'function' | 'class' | 'component';
  path: string;
  description?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface DocMetadata {
  author?: string;
  reviewers?: string[];
  tags?: string[];
  relatedSections?: string[];
}

export interface SearchResult {
  section: DocSection;
  matches: SearchMatch[];
  score: number;
}

export interface SearchMatch {
  text: string;
  context: string;
  lineNumber?: number;
}

export interface DocHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  sections: number;
  mappings: number;
  outdated: number;
  coverage: string;
  lastSync?: string;
  issues?: HealthIssue[];
}

export interface HealthIssue {
  type: 'missing-mapping' | 'outdated-doc' | 'broken-link' | 'orphaned-section';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedItems: string[];
}

export interface TableOfContents {
  items: TocItem[];
}

export interface TocItem {
  id: string;
  title: string;
  level: number;
  children?: TocItem[];
}

export interface Breadcrumb {
  label: string;
  path?: string;
  sectionId?: string;
}

export interface RelatedDoc {
  id: string;
  title: string;
  description: string;
  category: DocCategory;
}
