# Local Rules - Agent Job Descriptions

These rules define specific behaviors for individual agent types.
They can be customized per tenant.

---

## Scope of Authority

### LR-001: Tool Access Control
Each agent type has explicit allow/deny lists:

| Agent | Allowed | Denied | Requires Approval |
|-------|---------|--------|-------------------|
| Coordinator | plan_task, delegate_to_agent, summarize_results | execute_sql, modify_system_config | finalize_workflow |
| System Mapper | analyze_system, create_system_map, generate_diagram | modify_production_system, execute_commands | export_system_map |
| Outcome Engineer | build_value_tree, calculate_projections | modify_financial_records | finalize_value_tree |
| Communicator | send_message, format_report | send_external_email, post_to_social_media | send_to_executives |

### LR-002: Delegation Control
```
Coordinator → [All Agents]
System Mapper → [Communicator]
Outcome Engineer → [Value Eval, Communicator]
Realization Loop → [Outcome Engineer, Communicator]
```

---

## Behavioral Alignment

### LR-010: Response Quality Standards
**Block these patterns:**
- Empty or too short responses (< 10 chars)
- Unhelpful: "I don't know", "I can't help"
- Hyperbolic: "revolutionary", "game-changing", "guaranteed"

### LR-011: Persona Enforcement
**Block these patterns:**
- First-person opinions: "I think", "I believe", "I feel"
- Emotional language: "angry", "frustrated", "excited"
- Informal language: "gonna", "wanna", "kinda"
- Meta-references: "as an AI", "as a language model"

### LR-012: Uncertainty Handling
- If confidence < 60% on high-impact actions → require clarification
- High-impact actions: finalize, commit, publish, approve, submit

---

## Workflow Logic

### LR-020: Stage Transitions
Valid transitions only:
```
opportunity → target
target → expansion OR opportunity
expansion → integrity OR target
integrity → realization OR expansion
realization → integrity
```

### LR-021: Approval Thresholds
Require approval when:
- Expense > $500
- ROI Projection > $100,000
- Risk Score > 0.7
- Stakeholders > 10

### LR-022: Prerequisites
| Action | Required First |
|--------|----------------|
| build_value_tree | system_map_complete, opportunities_identified |
| calculate_roi | value_tree_complete, assumptions_documented |
| finalize_intervention | roi_calculated, risks_assessed |

---

## Error Handling

### LR-030: Graceful Degradation
| Service Failure | User Message | Action |
|-----------------|--------------|--------|
| Calendar API | "Cannot schedule meetings right now" | notify_and_continue |
| Database | "Let me try an alternative approach" | retry_with_cache |
| LLM Service | "Let me try a simpler approach" | use_fallback_model |
| External API | "Proceeding with available info" | continue_without_external |

### LR-031: Retry Policy
- **Non-retryable errors**: 400, 401, 403, 404, 422
- **Max retries**: Dev=5, Staging=3, Prod=2
- After max retries → escalate to human

---

## Resource Limits

### LR-040: Context Window
| Environment | Token Limit |
|-------------|-------------|
| Development | 100,000 |
| Staging | 50,000 |
| Production | 32,000 |

### LR-041: Memory Limit
| Environment | Memory Limit |
|-------------|--------------|
| Development | 10 MB |
| Staging | 5 MB |
| Production | 2 MB |

