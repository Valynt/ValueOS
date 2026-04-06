/**
 * ContextNormalizationPipeline — Unit Tests (Sprint 6)
 */
import { describe, it, expect } from 'vitest';
import {
  ContextNormalizationPipeline,
  createContextPipeline,
  NormalizedContextSchema,
} from '../ContextNormalizationPipeline.js';
import type { ExtractedInsights, ParsedDocument } from '../../domain-packs/DocumentParserService.js';
import type { WebScraperResult } from '../../post-v1/WebScraperService.js';
import type { MappedValueCase } from '../../core/CRMFieldMapper.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const CASE_ID = '00000000-0000-0000-0000-000000000002';

const mockDocument: ParsedDocument = {
  text: 'Acme Corp is struggling with manual reporting. They want to reduce costs.',
  metadata: { fileName: 'discovery-notes.txt', fileType: 'text/plain', wordCount: 12 },
};

const mockInsights: ExtractedInsights = {
  companyName: 'Acme Corp',
  industry: 'Manufacturing',
  painPoints: ['Manual reporting', 'High operational costs'],
  stakeholders: [
    { name: 'Jane Smith', role: 'CFO', sentiment: 'positive' },
    { name: 'Bob Jones', role: 'IT Director' },
  ],
  opportunities: ['Automate reporting', 'Reduce headcount costs'],
  nextSteps: ['Schedule demo', 'Send ROI model'],
  dealSize: '$500k',
  timeline: '2026-Q3',
  competitors: ['Competitor A'],
  summary: 'Acme Corp needs automation to reduce costs.',
};

const mockWebScrape: WebScraperResult = {
  url: 'https://acmecorp.com/about',
  title: 'Acme Corp — About Us',
  description: 'Leading manufacturer of widgets.',
  content: 'Acme Corp was founded in 1990 and employs 2,000 people.',
  relevanceScore: 0.85,
};

const mockCRMDeal: MappedValueCase = {
  name: 'Acme Corp — Enterprise Deal',
  company: 'Acme Corp',
  stage: 'target',
  status: 'in-progress',
  metadata: {
    crmProvider: 'salesforce',
    crmDealId: 'SF-001',
    dealValue: 500000,
    dealCurrency: 'USD',
    closeDate: '2026-09-30',
    stakeholders: [
      { name: 'Jane Smith', email: 'jane@acme.com', title: 'Chief Financial Officer', isPrimary: true },
    ],
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContextNormalizationPipeline', () => {
  describe('basic construction', () => {
    it('creates a pipeline with required organizationId', () => {
      const pipeline = new ContextNormalizationPipeline({ organizationId: ORG_ID });
      const ctx = pipeline.build();
      expect(ctx.organizationId).toBe(ORG_ID);
    });

    it('creates a pipeline with optional valueCaseId', () => {
      const pipeline = new ContextNormalizationPipeline({ organizationId: ORG_ID, valueCaseId: CASE_ID });
      const ctx = pipeline.build();
      expect(ctx.valueCaseId).toBe(CASE_ID);
    });

    it('produces an empty context with no sources', () => {
      const ctx = new ContextNormalizationPipeline({ organizationId: ORG_ID }).build();
      expect(ctx.painPoints).toHaveLength(0);
      expect(ctx.stakeholders).toHaveLength(0);
      expect(ctx.sources).toHaveLength(0);
    });
  });

  describe('addDocument', () => {
    it('ingests pain points, opportunities, and next steps', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addDocument(mockDocument, mockInsights, 'discovery-notes.txt')
        .build();

      expect(ctx.painPoints).toContain('Manual reporting');
      expect(ctx.opportunities).toContain('Automate reporting');
      expect(ctx.nextSteps).toContain('Schedule demo');
    });

    it('ingests company name and industry', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addDocument(mockDocument, mockInsights, 'discovery-notes.txt')
        .build();

      expect(ctx.companyName).toBe('Acme Corp');
      expect(ctx.industry).toBe('Manufacturing');
    });

    it('ingests stakeholders with sentiment', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addDocument(mockDocument, mockInsights, 'discovery-notes.txt')
        .build();

      const jane = ctx.stakeholders.find((s) => s.name === 'Jane Smith');
      expect(jane).toBeDefined();
      expect(jane?.sentiment).toBe('positive');
      expect(jane?.source).toBe('document');
    });

    it('records the document as a source', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addDocument(mockDocument, mockInsights, 'discovery-notes.txt')
        .build();

      expect(ctx.sources).toHaveLength(1);
      expect(ctx.sources[0].type).toBe('document');
      expect(ctx.sources[0].identifier).toBe('discovery-notes.txt');
    });

    it('stores raw content from the document', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addDocument(mockDocument, mockInsights, 'notes.txt')
        .build();

      expect(ctx.rawContent).toContain('Acme Corp is struggling');
    });

    it('deduplicates pain points across multiple documents', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addDocument(mockDocument, mockInsights, 'doc1.txt')
        .addDocument(mockDocument, mockInsights, 'doc2.txt')
        .build();

      const unique = new Set(ctx.painPoints);
      expect(ctx.painPoints.length).toBe(unique.size);
    });
  });

  describe('addWebScrape', () => {
    it('ingests title and description into summary', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addWebScrape(mockWebScrape, 'https://acmecorp.com/about')
        .build();

      expect(ctx.summary).toContain('Acme Corp — About Us');
    });

    it('stores raw web content', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addWebScrape(mockWebScrape, 'https://acmecorp.com/about')
        .build();

      expect(ctx.rawContent).toContain('founded in 1990');
    });

    it('records the URL as a source', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addWebScrape(mockWebScrape, 'https://acmecorp.com/about')
        .build();

      expect(ctx.sources[0].type).toBe('web');
      expect(ctx.sources[0].identifier).toBe('https://acmecorp.com/about');
    });
  });

  describe('addCRMRecord', () => {
    it('ingests company name and deal metadata', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addCRMRecord(mockCRMDeal)
        .build();

      expect(ctx.companyName).toBe('Acme Corp');
      expect(ctx.dealSize).toBe('500000');
      expect(ctx.timeline).toBe('2026-09-30');
    });

    it('ingests CRM stakeholders', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addCRMRecord(mockCRMDeal)
        .build();

      const jane = ctx.stakeholders.find((s) => s.name === 'Jane Smith');
      expect(jane).toBeDefined();
      expect(jane?.email).toBe('jane@acme.com');
      expect(jane?.isPrimary).toBe(true);
      expect(jane?.source).toBe('crm');
    });

    it('records the CRM deal ID as a source', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addCRMRecord(mockCRMDeal)
        .build();

      expect(ctx.sources[0].type).toBe('crm');
      expect(ctx.sources[0].identifier).toBe('SF-001');
    });
  });

  describe('multi-source merging', () => {
    it('merges stakeholders from document and CRM, enriching with CRM email', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addDocument(mockDocument, mockInsights, 'notes.txt')
        .addCRMRecord(mockCRMDeal)
        .build();

      const jane = ctx.stakeholders.find((s) => s.name === 'Jane Smith');
      expect(jane).toBeDefined();
      // Email comes from CRM (enrichment)
      expect(jane?.email).toBe('jane@acme.com');
      // Sentiment comes from document
      expect(jane?.sentiment).toBe('positive');
    });

    it('does not duplicate stakeholders with the same name', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addDocument(mockDocument, mockInsights, 'notes.txt')
        .addCRMRecord(mockCRMDeal)
        .build();

      const janes = ctx.stakeholders.filter((s) => s.name === 'Jane Smith');
      expect(janes).toHaveLength(1);
    });

    it('first-write wins for company name (document before CRM)', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addDocument(mockDocument, mockInsights, 'notes.txt')
        .addCRMRecord({ ...mockCRMDeal, company: 'ACME CORPORATION' })
        .build();

      // Document was added first, so its company name wins
      expect(ctx.companyName).toBe('Acme Corp');
    });

    it('records all sources', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID })
        .addDocument(mockDocument, mockInsights, 'notes.txt')
        .addWebScrape(mockWebScrape, 'https://acmecorp.com')
        .addCRMRecord(mockCRMDeal)
        .build();

      expect(ctx.sources).toHaveLength(3);
      const types = ctx.sources.map((s) => s.type);
      expect(types).toContain('document');
      expect(types).toContain('web');
      expect(types).toContain('crm');
    });
  });

  describe('schema validation', () => {
    it('produces a context that passes NormalizedContextSchema validation', () => {
      const ctx = createContextPipeline({ organizationId: ORG_ID, valueCaseId: CASE_ID })
        .addDocument(mockDocument, mockInsights, 'notes.txt')
        .addWebScrape(mockWebScrape, 'https://acmecorp.com')
        .addCRMRecord(mockCRMDeal)
        .build();

      expect(() => NormalizedContextSchema.parse(ctx)).not.toThrow();
    });
  });

  describe('createContextPipeline factory', () => {
    it('returns a ContextNormalizationPipeline instance', () => {
      const pipeline = createContextPipeline({ organizationId: ORG_ID });
      expect(pipeline).toBeInstanceOf(ContextNormalizationPipeline);
    });
  });
});
