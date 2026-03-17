import * as React from "react";

export interface ResponsiveNavProps {
  items?: Array<{ label: string; href: string }>;
}

export function ResponsiveNav(_props: ResponsiveNavProps): React.ReactElement {
  return React.createElement("nav", null);
}

export interface ResponsivePageLayoutProps {
  children?: React.ReactNode;
}

export function ResponsivePageLayout(props: ResponsivePageLayoutProps): React.ReactElement {
  return React.createElement("div", null, props.children);
}
