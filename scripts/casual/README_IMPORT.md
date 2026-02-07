# Causal Truth Dataset & Engine Export (v1.5)

This folder contains the core assets for the Causal Truth Reasoning Engine, structured for easy integration into a SaaS repository.

## 📁 Directory Structure

- **/data/**: Contains `causal_truth_db.json`, the primary knowledge base of 14+ validated business relationships.
- **/core/**:
  - `schema.py`: Pydantic models (CausalRelationship, CascadingEffect) for data integrity.
  - `miner.py`: The `EconomicLogicEngine`. Use this for AI extraction and running simulations.
  - `scalable_factory.py`: Logic for batch-processing research reports and PDFs.
- **/explorer/**:
  - A portable Vite-based visualization tool. You can embed this as an `<iframe>` or port the `/src` logic directly into your React/Vue SaaS frontend.

## 🚀 How to Import into your SaaS

### 1. Integration with Python Backend

Add these to your `requirements.txt`:

```text
pydantic>=2.0
openai
python-dotenv
```

Then, use the `EconomicLogicEngine` to simulate outcomes for your customers:

```python
from core.miner import EconomicLogicEngine

engine = EconomicLogicEngine(db_path="data/causal_truth_db.json")

# Calculate the value of Agentic AI for a customer
simulation = engine.simulate_action_outcome(
    action="Generative AI Enterprise Scaling",
    baseline_value=1000000  # $1M support costs
)
print(f"Projected Gain: {simulation['expected_outcome']}")
```

### 2. UI Integration

To use the explorer in your SaaS dashboard:

1. Copy the `/explorer` content.
2. Run `pnpm install` and `pnpm run build`.
3. The generated `/dist` folder can be served by your SaaS to show the Causal Network.

## 💎 Knowledge Anchors Included

- **ServiceNow ROI**: 3x platform adoption lift via VRF.
- **McKinsey 2025**: 40% productivity gap driven by Agentic AI.
- **Cognizant VRF**: 20% reduction in supply chain costs.

---

_Built by Antigravity AI - Causal Truth Factory_
