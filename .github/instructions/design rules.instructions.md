---
applyTo: "**"
---

# VALYNT — Final Brand Design Rules for the SaaS Application

> **Purpose**
> This document is the authoritative, merged ruleset governing **design, frontend engineering, and UI implementation** for the VALYNT SaaS application.
> These rules combine **strategic brand principles** with **token‑level enforcement**. Deviations are treated as defects, not stylistic differences.

---

## 0. North Star Rule (Non‑Negotiable)

> **If a design or UI decision does not reinforce VALYNT as a dark‑first, system‑level, economically grounded _Value Operating System_, it is incorrect — even if it looks good or functions correctly.**

---

## 1. Brand Identity & Design Philosophy

**Brand Name**: VALYNT

**Category Positioning**
VALYNT is a **Value Operating System**, not a dashboard, plugin, or feature suite.

**System Mandate**
Design must communicate:

- infrastructure
- orchestration
- economic intelligence
- lifecycle continuity

**Core Visual Metaphor**

- **Value Intelligence** → _Teal scale_
- **Structure / Graph / Evidence** → _Grey scale_

**Primary Design Principle**
**Semantic over Direct**

All styling must be expressed through **semantic tokens**, never raw values.

```tsx
// ✓ Required
<div className="bg-vc-surface-2 border-vc-border-default" />

// ✗ Forbidden
<div style={{ background: "#101010", border: "1px solid #2A2A2A" }} />
```

Tokens are the **API of the brand**.

---

## 2. Color System (Dark‑First Carbon Black Foundation)

### 2.1 Primary Surfaces — Mandatory Hierarchy

| Token       | Hex       | Purpose                | Allowed Usage     |
| ----------- | --------- | ---------------------- | ----------------- |
| `surface.1` | `#0B0C0F` | Base application shell | Root layout, body |
| `surface.2` | `#13141A` | Raised content         | Cards, panels     |
| `surface.3` | `#1A1C24` | Highest elevation      | Modals, overlays  |

**Rules**

- `surface.1` must always be the root background
- Cards must not use `surface.1`
- Modals must not use `surface.2`
- Elevation is conveyed by surface tokens, **not shadows**

---

### 2.2 Accent Colors — Semantic Meaning Only

#### Value Teal (Primary Brand Color)

| Token             | Hex       | Meaning                                          |
| ----------------- | --------- | ------------------------------------------------ |
| `accent-teal-500` | `#18C3A5` | Confirmed value, economic truth, primary actions |
| `accent-teal-400` | `#27E1C1` | Hover / emphasis                                 |

**Usage Rules**

- Represents **value intelligence, outcomes, and system integrity**
- Must not be used decoratively or for marketing flair

```tsx
// ✓ Correct
<ValueMetric className="text-vc-accent-teal-500" />

// ✗ Forbidden
<h1 className="text-vc-accent-teal-500">Marketing Headline</h1>
```

---

#### Graph Grey (Secondary Brand Color)

| Token             | Hex       | Meaning                              |
| ----------------- | --------- | ------------------------------------ |
| `accent-grey-500` | `#5A5D67` | Structure, metadata, neutral context |

**Rules**

- Grey must never indicate success or importance
- Grey must never be used for primary actions

---

### 2.3 Semantic Status Colors

| Status  | Token Mapping          |
| ------- | ---------------------- |
| Success | Value Teal (`#18C3A5`) |
| Info    | Teal 400 (`#27E1C1`)   |
| Warning | `#FFA726`              |
| Error   | `#EF5350`              |

---

## 3. Typography System

### 3.1 Fonts

| Role         | Font           | Usage                 |
| ------------ | -------------- | --------------------- |
| UI / Content | Inter          | Headings, body text   |
| Data / Code  | JetBrains Mono | Tables, metrics, code |

Mixing fonts outside these roles is prohibited.

---

### 3.2 Font Scale (Fixed)

| Token  | px  | Usage                  |
| ------ | --- | ---------------------- |
| `xs`   | 12  | Micro labels, metadata |
| `sm`   | 14  | Labels, dense UI       |
| `base` | 16  | Body text              |
| `3xl`  | 30  | Section titles         |
| `5xl`  | 48  | Hero headings          |
| `6xl`  | 60  | Display only           |

**Tracking Rules**

- Hero headings: `tracking-tight (-0.025em)`
- Micro labels: `tracking-wide (0.05em)`

Arbitrary font sizes or tracking values are forbidden.

---

## 4. Layout, Spacing & Shape

### 4.1 Spacing System

- Strict **8px grid**
- Base unit: `0.5rem (8px)`

| Common Values | px  |
| ------------- | --- |
| `spacing-4`   | 16  |
| `spacing-6`   | 24  |
| `spacing-8`   | 32  |

No off‑scale spacing is allowed.

---

### 4.2 Border Radius

| Component       | Radius          |
| --------------- | --------------- |
| Cards / Inputs  | 8px (`md`)      |
| Modals          | 16px (`xl`)     |
| Buttons / Pills | Full (`9999px`) |

---

### 4.3 Borders

| Token            | Hex       | Usage               |
| ---------------- | --------- | ------------------- |
| `border.default` | `#2A2A2A` | Standard boundaries |
| `border.strong`  | `#3A3A3A` | Focus states        |

---

## 5. Effects & Motion

### 5.1 Shadows

- Shadows are subtle and secondary
- Elevation comes from surface tokens

---

### 5.2 Signature “Glow” (Restricted Use)

**Teal Glow**
`0 0 20px rgba(24, 195, 165, 0.3)`

**Allowed Only For**

- Active agents
- High‑confidence value intelligence
- System‑level emphasis

Never used for decoration.

---

### 5.3 Animation Rules

| Type              | Duration | Easing   |
| ----------------- | -------- | -------- |
| Micro‑interaction | 100ms    | ease‑out |
| Standard UI       | 200ms    | ease‑out |
| Page transition   | 500ms    | ease‑out |

Custom timing curves are forbidden.

---

## 6. Enforcement & Governance

- Tokens are the **single source of truth**
- Hex values, px values, inline styles are prohibited
- Local component overrides are prohibited
- Token violations block PRs

> **Design drift is treated as technical debt.**

---

## Final Statement

> **You are not styling UI. You are implementing an economic intelligence system.**

If a component cannot be explained in **business and economic terms**, it does not belong in VALYNT.

---
