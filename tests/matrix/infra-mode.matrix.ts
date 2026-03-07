export type InfraMode = "local" | "docker" | "supabase";

export interface InfraModeCase {
  enabled: boolean;
  env: Record<string, string>;
  id: string;
  label: string;
  mode: InfraMode;
}

const isEnabled = (envFlag: string | undefined): boolean => envFlag !== "0";

export const infraModeMatrix: InfraModeCase[] = [
  {
    id: "local",
    mode: "local",
    label: "Local in-process infrastructure",
    env: {
      TEST_INFRA_MODE: "local",
    },
    enabled: true,
  },
  {
    id: "docker",
    mode: "docker",
    label: "Container-backed infrastructure",
    env: {
      TEST_INFRA_MODE: "docker",
    },
    enabled: isEnabled(process.env.ENABLE_DOCKER_INFRA_TESTS),
  },
  {
    id: "supabase",
    mode: "supabase",
    label: "Supabase-backed infrastructure",
    env: {
      TEST_INFRA_MODE: "supabase",
    },
    enabled: isEnabled(process.env.ENABLE_SUPABASE_INFRA_TESTS),
  },
];
