// Mock LLM implementation - in real app this would call OpenAI/Anthropic API
export async function invokeLLM(options: {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}) {
  const { messages, temperature = 0.7 } = options;

  // Mock response based on the last user message
  const lastMessage = messages[messages.length - 1];
  const content = lastMessage?.content || "";

  // Simple mock responses based on content
  let response = "I understand your question. Let me provide a helpful response.";

  if (content.toLowerCase().includes("pillar")) {
    response = "Pillars in VOS represent the core competencies needed for value-driven selling. Each pillar builds upon the previous one, creating a comprehensive framework for enterprise value management.";
  } else if (content.toLowerCase().includes("roi")) {
    response = "ROI in VOS is calculated by quantifying the value delivered through Outcomes, measuring against baseline KPIs, and calculating the financial impact over time. A strong ROI model includes benefits, costs, and timeframe.";
  } else if (content.toLowerCase().includes("certification")) {
    response = "VOS certifications are earned by passing pillar assessments with an 80% threshold. Bronze certifications are awarded for passing individual pillars, while Silver and Gold tiers require simulation mastery.";
  }

  return {
    choices: [{
      message: {
        content: response,
        role: "assistant"
      },
      finish_reason: "stop"
    }],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150
    }
  };
}
