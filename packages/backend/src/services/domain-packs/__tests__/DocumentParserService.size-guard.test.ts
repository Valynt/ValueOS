/**
 * DocumentParserService — Size Guard Tests (Sprint 6, PR #2064)
 *
 * Validates that OversizedDocumentError is thrown before any parser work
 * when a file exceeds the configured size limit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OversizedDocumentError,
  assertFileSizeWithinLimit,
  DEFAULT_MAX_FILE_BYTES,
  DocumentParserService,
} from '../DocumentParserService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name: string, sizeBytes: number, type = 'application/pdf'): File {
  // Create a File-like object with a controlled size.
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

// ---------------------------------------------------------------------------
// OversizedDocumentError
// ---------------------------------------------------------------------------

describe('OversizedDocumentError', () => {
  it('has the correct name', () => {
    const err = new OversizedDocumentError('test.pdf', 1024, 512);
    expect(err.name).toBe('OversizedDocumentError');
  });

  it('exposes fileName, fileSizeBytes, maxSizeBytes', () => {
    const err = new OversizedDocumentError('report.pdf', 25 * 1024 * 1024, 20 * 1024 * 1024);
    expect(err.fileName).toBe('report.pdf');
    expect(err.fileSizeBytes).toBe(25 * 1024 * 1024);
    expect(err.maxSizeBytes).toBe(20 * 1024 * 1024);
  });

  it('includes human-readable sizes in the message', () => {
    const err = new OversizedDocumentError('big.pdf', 25 * 1024 * 1024, 20 * 1024 * 1024);
    expect(err.message).toContain('25.00 MB');
    expect(err.message).toContain('20 MB');
  });

  it('is an instance of Error', () => {
    const err = new OversizedDocumentError('x.pdf', 1, 0);
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// assertFileSizeWithinLimit
// ---------------------------------------------------------------------------

describe('assertFileSizeWithinLimit', () => {
  it('does not throw when file is within the default limit', () => {
    const file = makeFile('ok.pdf', DEFAULT_MAX_FILE_BYTES - 1);
    expect(() => assertFileSizeWithinLimit(file)).not.toThrow();
  });

  it('does not throw when file is exactly at the default limit', () => {
    const file = makeFile('edge.pdf', DEFAULT_MAX_FILE_BYTES);
    expect(() => assertFileSizeWithinLimit(file)).not.toThrow();
  });

  it('throws OversizedDocumentError when file exceeds the default limit', () => {
    const file = makeFile('huge.pdf', DEFAULT_MAX_FILE_BYTES + 1);
    expect(() => assertFileSizeWithinLimit(file)).toThrow(OversizedDocumentError);
  });

  it('throws OversizedDocumentError when file exceeds a custom limit', () => {
    const file = makeFile('medium.pdf', 5 * 1024 * 1024); // 5 MB
    const customLimit = 4 * 1024 * 1024; // 4 MB
    expect(() => assertFileSizeWithinLimit(file, customLimit)).toThrow(OversizedDocumentError);
  });

  it('does not throw when file is within a custom limit', () => {
    const file = makeFile('small.pdf', 3 * 1024 * 1024); // 3 MB
    const customLimit = 4 * 1024 * 1024; // 4 MB
    expect(() => assertFileSizeWithinLimit(file, customLimit)).not.toThrow();
  });

  it('includes the file name in the thrown error', () => {
    const file = makeFile('invoice.pdf', DEFAULT_MAX_FILE_BYTES + 1);
    try {
      assertFileSizeWithinLimit(file);
      expect.fail('Expected OversizedDocumentError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(OversizedDocumentError);
      expect((err as OversizedDocumentError).fileName).toBe('invoice.pdf');
    }
  });
});

// ---------------------------------------------------------------------------
// DocumentParserService.parseDocument — size guard integration
// ---------------------------------------------------------------------------

describe('DocumentParserService.parseDocument size guard', () => {
  it('throws OversizedDocumentError before any parsing when file is too large', async () => {
    // Use a very small custom limit so we can test without allocating 20 MB
    const service = new DocumentParserService({ maxFileSizeBytes: 1024 });
    const oversizedFile = makeFile('big.txt', 2048, 'text/plain');

    await expect(service.parseDocument(oversizedFile)).rejects.toThrow(OversizedDocumentError);
  });

  it('does not throw for a file within the custom limit', async () => {
    // We cannot call the full parseDocument without mocking supabase/LLM,
    // but we can verify the guard does NOT fire for a small text file.
    const service = new DocumentParserService({ maxFileSizeBytes: 10 * 1024 * 1024 });
    const smallFile = makeFile('notes.txt', 100, 'text/plain');

    // The guard should pass; the method will then try to read the file as text.
    // We spy on File.prototype.text to avoid actual I/O.
    vi.spyOn(smallFile, 'text').mockResolvedValue('hello world');

    const result = await service.parseDocument(smallFile);
    expect(result.text).toBe('hello world');
    expect(result.metadata.fileName).toBe('notes.txt');
  });
});
