> **Superseded by [V1 Product Design Brief](../openspec/specs/v1-product-vision/spec.md)** — retained for historical reference.

# Product Definition: ValueOS

## Executive Summary
**ValueOS** is a "Command Console" for Value Engineers (VEs), designed to transform ambiguous sales opportunities into rigorous, decision-grade business cases. It transitions Value Engineering from a fragmented, qualitative exercise into a high-precision, decision-grade engine.

## Mission
To automate the heavy lifting of data synthesis, financial modeling, and narrative construction, allowing VEs to focus on strategic alignment and executive-level validation. The goal is to produce outcomes that are empirically "CFO-defensible."

## Core Philosophy: Hypothesis-First
ValueOS rejects the "Chatbot" paradigm in favor of a **Hypothesis-First** approach. The system proactively generates a financial thesis based on initial discovery signals and then iterates through a rigorous validation loop.

## Key Components
- **Hypothesis Loop**: A 7-step loop (Hypothesis → Model → Evidence → Narrative → Objection → Revision → Approval).
- **Integrity Engine**: A ground truth layer that prevents "hallucinated ROI" through evidence tiering and confidence scoring.
- **Saga-Driven Orchestration**: Distributed Saga Pattern to manage multi-agent interactions with explicit state machine transitions and compensation logic.
- **Server-Driven UI (SDUI)**: Dynamic interface that adapts to agent outputs in real-time.

## Success Metric (The Final Gate)
"Can a senior Value Engineer walk into a boardroom and defend a $10M claim using the ValueOS output without hand-waving or manual spreadsheet verification?"
