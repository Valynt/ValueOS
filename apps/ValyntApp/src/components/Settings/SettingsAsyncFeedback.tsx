import * as React from "react";
export interface AsyncFeedbackProps { children?: React.ReactNode; status?: string; message?: string; }
export function AsyncFeedback(_props: AsyncFeedbackProps): React.ReactElement {
  return React.createElement("div", null);
}
export function SuccessFeedback(_props: AsyncFeedbackProps): React.ReactElement {
  return React.createElement("div", null);
}
export function ErrorFeedback(_props: AsyncFeedbackProps): React.ReactElement {
  return React.createElement("div", null);
}
export function SettingsErrorBoundary({ children }: { children?: React.ReactNode }): React.ReactElement {
  return React.createElement(React.Fragment, null, children);
}
export interface AsyncState<T = unknown> { state: { status: "idle" | "loading" | "success" | "error"; data?: T; error?: string }; execute: (fn: () => Promise<T>) => Promise<void>; reset: () => void; }
export function useAsyncState<T = unknown>(): AsyncState<T> {
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [data, setData] = React.useState<T | undefined>(undefined);
  const [error, setError] = React.useState<string | undefined>(undefined);
  return {
    state: { status, data, error },
    execute: async (fn) => { setStatus("loading"); try { setData(await fn()); setStatus("success"); } catch (e) { setError(String(e)); setStatus("error"); } },
    reset: () => { setStatus("idle"); setData(undefined); setError(undefined); },
  };
}
