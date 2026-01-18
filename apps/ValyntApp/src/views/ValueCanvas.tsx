import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { ChatCanvasLayout } from "../components/ChatCanvas/ChatCanvasLayout";

export default function ValueCanvas() {
  const location = useLocation();

  // Parse initial intent from navigation state (e.g. from MissionControl)
  const initialAction = useMemo(() => {
    const state = location.state as {
      source?: string;
      domain?: string;
      data?: unknown;
      templateId?: string;
    } | null;

    if (!state?.source) return null;

    switch (state.source) {
      case "research":
        return state.domain ? { type: "research", data: state.domain } : null;
      case "sales-call":
        return state.data ? { type: "sales-call", data: state.data } : null;
      case "crm":
        return state.data ? { type: "crm", data: state.data } : null;
      case "upload-notes":
        return state.data ? { type: "upload-notes", data: state.data } : null;
      case "template":
        return state.templateId
          ? { type: "template", data: { id: state.templateId, ...state } }
          : null;
      case "generic":
        return { type: "generic", data: state };
      default:
        return { type: "generic", data: state };
    }
  }, [location.state]);

  return <ChatCanvasLayout initialAction={initialAction} />;
}
