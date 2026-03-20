import { Check, Edit2, X } from "lucide-react";
import React, { useState } from "react";

import { logger } from "../../../lib/logger";
import { useAgent } from "../../agents/hooks/useAgent";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OpportunityAgentPanelProps {
  agentId: string;
}

export const OpportunityAgentPanel: React.FC<OpportunityAgentPanelProps> = ({ agentId }) => {
  const { status, messages, sendMessage, error } = useAgent(agentId);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleSend = async () => {
    if (input.trim()) {
      await sendMessage(input);
      setInput("");
    }
  };

  const startEditing = (id: string, content: string) => {
    setEditingId(id);
    setEditValue(content);
  };

  const saveEdit = (id: string) => {
    // In a real app, this would call an API to update the message/node
    logger.info(`Saving edit for ${id}: ${editValue}`);
    setEditingId(null);
  };

  return (
    <div className="rounded-lg border p-4 bg-card dark:bg-neutral-900 shadow">
      <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
        <span role="img" aria-label="Opportunity">
          💡
        </span>{" "}
        Opportunity Agent
      </h2>
      <div className="mb-4 min-h-[120px] space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`group relative flex flex-col ${msg.type === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[90%] p-3 rounded-lg text-sm ${
                msg.type === "user"
                  ? "bg-blue-50 text-blue-900 border border-blue-100"
                  : "bg-green-50 text-green-900 border border-green-100"
              }`}
            >
              {editingId === msg.id ? (
                <div className="flex gap-2 items-center">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-8 text-sm bg-card"
                  />
                  <Button size="xs" onClick={() => saveEdit(msg.id)}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start gap-4">
                    <span>{msg.content}</span>
                    {msg.type === "agent" && (
                      <button
                        onClick={() => startEditing(msg.id, msg.content)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {msg.metadata?.confidence && (
                    <div className="mt-2">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-card/50">
                        {msg.metadata.confidence} confidence
                      </Badge>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {status === "thinking" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
            <div className="h-1.5 w-1.5 bg-indigo-500 rounded-full" />
            Agent is thinking...
          </div>
        )}
        {error && (
          <div className="text-xs text-red-500 p-2 bg-red-50 rounded border border-red-100">
            {error}
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-2 border-t">
        <Input
          className="flex-1 h-9 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe a pain point or opportunity..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <Button size="sm" onClick={handleSend} disabled={status === "thinking" || !input.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
};
