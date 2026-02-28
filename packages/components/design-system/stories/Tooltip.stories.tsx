import React from "react";

import "../src/css/tokens.css";
import { Button } from "../src/primitives/Button";
import { Tooltip } from "../src/primitives/Tooltip";

export default {
  title: "DesignSystem/Tooltip",
  component: Tooltip,
};

export const Basic = () => (
  <Tooltip id="tip1" content="Helpful info">
    <Button>Hover or focus me</Button>
  </Tooltip>
);
