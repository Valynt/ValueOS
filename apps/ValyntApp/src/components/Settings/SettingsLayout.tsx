import * as React from "react";
export interface SettingsLayoutProps { children?: React.ReactNode; title?: string; }
export function SettingsLayout(props: SettingsLayoutProps): React.ReactElement {
  return React.createElement("div", null, props.children);
}
