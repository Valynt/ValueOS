import { describe, it, expect, vi } from "vitest";
import { performance } from "node:perf_hooks";
import { ValueFabricService } from "../ValueFabricService";

describe("ValueFabricService Performance", () => {
  it("measures performance of instantiateUseCaseTemplate", async () => {
    const mockSupabase = {
      from: (table: string) => {
        return {
          insert: (data: any) => {
            if (table === 'use_cases') {
              return {
                select: () => {
                  return {
                    single: async () => {
                      await new Promise(r => setTimeout(r, 5));
                      return { data: { id: 'new-use-case-1' }, error: null };
                    }
                  }
                }
              }
            }
            if (table === 'use_case_capabilities') {
              return new Promise(r => setTimeout(() => r({ error: null }), 5));
            }
          }
        };
      }
    };

    class BenchmarkService extends ValueFabricService {
      constructor() {
        super(mockSupabase as any);
      }
      async getUseCaseWithCapabilities(org: string, id: string) {
        const caps = Array.from({ length: 20 }).map((_, i) => ({ id: `cap-${i}` }));
        return {
          useCase: { is_template: true, name: 'T', description: 'D', persona: 'P', industry: 'I' },
          capabilities: caps
        } as any;
      }

      // stub requireOrganizationId to avoid errors
      requireOrganizationId(orgId: string) {}
    }

    // override static method
    (ValueFabricService as any).invalidateUseCaseCache = async () => {};

    const service = new BenchmarkService();

    // Warmup
    await service.instantiateUseCaseTemplate('org1', 'tpl1', 'vc1');

    const start = performance.now();
    for (let i = 0; i < 5; i++) {
      await service.instantiateUseCaseTemplate('org1', 'tpl1', 'vc1');
    }
    const end = performance.now();

    const averageTime = (end - start) / 5;
    console.log(`Average time for instantiateUseCaseTemplate: ${averageTime} ms`);

    expect(averageTime).toBeGreaterThan(0);
  });
});
