import { ValueFabricService } from "./src/services/value/ValueFabricService.ts";
import { performance } from "perf_hooks";

const numCapabilities = 50;
const capabilities = Array.from({ length: numCapabilities }, (_, i) => ({ id: `cap-${i}` }));

let linkCount = 0;

const mockSupabase = {
  from: (table) => {
    if (table === "use_cases") {
      return {
        select: () => ({
          single: async () => ({ data: { id: "new-uc-1", is_template: true }, error: null }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: "new-uc-2", is_template: false }, error: null }),
          }),
        }),
      };
    } else if (table === "use_case_capabilities") {
      return {
        select: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
        insert: async () => {
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 10));
          linkCount++;
          return { error: null };
        },
      };
    } else if (table === "capabilities") {
       return {
         select: () => ({
           eq: () => ({
             in: async () => ({ data: capabilities, error: null })
           })
         })
       }
    }
  },
};

const service = new ValueFabricService(mockSupabase);

// Mock getUseCaseWithCapabilities to bypass real DB
service.getUseCaseWithCapabilities = async () => {
  return {
    useCase: {
      id: "template-1",
      name: "Template",
      description: "Desc",
      persona: "Persona",
      industry: "Industry",
      is_template: true,
    },
    capabilities,
  };
};

// Mock cache invalidation to prevent errors
ValueFabricService.invalidateUseCaseCache = async () => {};

async function runBenchmark() {
  const start = performance.now();
  linkCount = 0;
  await service.instantiateUseCaseTemplate("org-1", "template-1", "vc-1");
  const end = performance.now();
  console.log(`Time taken: ${(end - start).toFixed(2)} ms, links: ${linkCount}`);
}

await runBenchmark();
