# UX Audit: ValueOS First Production Release

**Role:** Principal Product Designer + UX Researcher
**Target Audience:** Engineering & Product Leadership
**Scope:** Current "Internal Sales Enablement" Application (First Production Release)

---

## 1. Product & User Journey Map

**Product Goal:** Empower sales reps to rapidly generate credible, data-driven business cases for prospects by leveraging AI agents.

**Jobs to Be Done (Current Release):**
1.  **Generate a Business Case:** Input prospect data -> AI analyzes -> Produces ROI/Value Model.
2.  **Export for Presentation:** Convert digital case into PDF/PPT for buyer meetings.
3.  **Manage Deal Pipeline:** Track multiple opportunities through the value lifecycle.

**User Types:**
*   **Sales Rep (Primary):** Needs speed, confidence in the numbers, and "click-and-done" simplicity. Not a technical user.
*   **Sales Manager (Secondary):** Needs visibility into team activity and deal quality.
*   **Viewer/Buyer (Tertiary - Future):** Currently served via exports, not direct login.

**The "Happy Path":**
1.  **Auth:** Rep logs in securely.
2.  **Context:** Rep selects a deal from CRM (or creates one).
3.  **Discovery:** Rep inputs raw notes/interview data.
4.  **Generation:** Rep clicks "Generate"; Agents execute opportunity analysis & financial modeling.
5.  **Review:** Rep sees a high-confidence "Opportunity Analysis" and "Financial Impact".
6.  **Value:** Rep exports the findings to share with the client.

---

## 2. Heuristic Scorecard

| Area | Score (1-5) | Evidence & Explanation |
| :--- | :---: | :--- |
| **First-run Experience** | **2/5** | **Current:** Lands on `DealsView` or `Home` with no clear "Start Here". `DealSelector` is functional but dry. <br>**Goal (5/5):** "Welcome, John. Let's build your first business case." + One-click "New Deal". |
| **Conversation Flow** | **1/5** | **Current:** The "Agent" is a progress bar (`BusinessCaseGenerator`). There is no conversation, just "Generate" -> Wait. This fails the "Natural Collaboration" promise. <br>**Goal (5/5):** "I've analyzed Acme Corp. I found 3 pain points. Should we focus on 'Supply Chain Efficiency'?" (Chat-driven refinement). |
| **System Status** | **4/5** | **Current:** `BusinessCaseGenerator` provides excellent feedback (`Analyzing discovery data...`, `Building value tree...`). User knows exactly what's happening. |
| **Trust & Safety** | **3/5** | **Current:** `OpportunityAnalysisPanel` shows "Confidence Scores" and "Data Sources". <br>**Gap:** Users cannot easily *edit* or *correct* the agent's assumptions if they are wrong (Read-only view). |
| **Error Handling** | **2/5** | **Current:** `onError` shows a toast. <br>**Goal (5/5):** "I couldn't calculate ROI because revenue data is missing. Please enter estimated annual revenue." (Recovery guidance). |
| **IA / Navigation** | **3/5** | **Current:** `LifecycleStageNav` is clear (`Opportunity` -> `Target` -> `Realization`). <br>**Gap:** Tabs are rigid. Navigation feels like a wizard, not a workspace. |
| **Visual Design** | **3/5** | **Current:** Clean `shadcn/ui` components. Standard SaaS look. <br>**Gap:** Lacks "Consumer-grade" polish (motion, spacing, empty states are generic). |

---

## 3. Scenario Walkthroughs

### A) First-time User: Create Deal & Generate
*   **Expectation:** "I want to impress my prospect with an ROI calculation."
*   **Reality:**
    1.  Click "New Deal" -> Modal appears (Functional).
    2.  Land on `DealsView`. Empty state.
    3.  Select "Discovery Phase".
    4.  Select Persona.
    5.  Click "Generate".
    6.  Watch progress bars.
    7.  See static results panel.
*   **Friction:** The user is a spectator, not a collaborator. If the AI guesses the wrong "Industry", the user is stuck.
*   **Fix:** **Proactive Agent Entry.** "I see you added Acme Corp (Retail). I can look up their 10-K report to start. Shall I?"

### B) Return User: Resume Work
*   **Expectation:** "Where did I leave off with Acme?"
*   **Reality:** `DealsView` loads the list. Clicking a deal loads the last stage.
*   **Friction:** No summary of *recent* changes. "Did the agent finish that update?"
*   **Fix:** **Activity Feed.** "Last updated 2 hours ago: Financial model recalculated based on new margin data."

### C) Multi-step Workflow: Refinement
*   **Expectation:** "The margin is actually 15%, not 10%. Change it."
*   **Reality:** The `OpportunityAnalysisPanel` is read-only. The `BusinessCaseGenerator` is a "Re-run all" button.
*   **Critical Fail:** User cannot tweak inputs without re-running the whole heavy process (or functionality is hidden).
*   **Fix:** **Editable Artifacts.** Click the "10%" -> Type "15%" -> Agent replies "Recalculating ROI... New NPV is $1.2M."

### D) Error Scenario: Missing Data
*   **Expectation:** "I don't know the exact revenue."
*   **Reality:** Agent likely fails or makes a wild guess with low confidence.
*   **Fix:** **Smart Defaults.** "I couldn't find exact revenue. I've used $50M based on industry average for mid-size retail. Is this close?"

### E) Admin: Team View
*   **Expectation:** "Who is using the tool effectively?"
*   **Reality:** Admin views exist but are likely tabular lists.
*   **Fix:** **Usage Insights.** "Team A generated $50M in value cases this week."

---

## 4. Punch List (Prioritized)

### P0: Release Blocking (Critical UX Failures)
1.  **Lack of "Collaboration" (Agent is a Batch Process):**
    *   **Location:** `src/components/Deals/BusinessCaseGenerator.tsx`
    *   **Issue:** User clicks "Generate" and waits. No ability to steer, correct, or refine *during* or *after* generation without a full re-run.
    *   **Fix:** Replace "One-shot Generator" with a **Chat-Assisted Workspace**.
        *   Split screen: Chat (Left) + Live Canvas (Right).
        *   User says: "Analyze Acme."
        *   Agent updates Canvas: "Here is the draft."
        *   User says: "Change margin to 15%."
        *   Agent updates Canvas.

2.  **Read-Only Analysis Panels:**
    *   **Location:** `src/components/Deals/OpportunityAnalysisPanel.tsx`
    *   **Issue:** The UI renders static cards. Users cannot correct AI hallucinations.
    *   **Fix:** Make every data point (Revenue, Pain Points) clickable/editable.

### P1: Must-Fix for Consumer Feel
3.  **Empty State Paralysis:**
    *   **Location:** `src/views/DealsView.tsx` (when new deal created).
    *   **Issue:** User sees empty tabs.
    *   **Fix:** **Agent Greeting.** "Ready to start on Acme Corp? I can draft an opportunity map based on their website." (Call to Action).

4.  **Invisible "Why":**
    *   **Location:** Financial Metrics.
    *   **Issue:** "ROI: 400%". User asks "How?"
    *   **Fix:** **Traceability.** Hovering over "400%" highlights the input drivers (Cost Savings + Revenue Lift) in the UI.

### P2: Polish
5.  **Generic Loading States:**
    *   **Issue:** Spinners are boring.
    *   **Fix:** **Skeleton Screens** that "fill in" as the agent "thinks".

---

## 5. Agentic Interaction Model

We must move from **Input -> Batch Process -> Output** to **Collaborative Loop**.

**The Model:** "The Living Document"
*   **State 1: Discovery (Chat-led):** Agent asks questions. User answers.
*   **State 2: Drafting (Agent-led):** Agent "paints" the first version of the Canvas (Right side of screen).
*   **State 3: Refinement (User-led):** User clicks a number on the Canvas to change it. Agent notices: "Since you changed margin, I updated NPV."
*   **State 4: Finalization:** User clicks "Approve & Export".

**UI Layout:**
*   **Left Panel (30%):** **Agent Companion.** Threaded conversation. Explains changes. Asks for clarification.
*   **Right Panel (70%):** **The Value Canvas.** The "Truth". Rich, visual, interactive document.
*   **Floating Actions:** "Ask Agent to Refine", "Export".

---

## 6. Screen Redesign Specs (DealsView)

**Current:** `Tabs` (Opportunity, Target, Financial) with static cards.
**Proposed:** **Split-Pane Workspace**

**Layout:**
```
[ Header: Acme Corp | Stage: Discovery | [Export] [Share] ]
+-----------------------------------+---------------------------------------------------+
|  AGENT COMPANION (Left)           |  VALUE CANVAS (Right)                             |
|                                   |                                                   |
| [Agent Avatar]                    | [ Header: Opportunity Map ]                       |
| "I've analyzed Acme's 10-K.       |                                                   |
| They mention 'Supply Chain' 15x.  |  PAIN POINTS (Editable Cards)                     |
| Should we prioritize that?"       |  +---------------------------------------------+  |
|                                   |  | [!] Supply Chain Inefficiency           [x] |  |
| [ User Reply Input ]              |  | Est. Cost: $5M/yr (Click to edit)           |  |
| "Yes, focus on that."             |  +---------------------------------------------+  |
|                                   |                                                   |
| [Agent]                           |  BUSINESS OBJECTIVES                              |
| "Updating model..."               |  1. Reduce OpEx (Priority: High)                  |
|                                   |                                                   |
+-----------------------------------+---------------------------------------------------+
```

**Key Interaction:**
*   **Streaming:** The Canvas updates in real-time as the agent "types" or "thinks".
*   **Selection:** Clicking a card in Canvas highlights the relevant context in Chat.

---

## 7. Microcopy Rewrite

**Principle:** Speak Human, not System.

| Context | Old Copy | New Copy |
| :--- | :--- | :--- |
| **Generator Button** | "Generate Business Case" | "Draft Business Case" |
| **Progress** | "Executing OpportunityAgent..." | "Analyzing company data..." |
| **Error** | "Generation Failed" | "I hit a snag. Could you check the company URL?" |
| **Empty State** | "No data available" | "Let's gather some intelligence. Paste a URL or upload a doc." |
| **Success** | "Complete" | "Draft ready for review." |

---

## 8. Visual Polish Checklist

*   [ ] **Typography:** Use a tighter tracking for data numbers (Inter/Geist Mono).
*   [ ] **Spacing:** Increase padding on Cards from `p-4` to `p-6` for "breathing room".
*   [ ] **Motion:** Add `AnimatePresence` for items appearing in the list. No sudden jumps.
*   [ ] **Contrast:** Critical data (ROI, NPV) needs 600/700 weight and distinct color (e.g., Emerald-600), not just black.
*   [ ] **Avatars:** Give the Agent a distinct but subtle identity (not a robot icon, maybe an abstract "Spark").
