import * as React from "react";
export type SwitchProps = React.InputHTMLAttributes<HTMLInputElement>;
export function Switch(props: SwitchProps) {
  return <input type="checkbox" {...props} />;
}
