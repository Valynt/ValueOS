import { Bot, Briefcase, Clock, DollarSign, FileText, MessageSquare, Plus, Send, Target, TrendingUp, User, Users, X } from "lucide-react";
import { useState } from "react";

import { SidebarLayout } from "@/components/SidebarLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ValueCaseData {
  pillarId: number;
  outcomes: string[];
  capabilities: string[];
  kpis: Array<{
    name: string;
    baseline: number;
    target: number;
    timeframe: string;
  }>;
  costs: {
    implementation: number;
    licensing?: number;
    training?: number;
  };
  audience: 'executive' | 'finance' | 'technical';
}

interface ROIData {
  businessCase: string;
  benefits: string[];
  costs: {
    implementation: number;
    licensing?: number;
    training?: number;
  };
  timeframe: '1year' | '2years' | '3years';
  audience: 'executive' | 'finance' | 'technical';
}

interface ROINarrativeFinancials {
  totalCosts: number;
  totalBenefits: number;
  roi: string;
}

interface ValueCaseSummary {
  pillarTitle: string;
  totalOutcomes: number;
  totalCapabilities: number;
  totalKPIs: number;
  estimatedCosts: number;
  estimatedBenefits: number;
  roi: string;
}

export default function AITutorPage() {
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your VOS AI Tutor. I can help you with value engineering concepts, provide guidance on the VOS methodology, and assist with practical applications. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');

  // ROI Narrative state
  const [roiData, setRoiData] = useState<ROIData>({
    businessCase: '',
    benefits: [],
    costs: { implementation: 0 },
    timeframe: '3years',
    audience: 'executive'
  });
  const [newBenefit, setNewBenefit] = useState('');
  const [roiNarrative, setRoiNarrative] = useState<string | null>(null);
  const [roiFinancials, setRoiFinancials] = useState<ROINarrativeFinancials | null>(null);

  // Value Case state
  const [valueCaseData, setValueCaseData] = useState<ValueCaseData>({
    pillarId: 1,
    outcomes: [],
    capabilities: [],
    kpis: [],
    costs: { implementation: 0 },
    audience: 'executive'
  });
  const [newOutcome, setNewOutcome] = useState('');
  const [newCapability, setNewCapability] = useState('');
  const [newKPI, setNewKPI] = useState({ name: '', baseline: 0, target: 0, timeframe: '3 months' });
  const [valueCase, setValueCase] = useState<string | null>(null);
  const [valueCaseSummary, setValueCaseSummary] = useState<ValueCaseSummary | null>(null);

  const chatMutation = trpc.ai.chat.useMutation();
  const roiMutation = trpc.ai.roiNarrative.useMutation();
  const valueCaseMutation = trpc.ai.valueCase.useMutation();

  const { data: pillars } = trpc.pillars.list.useQuery();

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await chatMutation.mutateAsync({
        messages: [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: input }
        ]
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const addBenefit = () => {
    if (newBenefit.trim()) {
      setRoiData(prev => ({
        ...prev,
        benefits: [...prev.benefits, newBenefit.trim()]
      }));
      setNewBenefit('');
    }
  };

  const removeBenefit = (index: number) => {
    setRoiData(prev => ({
      ...prev,
      benefits: prev.benefits.filter((_, i) => i !== index)
    }));
  };

  const handleGenerateROINarrative = async () => {
    try {
      const response = await roiMutation.mutateAsync(roiData);
      setRoiNarrative(response.narrative);
      setRoiFinancials(response.financials);
    } catch (error) {
      console.error('Error generating ROI narrative:', error);
    }
  };

  const addOutcome = () => {
    if (newOutcome.trim()) {
      setValueCaseData(prev => ({
        ...prev,
        outcomes: [...prev.outcomes, newOutcome.trim()]
      }));
      setNewOutcome('');
    }
  };

  const removeOutcome = (index: number) => {
    setValueCaseData(prev => ({
      ...prev,
      outcomes: prev.outcomes.filter((_, i) => i !== index)
    }));
  };

  const addCapability = () => {
    if (newCapability.trim()) {
      setValueCaseData(prev => ({
        ...prev,
        capabilities: [...prev.capabilities, newCapability.trim()]
      }));
      setNewCapability('');
    }
  };

  const removeCapability = (index: number) => {
    setValueCaseData(prev => ({
      ...prev,
      capabilities: prev.capabilities.filter((_, i) => i !== index)
    }));
  };

  const addKPI = () => {
    if (newKPI.name.trim() && newKPI.target > newKPI.baseline) {
      setValueCaseData(prev => ({
        ...prev,
        kpis: [...prev.kpis, { ...newKPI }]
      }));
      setNewKPI({ name: '', baseline: 0, target: 0, timeframe: '3 months' });
    }
  };

  const removeKPI = (index: number) => {
    setValueCaseData(prev => ({
      ...prev,
      kpis: prev.kpis.filter((_, i) => i !== index)
    }));
  };

  const handleGenerateValueCase = async () => {
    try {
      const response = await valueCaseMutation.mutateAsync(valueCaseData);
      setValueCase(response.valueCase);
      setValueCaseSummary(response.summary);
    } catch (error) {
      console.error('Error generating value case:', error);
    }
  };

  const tutorModes = [
    {
      id: 'chat',
      label: 'General Chat',
      icon: MessageSquare,
      description: 'General VOS methodology questions and guidance'
    },
    {
      id: 'kpi',
      label: 'KPI Hypothesis',
      icon: Target,
      description: 'Help developing and validating KPI hypotheses'
    },
    {
      id: 'roi',
      label: 'ROI Narrative',
      icon: TrendingUp,
      description: 'Craft compelling ROI narratives for business cases'
    },
    {
      id: 'value-case',
      label: 'Value Case',
      icon: Briefcase,
      description: 'Build comprehensive value cases using VOS framework'
    }
  ];

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Bot className="h-8 w-8 text-primary" />
              AI Tutor
            </h1>
            <p className="text-muted-foreground mt-2">
              Get personalized guidance on VOS methodology from your AI-powered tutor
            </p>
          </div>

          {/* Tutor Modes */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              {tutorModes.map((mode) => {
                const Icon = mode.icon;
                return (
                  <TabsTrigger key={mode.id} value={mode.id} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{mode.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* General Chat Tab */}
            <TabsContent value="chat" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    General Chat
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Ask me anything about VOS methodology, value engineering, or practical applications
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Chat Messages */}
                  <div className="h-96 overflow-y-auto space-y-4 p-4 border rounded-lg bg-muted/30">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex gap-2 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-secondary-foreground'
                          }`}>
                            {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                          </div>
                          <div className={`rounded-lg px-3 py-2 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card text-card-foreground border'
                          }`}>
                            <p className="text-sm">{message.content}</p>
                            <p className="text-xs opacity-70 mt-1">
                              {message.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Input Area */}
                  <div className="flex gap-2">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask me about VOS methodology..."
                      className="flex-1 min-h-[60px] resize-none"
                      disabled={chatMutation.isPending}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!input.trim() || chatMutation.isPending}
                      size="icon"
                      className="h-[60px] w-[60px]"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* KPI Hypothesis Tab */}
            <TabsContent value="kpi" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    KPI Hypothesis Builder
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Develop and validate KPI hypotheses for your value propositions
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">KPI Hypothesis Builder</h3>
                    <p className="text-muted-foreground mb-6">
                      This feature is coming soon! You'll be able to develop and validate KPI hypotheses
                      with guided prompts and validation frameworks.
                    </p>
                    <Button disabled>Coming Soon</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ROI Narrative Tab */}
            <TabsContent value="roi" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Form */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      ROI Narrative Builder
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Craft compelling ROI narratives for executive presentations and business cases
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Business Case */}
                    <div className="space-y-2">
                      <Label htmlFor="businessCase">Business Case Summary</Label>
                      <Textarea
                        id="businessCase"
                        placeholder="Describe your business case (e.g., 'Implement AI-powered customer service platform to improve response times and reduce costs')"
                        value={roiData.businessCase}
                        onChange={(e) => setRoiData(prev => ({ ...prev, businessCase: e.target.value }))}
                        rows={3}
                      />
                    </div>

                    {/* Benefits */}
                    <div className="space-y-2">
                      <Label>Key Benefits</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a benefit (e.g., 'Reduce customer churn by 25%')"
                          value={newBenefit}
                          onChange={(e) => setNewBenefit(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addBenefit()}
                        />
                        <Button onClick={addBenefit} size="icon" variant="outline">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {roiData.benefits.map((benefit, index) => (
                          <Badge key={index} variant="secondary" className="flex items-center gap-1">
                            {benefit}
                            <button
                              onClick={() => removeBenefit(index)}
                              className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Costs */}
                    <div className="space-y-4">
                      <Label>Cost Structure</Label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="implementation" className="text-sm">Implementation Cost</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="implementation"
                              type="number"
                              placeholder="50000"
                              className="pl-9"
                              value={roiData.costs.implementation || ''}
                              onChange={(e) => setRoiData(prev => ({
                                ...prev,
                                costs: { ...prev.costs, implementation: Number(e.target.value) || 0 }
                              }))}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="licensing" className="text-sm">Annual Licensing</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="licensing"
                              type="number"
                              placeholder="25000"
                              className="pl-9"
                              value={roiData.costs.licensing || ''}
                              onChange={(e) => setRoiData(prev => ({
                                ...prev,
                                costs: { ...prev.costs, licensing: Number(e.target.value) || undefined }
                              }))}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="training" className="text-sm">Training Cost</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="training"
                              type="number"
                              placeholder="10000"
                              className="pl-9"
                              value={roiData.costs.training || ''}
                              onChange={(e) => setRoiData(prev => ({
                                ...prev,
                                costs: { ...prev.costs, training: Number(e.target.value) || undefined }
                              }))}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timeframe and Audience */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Timeframe</Label>
                        <Select
                          value={roiData.timeframe}
                          onValueChange={(value: '1year' | '2years' | '3years') =>
                            setRoiData(prev => ({ ...prev, timeframe: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1year">1 Year</SelectItem>
                            <SelectItem value="2years">2 Years</SelectItem>
                            <SelectItem value="3years">3 Years</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Target Audience</Label>
                        <Select
                          value={roiData.audience}
                          onValueChange={(value: 'executive' | 'finance' | 'technical') =>
                            setRoiData(prev => ({ ...prev, audience: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="executive">Executive Leadership</SelectItem>
                            <SelectItem value="finance">Finance/CFO</SelectItem>
                            <SelectItem value="technical">Technical/IT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button
                      onClick={handleGenerateROINarrative}
                      disabled={!roiData.businessCase || roiData.benefits.length === 0 || roiMutation.isPending}
                      className="w-full"
                    >
                      {roiMutation.isPending ? 'Generating...' : 'Generate ROI Narrative'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Generated Narrative */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Generated ROI Narrative
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {roiFinancials && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {roiFinancials.roi}%
                          </div>
                          <div className="text-xs text-muted-foreground">ROI</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            {roiFinancials.paybackPeriod}y
                          </div>
                          <div className="text-xs text-muted-foreground">Payback</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            ${roiFinancials.totalBenefits.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">Benefits</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            ${roiFinancials.totalCosts.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">Costs</div>
                        </div>
                      </div>
                    )}

                    {roiNarrative ? (
                      <div className="prose prose-sm max-w-none">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {roiNarrative}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p>Fill out the form and click "Generate ROI Narrative" to create a compelling business case</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Value Case Tab */}
            <TabsContent value="value-case" className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Input Form */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Value Case Builder
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Build comprehensive value cases using the complete VOS framework
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Pillar Selection */}
                    <div className="space-y-2">
                      <Label>Target Pillar</Label>
                      <Select
                        value={valueCaseData.pillarId.toString()}
                        onValueChange={(value) => setValueCaseData(prev => ({
                          ...prev,
                          pillarId: parseInt(value)
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {pillars?.map((pillar) => (
                            <SelectItem key={pillar.id} value={pillar.id.toString()}>
                              Pillar {pillar.pillarNumber}: {pillar.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Outcomes */}
                    <div className="space-y-2">
                      <Label>Business Outcomes</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g., Reduce customer churn by 25%"
                          value={newOutcome}
                          onChange={(e) => setNewOutcome(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addOutcome()}
                        />
                        <Button onClick={addOutcome} size="icon" variant="outline">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {valueCaseData.outcomes.map((outcome, index) => (
                          <Badge key={index} variant="secondary" className="flex items-center gap-1">
                            {outcome}
                            <button
                              onClick={() => removeOutcome(index)}
                              className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Capabilities */}
                    <div className="space-y-2">
                      <Label>Solution Capabilities</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g., AI-powered customer health scoring"
                          value={newCapability}
                          onChange={(e) => setNewCapability(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addCapability()}
                        />
                        <Button onClick={addCapability} size="icon" variant="outline">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {valueCaseData.capabilities.map((capability, index) => (
                          <Badge key={index} variant="secondary" className="flex items-center gap-1">
                            {capability}
                            <button
                              onClick={() => removeCapability(index)}
                              className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* KPIs */}
                    <div className="space-y-4">
                      <Label>Key Performance Indicators</Label>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <Input
                          placeholder="KPI name"
                          value={newKPI.name}
                          onChange={(e) => setNewKPI(prev => ({ ...prev, name: e.target.value }))}
                        />
                        <Input
                          type="number"
                          placeholder="Baseline"
                          value={newKPI.baseline || ''}
                          onChange={(e) => setNewKPI(prev => ({ ...prev, baseline: Number(e.target.value) || 0 }))}
                        />
                        <Input
                          type="number"
                          placeholder="Target"
                          value={newKPI.target || ''}
                          onChange={(e) => setNewKPI(prev => ({ ...prev, target: Number(e.target.value) || 0 }))}
                        />
                        <div className="flex gap-1">
                          <Select
                            value={newKPI.timeframe}
                            onValueChange={(value) => setNewKPI(prev => ({ ...prev, timeframe: value }))}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3 months">3 months</SelectItem>
                              <SelectItem value="6 months">6 months</SelectItem>
                              <SelectItem value="1 year">1 year</SelectItem>
                              <SelectItem value="2 years">2 years</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button onClick={addKPI} size="icon" variant="outline">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {valueCaseData.kpis.map((kpi, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                            <div className="flex-1">
                              <span className="font-medium">{kpi.name}</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                {kpi.baseline} → {kpi.target} ({kpi.timeframe})
                              </span>
                            </div>
                            <button
                              onClick={() => removeKPI(index)}
                              className="hover:bg-destructive hover:text-destructive-foreground rounded p-1"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Costs */}
                    <div className="space-y-4">
                      <Label>Cost Structure</Label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="vc-implementation" className="text-sm">Implementation Cost</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="vc-implementation"
                              type="number"
                              placeholder="50000"
                              className="pl-9"
                              value={valueCaseData.costs.implementation || ''}
                              onChange={(e) => setValueCaseData(prev => ({
                                ...prev,
                                costs: { ...prev.costs, implementation: Number(e.target.value) || 0 }
                              }))}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vc-licensing" className="text-sm">Annual Licensing</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="vc-licensing"
                              type="number"
                              placeholder="25000"
                              className="pl-9"
                              value={valueCaseData.costs.licensing || ''}
                              onChange={(e) => setValueCaseData(prev => ({
                                ...prev,
                                costs: { ...prev.costs, licensing: Number(e.target.value) || undefined }
                              }))}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vc-training" className="text-sm">Training Cost</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="vc-training"
                              type="number"
                              placeholder="10000"
                              className="pl-9"
                              value={valueCaseData.costs.training || ''}
                              onChange={(e) => setValueCaseData(prev => ({
                                ...prev,
                                costs: { ...prev.costs, training: Number(e.target.value) || undefined }
                              }))}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Target Audience */}
                    <div className="space-y-2">
                      <Label>Target Audience</Label>
                      <Select
                        value={valueCaseData.audience}
                        onValueChange={(value: 'executive' | 'finance' | 'technical') =>
                          setValueCaseData(prev => ({ ...prev, audience: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="executive">Executive Leadership</SelectItem>
                          <SelectItem value="finance">Finance/CFO</SelectItem>
                          <SelectItem value="technical">Technical/IT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleGenerateValueCase}
                      disabled={
                        valueCaseData.outcomes.length === 0 ||
                        valueCaseData.capabilities.length === 0 ||
                        valueCaseData.kpis.length === 0 ||
                        valueCaseMutation.isPending
                      }
                      className="w-full"
                    >
                      {valueCaseMutation.isPending ? 'Generating...' : 'Generate Value Case'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Generated Value Case */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Generated Value Case
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {valueCaseSummary && (
                      <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {valueCaseSummary.totalOutcomes}
                          </div>
                          <div className="text-xs text-muted-foreground">Outcomes</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {valueCaseSummary.totalCapabilities}
                          </div>
                          <div className="text-xs text-muted-foreground">Capabilities</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {valueCaseSummary.totalKPIs}
                          </div>
                          <div className="text-xs text-muted-foreground">KPIs</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {valueCaseSummary.roi}%
                          </div>
                          <div className="text-xs text-muted-foreground">ROI</div>
                        </div>
                      </div>
                    )}

                    {valueCase ? (
                      <div className="prose prose-sm max-w-none">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed max-h-96 overflow-y-auto">
                          {valueCase}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p>Complete the form and click "Generate Value Case" to create a comprehensive business case</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SidebarLayout>
  );
}
