export type GroundTruthPayload = {
  benchmarks?: Record<string, unknown> | unknown[];
  validations?: Record<string, unknown> | unknown[];
  overallConfidence?: number;
  sources?: string[];
  citations?: unknown[];
  [key: string]: unknown;
};

const GROUND_TRUTH_KEYS = [
  'groundTruth',
  'groundtruth',
  'ground_truth',
  'benchmarks',
  'validations',
  'overallConfidence',
  'sources',
  'citations',
];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const extractGroundTruthPayload = (value: unknown): GroundTruthPayload | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  const direct =
    (value.groundTruth as GroundTruthPayload | undefined) ||
    (value.groundtruth as GroundTruthPayload | undefined) ||
    (value.ground_truth as GroundTruthPayload | undefined);

  if (direct) {
    return direct;
  }

  const hasTopLevel = GROUND_TRUTH_KEYS.some((key) => key in value);
  if (!hasTopLevel) {
    return null;
  }

  return {
    benchmarks: value.benchmarks as GroundTruthPayload['benchmarks'],
    validations: value.validations as GroundTruthPayload['validations'],
    overallConfidence: value.overallConfidence as GroundTruthPayload['overallConfidence'],
    sources: value.sources as GroundTruthPayload['sources'],
    citations: value.citations as GroundTruthPayload['citations'],
  };
};

export const mergeGroundTruthIntoStageData = (
  stageData: unknown,
  groundTruth: GroundTruthPayload | null
): unknown => {
  if (!groundTruth) {
    return stageData;
  }

  if (isPlainObject(stageData)) {
    const existing = extractGroundTruthPayload(stageData);
    if (existing) {
      return stageData;
    }

    return {
      ...stageData,
      groundTruth,
    };
  }

  return {
    value: stageData,
    groundTruth,
  };
};

export const stripGroundTruthFields = (value: unknown): unknown => {
  if (!isPlainObject(value)) {
    return value;
  }

  const cleaned: Record<string, unknown> = { ...value };
  for (const key of GROUND_TRUTH_KEYS) {
    delete cleaned[key];
  }
  delete cleaned.groundTruth;
  delete cleaned.groundtruth;
  delete cleaned.ground_truth;
  return cleaned;
};
