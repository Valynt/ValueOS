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
      data?: any;
      templateId?: string;
    } | null;

    if (!state?.source) return null;

    if (state.source === "research" && state.domain) {
      return { type: "research", data: state.domain };
    }

    if (state.source === "sales-call" && state.data) {
      return { type: "sales-call", data: state.data };
    }

    if (state.source === "crm" && state.data) {
      return { type: "crm", data: state.data };
    }

    if (state.source === "upload-notes" && state.data) {
      return { type: "upload-notes", data: state.data };
    }

    if (state.source === "template" && state.templateId) {
      return { type: "template", data: { id: state.templateId, ...state } };
    }

    // Fallback for direct searches or other sources
    return { type: "generic", data: state };
  }, [location.state]);

  return <ChatCanvasLayout initialAction={initialAction} />;
}
