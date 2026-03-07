import { existsSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { snapshotHash } from "../tests/shared/snapshotHash";
import { testNamespace } from "../tests/shared/testNamespace";

export interface FailurePacketInput {
  command: string;
  outputPaths?: string[];
  suite: string;
}

export interface FailurePacket {
  command: string;
  generated_at: string;
  namespace: string;
  outputs: Array<{
    content: string;
    hash: string;
    path: string;
  }>;
  packet_hash: string;
  suite: string;
}

const readOutputFiles = (paths: string[]): FailurePacket["outputs"] => {
  return paths
    .filter((path) => existsSync(path))
    .map((path) => {
      const content = readFileSync(path, "utf8");
      return {
        path,
        content,
        hash: snapshotHash(content),
      };
    });
};

export const buildFailurePacket = (
  input: FailurePacketInput,
): FailurePacket => {
  const outputs = readOutputFiles(input.outputPaths ?? []);
  const generatedAt = new Date().toISOString();
  const namespace = testNamespace([input.suite, "failure-packet"], {
    prefix: "infra",
  });

  const packet: Omit<FailurePacket, "packet_hash"> = {
    suite: input.suite,
    command: input.command,
    generated_at: generatedAt,
    namespace,
    outputs,
  };

  return {
    ...packet,
    packet_hash: snapshotHash(packet),
  };
};

const runAsScript = (): void => {
  const suite = process.env.FAILURE_SUITE ?? "unknown-suite";
  const command = process.env.FAILURE_COMMAND ?? "unknown-command";
  const outputPaths = (process.env.FAILURE_OUTPUTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => resolve(value));

  const packet = buildFailurePacket({
    suite,
    command,
    outputPaths,
  });

  const outputTarget = process.env.FAILURE_PACKET_OUT;
  if (outputTarget) {
    writeFileSync(resolve(outputTarget), JSON.stringify(packet, null, 2));
  } else {
    console.log(JSON.stringify(packet, null, 2));
  }
};

const entryFile = process.argv[1] ? fileURLToPath(import.meta.url) : "";
if (process.argv[1] && process.argv[1] === entryFile) {
  runAsScript();
}
