import * as React from "react";
export interface LoadingStateProps { message?: string; }
export function FullPageLoading(_props: LoadingStateProps): React.ReactElement {
  return React.createElement("div", null, "Loading...");
}
export function SectionLoading(_props: LoadingStateProps): React.ReactElement {
  return React.createElement("div", null, "Loading...");
}
