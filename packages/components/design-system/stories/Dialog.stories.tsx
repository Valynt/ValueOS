import React, { useState } from "react";
import "../src/css/tokens.css";
import { Dialog } from "../src/primitives/Dialog";

export default {
  title: "DesignSystem/Dialog",
  component: Dialog,
};

export const Basic = () => {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open</button>
      <Dialog open={open} title="Dialog title" onClose={() => setOpen(false)}>
        <p>Dialog content</p>
      </Dialog>
    </div>
  );
};
