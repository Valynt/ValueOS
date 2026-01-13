export function resolveMode(cliArgs = []) {
  const modeArg = cliArgs.find((arg) => arg.startsWith('--mode='));
  if (modeArg) {
    return modeArg.split('=')[1];
  }

  const modeIndex = cliArgs.indexOf('--mode');
  if (modeIndex !== -1 && cliArgs[modeIndex + 1]) {
    return cliArgs[modeIndex + 1];
  }

  return process.env.DX_MODE || 'local';
}
