export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    tokens?: number;
    sources?: string[];
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isStreaming: boolean;
}

export type ChatInputType = "text" | "command" | "file";

export interface ChatInput {
  type: ChatInputType;
  content: string;
  attachments?: File[];
}
