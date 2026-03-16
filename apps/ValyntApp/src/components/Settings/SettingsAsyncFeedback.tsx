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
