import * as React from "react";
export type SliderProps = React.InputHTMLAttributes<HTMLInputElement>;
export function Slider(props: SliderProps) {
  return <input type="range" {...props} />;
}
