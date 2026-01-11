export function resolveMode(args = [], envMode = process.env.DX_MODE) {
  const normalizedEnvMode = envMode?.trim();
  const modeArg = args.find((arg) => arg.startsWith("--mode="));
  const cliMode = modeArg
    ? modeArg.split("=")[1]
    : (() => {
        const modeIndex = args.indexOf("--mode");
        if (modeIndex !== -1 && args[modeIndex + 1]) {
          return args[modeIndex + 1];
        }
        return undefined;
      })();

  if (cliMode && normalizedEnvMode && cliMode !== normalizedEnvMode) {
    throw new Error(
      `❌ Conflicting DX mode: --mode=${cliMode} but DX_MODE=${normalizedEnvMode}. Next action: set DX_MODE=${cliMode}.`
    );
  }

  return cliMode || normalizedEnvMode || "local";
}
