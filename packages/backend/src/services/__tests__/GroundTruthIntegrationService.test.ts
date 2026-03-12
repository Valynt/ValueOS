import { beforeEach, describe, expect, it, vi } from "vitest";

import { ALL_ESO_KPIS, EXTENDED_PERSONA_MAPS } from "../../types/eso-data";
import { ALL_VMRT_SEEDS } from "../../types/vos-pt1-seed";
import { GroundTruthIntegrationService } from "../GroundTruthIntegrationService";

interface GroundTruthIntegrationServiceInternals {
  initialized: boolean;
  initializationPromise: Promise<void> | null;
  kpiIndex: Map<string, unknown>;
  vmrtIndex: Map<string, unknown>;
  esoModule: {
    initialize: () => Promise<void>;
  };
}

function asInternals(
  service: GroundTruthIntegrationService
): GroundTruthIntegrationServiceInternals {
  return service as unknown as GroundTruthIntegrationServiceInternals;
}

describe("GroundTruthIntegrationService", () => {
  let service: GroundTruthIntegrationService;

  beforeEach(() => {
    service = GroundTruthIntegrationService.getInstance();
    const internals = asInternals(service);
    internals.initialized = false;
    internals.initializationPromise = null;
    internals.kpiIndex.clear();
    internals.vmrtIndex.clear();
  });

  it("auto-initializes methods that depend on indices", async () => {
    const kpiId = ALL_ESO_KPIS[0]?.id;
    const persona = EXTENDED_PERSONA_MAPS[0]?.persona;
    const traceId = ALL_VMRT_SEEDS[0]?.traceId;

    expect(kpiId).toBeTruthy();
    expect(persona).toBeTruthy();
    expect(traceId).toBeTruthy();

    const benchmark = await service.getBenchmark(kpiId!);
    expect(benchmark.metricId).toBe(kpiId);

    const validation = await service.validateClaim(kpiId!, benchmark.value);
    expect(validation.citation).not.toBe("Unknown source");

    const personaKpis = await service.getPersonaKPIs(persona!);
    expect(Array.isArray(personaKpis.kpis)).toBe(true);

    const similarTraces = await service.getSimilarTraces({}, 3);
    expect(similarTraces.length).toBeLessThanOrEqual(3);

    const enriched = await service.enrichWithCitations(
      [kpiId!],
      [{ metricId: kpiId!, value: benchmark.value }]
    );
    expect(enriched.benchmarks[kpiId!]?.metricId).toBe(kpiId);

    const sourceKnown = await service.verifySourceId(kpiId!);
    expect(sourceKnown).toBe(true);

    const traceKnown = await service.verifySourceId(traceId!);
    expect(traceKnown).toBe(true);

    const stats = await service.getStats();
    expect(stats.kpiCount).toBeGreaterThan(0);
    expect(stats.vmrtCount).toBeGreaterThan(0);
  });

  it("avoids duplicate initialization work across dependent methods", async () => {
    const internals = asInternals(service);
    const initializeSpy = vi.spyOn(internals.esoModule, "initialize");
    const kpiId = ALL_ESO_KPIS[0]?.id;

    await Promise.all([
      service.getBenchmark(kpiId!),
      service.verifySourceId(kpiId!),
      service.getStats(),
    ]);

    expect(initializeSpy).toHaveBeenCalledTimes(1);

    await service.getBenchmark(kpiId!);
    await service.getStats();

    expect(initializeSpy).toHaveBeenCalledTimes(1);
  });
});
