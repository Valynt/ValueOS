    "Slide 5: Customer success story",
    "Slides 6-7: Expansion opportunity",
    "Slide 8: Next steps/timeline"
  ]
}
```

### Scoring Criteria

**Technical (40 points):**
- Value quantification accuracy (15 pts)
- Business case structure and logic (15 pts)
- Data analysis and insights (10 pts)

**Cross-Functional (30 points):**
- Storytelling and narrative quality (10 pts)
- Executive communication (10 pts)
- Strategic thinking (expansion prioritization) (10 pts)

**AI Augmentation (30 points):**
- Use of AI for data analysis (10 pts)
- Prompt engineering for narrative/presentation (10 pts)
- Efficiency and polish (10 pts)

**Passing Score:** 80/100

---

## API Endpoints

### Existing Endpoints (No Changes Required)

All existing simulation endpoints support the new simulation types through the flexible `scenarioData` JSON field:

```typescript
// Get all available scenarios (includes new types)
simulations.getScenarios: publicProcedure
  .input(z.object({
    type: z.enum(['value_discovery', 'business_case', 'qbr_expansion']).optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    pillarId: z.number().optional(),
  }))
  .query(async ({ input }) => {
    return await db.getSimulationScenarios(input);
  });

// Get specific scenario details
simulations.getScenario: publicProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ input }) => {
    return await db.getSimulationScenario(input.id);
  });

// Submit completed simulation attempt
simulations.submitAttempt: protectedProcedure
  .input(z.object({
    scenarioId: z.number(),
    responsesData: z.array(z.object({
      stepNumber: z.number(),
      userResponse: z.string(),
    })),
    timeSpent: z.number().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    // AI evaluation happens here
    const evaluation = await evaluateSimulationAttempt(input);
    return await db.createSimulationAttempt({
      userId: ctx.user.id,
      scenarioId: input.scenarioId,
      ...evaluation,
    });
  });

// Get user's attempt history
simulations.getUserAttempts: protectedProcedure
  .input(z.object({
    scenarioId: z.number().optional(),
  }))
  .query(async ({ input, ctx }) => {
    return await db.getUserSimulationAttempts(ctx.user.id, input.scenarioId);
  });
```

### New Helper Functions (Backend)

```typescript
// server/simulation-evaluator.ts

/**
 * Evaluate simulation attempt using AI
 */
async function evaluateSimulationAttempt(attempt: {
  scenarioId: number;
  responsesData: Array<{ stepNumber: number; userResponse: string }>;
}): Promise<SimulationEvaluation> {
  const scenario = await db.getSimulationScenario(attempt.scenarioId);
  
  // Evaluate each step response
  const stepEvaluations = await Promise.all(
    attempt.responsesData.map(response => 
      evaluateStep(scenario, response)
    )
  );
  
  // Calculate category scores (40/30/30 rubric)
  const categoryScores = calculateCategoryScores(stepEvaluations, scenario.type);
  
  // Calculate overall score
  const overallScore = 
    categoryScores.technical * 0.4 +
    categoryScores.crossFunctional * 0.3 +
    categoryScores.aiAugmentation * 0.3;
  
  return {
    responsesData: stepEvaluations,
    overallScore: Math.round(overallScore),
    categoryScores,
    passed: overallScore >= 80,
    feedback: generateOverallFeedback(stepEvaluations, overallScore),
  };
}

/**
 * Evaluate individual step using AI
 */
async function evaluateStep(
  scenario: SimulationScenario,
  response: { stepNumber: number; userResponse: string }
): Promise<StepEvaluation> {
  const step = scenario.scenarioData.steps.find(
    s => s.stepNumber === response.stepNumber
  );
  
  const prompt = buildEvaluationPrompt(scenario, step, response.userResponse);
  const aiResponse = await invokeLLM({
    messages: [
      { role: "system", content: SIMULATION_EVALUATOR_SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "step_evaluation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            score: { type: "number", description: "Score 0-100" },
            strengths: { 
              type: "array", 