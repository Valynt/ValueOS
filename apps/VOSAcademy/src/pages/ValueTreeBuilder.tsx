/**
 * Interactive Value Tree Builder Exercise
 * Allows users to practice building Value Trees - a core VOS framework concept
 */

import { useState } from "react";

import { SidebarLayout } from "@/components/SidebarLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Icons } from "@/lib/icons";

interface ValueNode {
  id: string;
  type: 'outcome' | 'capability' | 'kpi';
  title: string;
  description: string;
  children: ValueNode[];
  metrics?: {
    baseline?: number;
    target?: number;
    timeframe?: string;
    unit?: string;
  };
}

interface ValueTreeExercise {
  id: string;
  title: string;
  description: string;
  scenario: string;
  pillars: number[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number;
  objectives: string[];
}

const SAMPLE_EXERCISES: ValueTreeExercise[] = [
  {
    id: "customer-retention",
    title: "Customer Retention Value Tree",
    description: "Build a Value Tree for a customer retention initiative",
    scenario: "Your SaaS company is losing 15% of customers annually. Build a Value Tree to quantify and prioritize retention initiatives.",
    pillars: [1, 2, 3, 6],
    difficulty: "intermediate",
    estimatedTime: 20,
    objectives: [
      "Identify 3-5 key business outcomes",
      "Map supporting capabilities for each outcome",
      "Define measurable KPIs with baselines and targets",
      "Calculate total potential value impact"
    ]
  },
  {
    id: "sales-efficiency",
    title: "Sales Process Optimization",
    description: "Create a Value Tree for sales efficiency improvements",
    scenario: "Your sales cycle is 45 days on average, with 60% win rate. Build a Value Tree to identify efficiency improvements.",
    pillars: [1, 3, 7],
    difficulty: "beginner",
    estimatedTime: 15,
    objectives: [
      "Map current sales process outcomes",
      "Identify bottleneck capabilities",
      "Quantify time and conversion improvements",
      "Calculate revenue acceleration impact"
    ]
  },
  {
    id: "digital-transformation",
    title: "Digital Transformation Initiative",
    description: "Comprehensive Value Tree for enterprise digital transformation",
    scenario: "Your organization is undertaking a major digital transformation. Build a complete Value Tree covering operational, customer, and financial outcomes.",
    pillars: [1, 2, 4, 8, 9],
    difficulty: "advanced",
    estimatedTime: 35,
    objectives: [
      "Create multi-level outcome hierarchy",
      "Map cross-functional capabilities",
      "Define comprehensive KPI framework",
      "Calculate transformation ROI"
    ]
  }
];

export default function ValueTreeBuilder() {
  const [selectedExercise, setSelectedExercise] = useState<ValueTreeExercise | null>(null);
  const [valueTree, setValueTree] = useState<ValueNode[]>([]);
  const [currentNode, setCurrentNode] = useState<ValueNode | null>(null);
  const [newNode, setNewNode] = useState({
    type: 'outcome' as ValueNode['type'],
    title: '',
    description: '',
    baseline: '',
    target: '',
    timeframe: '6 months',
    unit: ''
  });

  const handleStartExercise = (exercise: ValueTreeExercise) => {
    setSelectedExercise(exercise);
    setValueTree([]);
    setCurrentNode(null);
  };

  const addNode = (parentId?: string) => {
    if (!newNode.title.trim()) return;

    const node: ValueNode = {
      id: Date.now().toString(),
      type: newNode.type,
      title: newNode.title,
      description: newNode.description,
      children: [],
      metrics: newNode.baseline || newNode.target ? {
        baseline: newNode.baseline ? Number(newNode.baseline) : undefined,
        target: newNode.target ? Number(newNode.target) : undefined,
        timeframe: newNode.timeframe,
        unit: newNode.unit
      } : undefined
    };

    if (parentId) {
      // Add as child to existing node
      setValueTree(prev => prev.map(n => {
        if (n.id === parentId) {
          return { ...n, children: [...n.children, node] };
        }
        return n;
      }));
    } else {
      // Add as root node
      setValueTree(prev => [...prev, node]);
    }

    setNewNode({
      type: 'outcome',
      title: '',
      description: '',
      baseline: '',
      target: '',
      timeframe: '6 months',
      unit: ''
    });
  };

  const removeNode = (nodeId: string, parentId?: string) => {
    if (parentId) {
      setValueTree(prev => prev.map(n => {
        if (n.id === parentId) {
          return { ...n, children: n.children.filter(c => c.id !== nodeId) };
        }
        return n;
      }));
    } else {
      setValueTree(prev => prev.filter(n => n.id !== nodeId));
    }
  };

  const renderValueNode = (node: ValueNode, parentId?: string, level = 0) => {
    const indent = level * 20;

    return (
      <div key={node.id} className="relative">
        <div
          className={`p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
            node.type === 'outcome' ? 'border-blue-200 bg-blue-50 dark:bg-blue-950' :
            node.type === 'capability' ? 'border-green-200 bg-green-50 dark:bg-green-950' :
            'border-purple-200 bg-purple-50 dark:bg-purple-950'
          }`}
          style={{ marginLeft: `${indent}px` }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {node.type === 'outcome' && <Icons.Target className="w-4 h-4 text-blue-600" />}
                {node.type === 'capability' && <Icons.Zap className="w-4 h-4 text-green-600" />}
                {node.type === 'kpi' && <Icons.TrendingUp className="w-4 h-4 text-purple-600" />}
                <span className="font-medium text-sm">{node.title}</span>
                <Badge variant="outline" className="text-xs">
                  {node.type}
                </Badge>
              </div>
              {node.description && (
                <p className="text-xs text-muted-foreground mb-2">{node.description}</p>
              )}
              {node.metrics && (
                <div className="flex items-center gap-2 text-xs">
                  {node.metrics.baseline !== undefined && (
                    <span>Baseline: {node.metrics.baseline}{node.metrics.unit}</span>
                  )}
                  {node.metrics.target !== undefined && (
                    <span>Target: {node.metrics.target}{node.metrics.unit}</span>
                  )}
                  {node.metrics.timeframe && (
                    <span className="text-muted-foreground">({node.metrics.timeframe})</span>
                  )}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeNode(node.id, parentId)}
              className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
            >
              <Icons.Minus className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Child nodes */}
        {node.children.map(child => renderValueNode(child, node.id, level + 1))}

        {/* Add child button */}
        <div style={{ marginLeft: `${indent + 20}px` }} className="mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentNode(node)}
            className="text-xs"
          >
            <Icons.Plus className="w-3 h-3 mr-1" />
            Add {node.type === 'outcome' ? 'Capability' : 'KPI'}
          </Button>
        </div>
      </div>
    );
  };

  const calculateValueImpact = () => {
    let totalValue = 0;

    const calculateNodeValue = (node: ValueNode): number => {
      let nodeValue = 0;

      // Calculate KPI value
      if (node.type === 'kpi' && node.metrics?.baseline && node.metrics?.target) {
        const improvement = node.metrics.target - node.metrics.baseline;
        // Rough estimate: $10,000 per KPI point improvement
        nodeValue = improvement * 10000;
      }

      // Add children values
      node.children.forEach(child => {
        nodeValue += calculateNodeValue(child);
      });

      return nodeValue;
    };

    valueTree.forEach(node => {
      totalValue += calculateNodeValue(node);
    });

    return totalValue;
  };

  if (!selectedExercise) {
    return (
      <SidebarLayout>
        <div className="container py-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Icons.TreePine className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">Value Tree Builder</h1>
                <p className="text-muted-foreground">
                  Practice building Value Trees - the foundation of quantifiable value creation
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SAMPLE_EXERCISES.map((exercise) => (
              <Card
                key={exercise.id}
                className="bg-card text-card-foreground shadow-beautiful-md hover:shadow-beautiful-lg rounded-lg transition-all duration-300 hover:-translate-y-1"
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant={
                      exercise.difficulty === "beginner" ? "secondary" :
                      exercise.difficulty === "intermediate" ? "default" : "destructive"
                    }>
                      {exercise.difficulty}
                    </Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Icons.Clock className="w-4 h-4" />
                      {exercise.estimatedTime}m
                    </div>
                  </div>
                  <CardTitle className="text-xl">{exercise.title}</CardTitle>
                  <CardDescription>{exercise.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <h4 className="font-semibold text-sm mb-2">Scenario:</h4>
                      <p className="text-sm text-muted-foreground">{exercise.scenario}</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Learning Objectives:</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {exercise.objectives.map((objective, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <Icons.CheckCircle2 className="w-3 h-3 mt-0.5 text-green-600 flex-shrink-0" />
                            {objective}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {exercise.pillars.map(pillar => (
                        <Badge key={pillar} variant="outline" className="text-xs">
                          Pillar {pillar}
                        </Badge>
                      ))}
                    </div>

                    <Button
                      onClick={() => handleStartExercise(exercise)}
                      className="w-full shadow-light-blue-sm"
                    >
                      Start Exercise
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="container py-8 max-w-6xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => setSelectedExercise(null)}>
            ← Back to Exercises
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Exercise Info & Tree Display */}
          <div className="lg:col-span-2 space-y-6">
            {/* Exercise Header */}
            <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg" role="region" aria-labelledby="exercise-header">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg" aria-hidden="true">
                    <Icons.TreePine className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle id="exercise-header" className="text-xl">{selectedExercise.title}</CardTitle>
                    <CardDescription>{selectedExercise.description}</CardDescription>
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg" role="region" aria-labelledby="scenario-heading">
                  <h4 id="scenario-heading" className="font-semibold mb-2">Scenario:</h4>
                  <p className="text-sm">{selectedExercise.scenario}</p>
                </div>
              </CardHeader>
            </Card>

            {/* Value Tree Display */}
            <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg" role="region" aria-labelledby="value-tree-heading">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" id="value-tree-heading">
                  <Icons.TreePine className="w-5 h-5" aria-hidden="true" />
                  Your Value Tree
                </CardTitle>
                <CardDescription>
                  Build your value hierarchy from outcomes down to measurable KPIs
                </CardDescription>
              </CardHeader>
              <CardContent>
                {valueTree.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground" role="status" aria-live="polite">
                    <Icons.TreePine className="h-16 w-16 mx-auto mb-4 opacity-50" aria-hidden="true" />
                    <p>Start by adding your first business outcome</p>
                  </div>
                ) : (
                  <div className="space-y-4" role="tree" aria-label="Value tree hierarchy">
                    {valueTree.map(node => renderValueNode(node))}
                  </div>
                )}

                {/* Value Impact Summary */}
                {valueTree.length > 0 && (
                  <div className="mt-6 p-4 bg-primary/5 border-l-4 border-primary rounded-r-lg" role="region" aria-labelledby="value-impact-heading">
                    <div className="flex items-center gap-2 mb-2">
                      <Icons.DollarSign className="w-5 h-5 text-primary" aria-hidden="true" />
                      <span id="value-impact-heading" className="font-semibold">Estimated Value Impact</span>
                    </div>
                    <div className="text-2xl font-bold text-primary" aria-label={`Estimated value impact: $${calculateValueImpact().toLocaleString()}`}>
                      ${calculateValueImpact().toLocaleString()}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Total potential value based on KPI improvements
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Node Builder Panel */}
          <div className="space-y-6">
            <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg" role="region" aria-labelledby="node-builder-heading">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" id="node-builder-heading">
                  <Icons.Plus className="w-5 h-5" aria-hidden="true" />
                  {currentNode ? `Add to ${currentNode.title}` : 'Add Node'}
                </CardTitle>
                <CardDescription>
                  {currentNode
                    ? `Adding a ${currentNode.type === 'outcome' ? 'capability' : 'KPI'} to support this ${currentNode.type}`
                    : 'Start with a business outcome or add to an existing node'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!currentNode && (
                  <div className="space-y-2">
                    <Label htmlFor="node-type-select">Node Type</Label>
                    <Select
                      value={newNode.type}
                      onValueChange={(value: ValueNode['type']) =>
                        setNewNode(prev => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger id="node-type-select" aria-label="Select node type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="outcome">Business Outcome</SelectItem>
                        <SelectItem value="capability">Supporting Capability</SelectItem>
                        <SelectItem value="kpi">Measurable KPI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="node-title-input">Title</Label>
                  <Input
                    id="node-title-input"
                    placeholder={
                      currentNode
                        ? currentNode.type === 'outcome' ? 'e.g., Improve customer retention' : 'e.g., Customer retention rate'
                        : newNode.type === 'outcome' ? 'e.g., Increase revenue by 25%' : 'Enter title...'
                    }
                    value={newNode.title}
                    onChange={(e) => setNewNode(prev => ({ ...prev, title: e.target.value }))}
                    aria-describedby="title-help"
                  />
                  <div id="title-help" className="sr-only">
                    Enter a descriptive title for this value tree node
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="node-description-textarea">Description</Label>
                  <Textarea
                    id="node-description-textarea"
                    placeholder={
                      currentNode
                        ? currentNode.type === 'outcome' ? 'How does this capability support the outcome?' : 'How will this KPI measure success?'
                        : 'Describe this element...'
                    }
                    value={newNode.description}
                    onChange={(e) => setNewNode(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    aria-describedby="description-help"
                  />
                  <div id="description-help" className="sr-only">
                    Provide additional details about this value tree element
                  </div>
                </div>

                {(newNode.type === 'kpi' || (currentNode && currentNode.type === 'capability')) && (
                  <div className="space-y-4 p-4 bg-muted rounded-lg" role="group" aria-labelledby="metrics-heading">
                    <h4 id="metrics-heading" className="font-semibold text-sm">Metrics (Optional)</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="baseline-input" className="text-xs">Baseline</Label>
                        <Input
                          id="baseline-input"
                          type="number"
                          placeholder="Current value"
                          value={newNode.baseline}
                          onChange={(e) => setNewNode(prev => ({ ...prev, baseline: e.target.value }))}
                          aria-describedby="baseline-help"
                        />
                        <div id="baseline-help" className="sr-only">
                          Enter the current baseline value for this metric
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="target-input" className="text-xs">Target</Label>
                        <Input
                          id="target-input"
                          type="number"
                          placeholder="Goal value"
                          value={newNode.target}
                          onChange={(e) => setNewNode(prev => ({ ...prev, target: e.target.value }))}
                          aria-describedby="target-help"
                        />
                        <div id="target-help" className="sr-only">
                          Enter the target goal value for this metric
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="timeframe-select" className="text-xs">Timeframe</Label>
                        <Select
                          value={newNode.timeframe}
                          onValueChange={(value) => setNewNode(prev => ({ ...prev, timeframe: value }))}
                        >
                          <SelectTrigger id="timeframe-select" aria-label="Select timeframe">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3 months">3 months</SelectItem>
                            <SelectItem value="6 months">6 months</SelectItem>
                            <SelectItem value="1 year">1 year</SelectItem>
                            <SelectItem value="2 years">2 years</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="unit-input" className="text-xs">Unit</Label>
                        <Input
                          id="unit-input"
                          placeholder="% or $ or #"
                          value={newNode.unit}
                          onChange={(e) => setNewNode(prev => ({ ...prev, unit: e.target.value }))}
                          aria-describedby="unit-help"
                        />
                        <div id="unit-help" className="sr-only">
                          Enter the unit of measurement (e.g., %, $, #)
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => addNode(currentNode?.id)}
                  disabled={!newNode.title.trim()}
                  className="w-full"
                  aria-describedby="add-node-status"
                >
                  {currentNode ? 'Add to Node' : 'Add Node'}
                </Button>
                <div id="add-node-status" className="sr-only">
                  {newNode.title.trim() ? 'Ready to add node' : 'Node title is required'}
                </div>

                {currentNode && (
                  <Button
                    variant="outline"
                    onClick={() => setCurrentNode(null)}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Learning Objectives */}
            <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg" role="region" aria-labelledby="objectives-heading">
              <CardHeader>
                <CardTitle id="objectives-heading" className="text-lg">Learning Objectives</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2" role="list" aria-label="Learning objectives">
                  {selectedExercise.objectives.map((objective, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm" role="listitem">
                      <Icons.CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" aria-hidden="true" />
                      {objective}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
