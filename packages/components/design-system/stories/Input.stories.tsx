import React from "react";

import "../src/css/tokens.css";
import { Input } from "../src/primitives/Input";

export default {
  title: "DesignSystem/Input",
  component: Input,
};

export const Default = () => <Input id="example" label="Example" placeholder="Type here" />;
export const WithError = () => <Input id="example-error" label="Email" error="Invalid email" />;
