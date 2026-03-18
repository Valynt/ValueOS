import {
  ArrowLeft,
  Bot,
  Brain,
  Lightbulb,
  Send,
  Sparkles,
  User
} from "lucide-react";
import React, { useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";


interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SuggestedQuestion {
  id: string;
  text: string;
  category: string;
}

export function AITutor() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your VOS AI Tutor. I'm here to help you understand the Value Operating System better. You can ask me questions about VOS principles, specific pillars, or request help with your learning journey. What would you like to learn about today?",
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const suggestedQuestions: SuggestedQuestion[] = [
    {
      id: '1',
      text: "What are the four pillars of VOS?",
      category: "Basics"
    },
    {
      id: '2',
      text: "How do I apply Value Discovery in my organization?",
      category: "Application"
    },
    {
      id: '3',
      text: "Can you explain Value Capture with an example?",
      category: "Concepts"
    },
    {
      id: '4',
      text: "What's the difference between Value Creation and Value Distribution?",
      category: "Comparison"
    },
    {
      id: '5',
      text: "How do I measure the success of VOS implementation?",
      category: "Metrics"
    },
    {
      id: '6',
      text: "What are common challenges in VOS adoption?",
      category: "Challenges"
    }
  ];

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Simulate AI response - replace with actual AI API call
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateAIResponse(inputMessage),
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1000);
  };

  const generateAIResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase();

    if (message.includes('four pillars') || message.includes('pillars')) {
      return "The Value Operating System consists of four fundamental pillars:\n\n1. **Value Discovery** - Identifying and articulating value in any context\n2. **Value Creation** - Designing and implementing value-generating solutions\n3. **Value Capture** - Measuring and optimizing value realization\n4. **Value Distribution** - Fairly allocating and communicating value across stakeholders\n\nEach pillar builds upon the previous one, creating a comprehensive framework for value management. Would you like me to dive deeper into any specific pillar?";
    }

    if (message.includes('value discovery')) {
      return "Value Discovery is the foundational pillar of VOS. It involves:\n\n• **Stakeholder Analysis**: Identifying all parties who create or receive value\n• **Value Mapping**: Visualizing how value flows through systems\n• **Needs Assessment**: Understanding what different stakeholders truly value\n• **Opportunity Identification**: Finding untapped value potential\n\nThe key insight is that value is subjective and context-dependent. What one stakeholder considers valuable might differ significantly from another's perspective. Would you like some practical techniques for conducting Value Discovery?";
    }

    if (message.includes('value capture')) {
      return "Value Capture focuses on measuring and optimizing how value is actually realized. Key aspects include:\n\n• **Metrics Definition**: Establishing clear, measurable indicators of value\n• **Tracking Systems**: Implementing tools to monitor value flows\n• **Optimization**: Continuously improving value realization processes\n• **ROI Analysis**: Calculating return on value investments\n\nA common mistake is focusing only on financial metrics. True Value Capture considers multiple dimensions: financial, social, environmental, and strategic value. Would you like examples of Value Capture in different industries?";
    }

    if (message.includes('example') || message.includes('examples')) {
      return "Here's a practical example of VOS in action:\n\n**Company**: A software development firm\n\n**Value Discovery**: Identified that clients valued not just the code, but the business outcomes it enabled\n\n**Value Creation**: Developed a solution that included ongoing support and business consulting\n\n**Value Capture**: Measured success through client revenue growth, not just project delivery\n\n**Value Distribution**: Shared success with the development team through profit-sharing\n\nThis holistic approach resulted in 40% higher client retention and 25% team productivity improvement. Would you like more examples from different industries?";
    }

    return "That's a great question about the Value Operating System! VOS is a comprehensive framework for understanding, creating, capturing, and distributing value. The key is to think systematically about how value flows through your organization and ecosystem.\n\nCould you tell me more about what specifically interests you about VOS? Are you looking to implement it in your organization, or would you like to understand a particular concept better?";
  };

  const handleSuggestedQuestion = (question: string) => {
    setInputMessage(question);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" asChild>
              <Link to="/academy/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Brain className="h-3 w-3 mr-1" />
              AI Tutor
            </Badge>
          </div>
          <h1 className="text-3xl font-bold mb-2">VOS AI Tutor</h1>
          <p className="text-muted-foreground">Get personalized help with your VOS learning journey</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Suggested Questions */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Suggested Questions
                </CardTitle>
                <CardDescription>Click to ask about these topics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {suggestedQuestions.map((question) => (
                  <Button
                    key={question.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-left h-auto p-3"
                    onClick={() => handleSuggestedQuestion(question.text)}
                  >
                    <div className="space-y-1">
                      <p className="text-sm">{question.text}</p>
                      <Badge variant="outline" className="text-xs">
                        {question.category}
                      </Badge>
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle>Conversation</CardTitle>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                      >
                        <div
                          className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                            }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                              }`}
                          >
                            {message.role === 'user' ? (
                              <User className="h-4 w-4" />
                            ) : (
                              <Bot className="h-4 w-4" />
                            )}
                          </div>
                          <div
                            className={`rounded-lg p-3 ${message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                              }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <p className="text-xs opacity-70 mt-1">
                              {formatTime(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {isLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="flex gap-3 max-w-[80%]">
                          <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                            <Bot className="h-4 w-4" />
                          </div>
                          <div className="bg-muted rounded-lg p-3">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-75" />
                              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-150" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      value={inputMessage}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputMessage(e.target.value)}
                      placeholder="Ask me anything about VOS..."
                      aria-label="Message input"
                      onKeyPress={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSendMessage()}
                      disabled={isLoading}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isLoading}
                      size="icon"
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    <Sparkles className="h-3 w-3 inline mr-1" />
                    Powered by VOS AI - Your personal learning assistant
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AITutor;
