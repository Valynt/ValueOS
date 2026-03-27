import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndustryBenchmarkModule } from '../IndustryBenchmarkModule';
import { ErrorCodes } from '../../types';

describe('IndustryBenchmarkModule', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('parses Census API benchmark responses when live provider succeeds', async () => {
    const module = new IndustryBenchmarkModule();
    await module.initialize({
      censusApiKey: 'census-key',
      blsApiKey: 'bls-key',
      enableStaticData: true,
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        ['NAICS2017_LABEL', 'RCPTOT', 'EMP', 'NAICS2017', 'us'],
        ['Custom Computer Programming Services', '500000', '2000', '541511', '1'],
      ],
    });

    const response = await module.query({
      identifier: '541511',
      metric: 'revenue_per_employee',
      options: {
        allow_static_fallback: false,
      },
    });

    expect(response.success).toBe(true);
    if (!response.success || Array.isArray(response.data) || !response.data) {
      throw new Error('Expected successful benchmark metric response');
    }

    expect(response.data.value).toBe(250000);
    expect(response.data.metadata.source).toBe('US Census CBP API');
    expect(response.data.metadata.year).toBe(new Date().getUTCFullYear() - 1);
    expect(response.data.metadata.is_fallback_data).toBe(false);
    expect(response.data.metadata.data_mode).toBe('live_api');
  });

  it('uses static fallback when policy allows fallback data', async () => {
    const module = new IndustryBenchmarkModule();
    await module.initialize({
      enableStaticData: true,
    });

    const response = await module.query({
      identifier: '541511',
      metric: 'revenue_per_employee',
      options: {
        allow_static_fallback: true,
      },
    });

    expect(response.success).toBe(true);
    if (!response.success || Array.isArray(response.data) || !response.data) {
      throw new Error('Expected fallback benchmark metric response');
    }

    expect(response.data.metadata.source).toBe('BLS Economic Census');
    expect(response.data.metadata.is_fallback_data).toBe(true);
    expect(response.data.metadata.data_mode).toBe('static');
  });

  it('blocks benchmark claim generation when authoritative external evidence is required', async () => {
    const module = new IndustryBenchmarkModule();
    await module.initialize({
      enableStaticData: true,
    });

    const response = await module.query({
      identifier: '541511',
      metric: 'revenue_per_employee',
      options: {
        require_authoritative_external_benchmark: true,
        allow_static_fallback: false,
      },
    });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe(ErrorCodes.EVIDENCE_REQUIRED);
    expect(response.error?.message).toContain('Authoritative Census benchmark required');
  });

  it('returns invalid classification error for malformed SOC code at BLS provider', async () => {
    const module = new IndustryBenchmarkModule();
    await module.initialize({
      blsApiKey: 'bls-key',
      enableStaticData: false,
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({}),
    });

    const response = await module.query({
      identifier: '15-2051',
      metric: 'wage_data',
    });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe(ErrorCodes.INVALID_CLASSIFICATION_CODE);
    expect(response.error?.message).toContain('Invalid SOC code');
  });

  it('returns EXTERNAL_NO_DATA when live provider has no benchmark rows and fallback is disabled', async () => {
    const module = new IndustryBenchmarkModule();
    await module.initialize({
      censusApiKey: 'census-key',
      enableStaticData: false,
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [['NAICS2017_LABEL', 'RCPTOT', 'EMP']],
    });

    const response = await module.query({
      identifier: '541511',
      metric: 'revenue_per_employee',
      options: {
        allow_static_fallback: false,
      },
    });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe(ErrorCodes.EXTERNAL_NO_DATA);
  });
});
