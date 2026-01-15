import { useCallback, useState } from "react";
import { bootstrap, BootstrapOptions, BootstrapResult } from "../app/bootstrap/init";
import { logger } from "../lib/logger";

export type BootstrapStatus = "idle" | "loading" | "complete" | "error";

export interface UseBootstrapReturn {
  status: BootstrapStatus;
  progress: string;
  step: number;
  errors: string[];
  warnings: string[];
  result: BootstrapResult | null;
  startBootstrap: (
    options?: BootstrapOptions
  ) => Promise<BootstrapResult | null>;
  reset: () => void;
}

/**
 * Hook to manage the application bootstrap process
 */
export function useBootstrap(): UseBootstrapReturn {
  const [status, setStatus] = useState<BootstrapStatus>("idle");
  const [progress, setProgress] = useState<string>("");
  const [step, setStep] = useState<number>(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<BootstrapResult | null>(null);

  const startBootstrap = useCallback(
    async (options: BootstrapOptions = {}): Promise<BootstrapResult | null> => {
      if (status === "loading") return null;

      setStatus("loading");
      setStep(1);
      setErrors([]);
      setWarnings([]);

      try {
        const bootstrapResult = await bootstrap({
          ...options,
          onProgress: (message) => {
            setProgress(message);
            setStep((prev) => Math.min(prev + 1, 8));
            options.onProgress?.(message);
          },
          onWarning: (warning) => {
            setWarnings((prev) => [...prev, warning]);
            options.onWarning?.(warning);
          },
          onError: (error) => {
            setErrors((prev) => [...prev, error]);
            options.onError?.(error);
          },
        });

        setResult(bootstrapResult);

        if (bootstrapResult.success) {
          setStatus("complete");
          setStep(8);
        } else {
          setStatus("error");
          setErrors(bootstrapResult.errors);
        }

        return bootstrapResult;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setStatus("error");
        setErrors((prev) => [...prev, errorMsg]);
        logger.error(
          "Unhandled bootstrap error in hook",
          err instanceof Error ? err : undefined
        );
        return null;
      }
    },
    [status]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress("");
    setStep(0);
    setErrors([]);
    setWarnings([]);
    setResult(null);
  }, []);

  return {
    status,
    progress,
    step,
    errors,
    warnings,
    result,
    startBootstrap,
    reset,
  };
}
