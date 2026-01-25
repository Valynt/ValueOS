import React from "react";
import "../src/css/tokens.css";
import { Button } from "../src/primitives/Button";

export default {
  title: "DesignSystem/Button",
  component: Button,
};

export const Primary = () => <Button variant="primary">Primary</Button>;
export const Secondary = () => <Button variant="secondary">Secondary</Button>;
