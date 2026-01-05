import React, { useEffect } from "react";
import { ChatCanvasLayout } from "./components/ChatCanvas";
import { sessionManager } from "./services/SessionManager";
import { Toaster } from "@/components/ui/toaster";

/**
 * Main Application Component
 * Uses the modern Chat + Canvas UI as the primary interface
 */
function App() {
  useEffect(() => {
    sessionManager.initialize();
    return () => sessionManager.terminate();
  }, []);

  return (
    <>
      <ChatCanvasLayout
        onSettingsClick={() => {
          // Settings navigation handled within ChatCanvasLayout
          console.log("Settings clicked");
        }}
        onHelpClick={() => {
          // Help navigation handled within ChatCanvasLayout
          console.log("Help clicked");
        }}
      />
      <Toaster />
    </>
  );
}

export default App;
