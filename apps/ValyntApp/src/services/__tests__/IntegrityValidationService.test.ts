import {
  CheckType,
  ContentType,
  IntegrityValidationRequest,
  IntegrityValidationService,
  ValidationLevel,
} from '../IntegrityValidationService';

describe('IntegrityValidationService checkBasicConfidence bounds', () => {
  const createRequest = (confidence: number): IntegrityValidationRequest => ({
    content: { confidence },
    contentType: ContentType.AGENT_REASONING,
    agentType: 'test-agent',
    context: {},
    traceId: 'trace-1',
    validationLevel: ValidationLevel.BASIC,
  });

  const createService = () =>
    new IntegrityValidationService({} as any, 'https://example.supabase.co', 'test-key');

  it('fails with high severity violation for confidence below 0', async () => {
    const service = createService();
    const result = await service.validateIntegrity(createRequest(-0.1));

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: CheckType.CONFIDENCE_REASONING,
          status: 'fail',
          score: 0,
        }),
      ])
    );

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: CheckType.CONFIDENCE_REASONING,
          severity: 'high',
          description: 'Confidence score is out of range',
        }),
      ])
    );
  });

  it('fails with high severity violation for confidence above 1', async () => {
    const service = createService();
    const result = await service.validateIntegrity(createRequest(1.1));

    const confidenceCheck = result.checks.find(c => c.type === CheckType.CONFIDENCE_REASONING);
    expect(confidenceCheck?.status).toBe('fail');
    expect(confidenceCheck?.score).toBe(0);

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: CheckType.CONFIDENCE_REASONING,
          severity: 'high',
        }),
      ])
    );
  });

  it('fails with high severity violation for NaN confidence', async () => {
    const service = createService();
    const result = await service.validateIntegrity(createRequest(Number.NaN));

    const confidenceCheck = result.checks.find(c => c.type === CheckType.CONFIDENCE_REASONING);
    expect(confidenceCheck?.status).toBe('fail');
    expect(confidenceCheck?.score).toBe(0);

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: CheckType.CONFIDENCE_REASONING,
          severity: 'high',
          remediation: expect.stringContaining('[0, 1]'),
        }),
      ])
    );
  });

  it('accepts valid boundary confidence values 0 and 1', async () => {
    const service = createService();

    const zeroResult = await service.validateIntegrity(createRequest(0));
    const oneResult = await service.validateIntegrity(createRequest(1));

    const zeroCheck = zeroResult.checks.find(c => c.type === CheckType.CONFIDENCE_REASONING);
    const oneCheck = oneResult.checks.find(c => c.type === CheckType.CONFIDENCE_REASONING);

    expect(zeroCheck?.status).toBe('fail');
    expect(zeroCheck?.score).toBe(0.2);
    expect(oneCheck?.status).toBe('pass');
    expect(oneCheck?.score).toBe(1);

    expect(
      zeroResult.violations.some(v => v.description === 'Confidence score is out of range')
    ).toBe(false);
    expect(
      oneResult.violations.some(v => v.description === 'Confidence score is out of range')
    ).toBe(false);
  });
});
