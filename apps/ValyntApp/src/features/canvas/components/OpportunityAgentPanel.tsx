import React, { useState } from "react";
import { useAgent } from "../../agents/hooks/useAgent";

interface OpportunityAgentPanelProps {
  agentId: string;
}

export const OpportunityAgentPanel: React.FC<OpportunityAgentPanelProps> = ({ agentId }) => {
  const { status, messages, sendMessage, error } = useAgent(agentId);
  const [input, setInput] = useState("");

  const handleSend = async () => {
    if (input.trim()) {
      await sendMessage(input);
      setInput("");
    }
  };

  return (
    <div className="rounded-lg border p-4 bg-white dark:bg-neutral-900 shadow">
      <h2 className="font-bold text-lg mb-2 flex items-center gap-2">
        <span role="img" aria-label="Opportunity">
          💡
        </span>{" "}
        Opportunity Agent
      </h2>
      <div className="mb-2 min-h-[80px]">
        {messages.map((msg) => (
          <div key={msg.id} className={`mb-1 ${msg.type === "user" ? "text-right" : "text-left"}`}>
            <span className={msg.type === "user" ? "text-blue-600" : "text-green-600"}>
              {msg.content}
            </span>
            {msg.metadata?.confidence && (
              <span className="ml-2 text-xs text-gray-400">
                [{msg.metadata.confidence} confidence]
              </span>
            )}
          </div>
        ))}
        {status === "thinking" && <div className="text-gray-400 italic">Agent is thinking...</div>}
        {error && <div className="text-red-500">{error}</div>}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-2 py-1 dark:bg-neutral-800"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe a pain point or opportunity..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
          onClick={handleSend}
          disabled={status === "thinking" || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
};
