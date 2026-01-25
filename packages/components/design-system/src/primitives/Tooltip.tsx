import React, { useState } from "react";

export function Tooltip({
  id,
  content,
  children,
}: {
  id: string;
  content: React.ReactNode;
  children: React.ReactElement;
}) {
  const [visible, setVisible] = useState(false);
  const tipId = `${id}-tooltip`;
  return (
    <span style={{ display: "inline-block", position: "relative" }}>
      {React.cloneElement(children, {
        "aria-describedby": tipId,
        onFocus: () => setVisible(true),
        onBlur: () => setVisible(false),
        onMouseEnter: () => setVisible(true),
        onMouseLeave: () => setVisible(false),
      })}
      {visible && (
        <div
          id={tipId}
          role="tooltip"
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: "6px",
            background: "var(--vds-color-surface-2)",
            color: "var(--vds-color-text-primary)",
            padding: "6px 8px",
            borderRadius: 4,
            boxShadow: "var(--vds-elev-2)",
            whiteSpace: "nowrap",
            zIndex: 9000,
          }}
        >
          {content}
        </div>
      )}
    </span>
  );
}
