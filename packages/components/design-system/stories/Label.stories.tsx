import React from "react";

import "../src/css/tokens.css";
import { Label } from "../src/primitives/Label";

export default {
  title: "DesignSystem/Label",
  component: Label,
};

export const Default = () => <Label htmlFor="example">Example label</Label>;
