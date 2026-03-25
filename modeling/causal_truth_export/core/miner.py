import json
import os
import uuid
import PyPDF2
from typing import List, Dict, Any, Optional
from openai import OpenAI
from dotenv import load_dotenv
from schema import CausalRelationship, ImpactDistribution, Evidence, SourceTier, KnowledgeStatus, CascadingEffect

load_dotenv()

class PDFIngestor:
    """Handles PDF ingestion and basic processing."""

    @staticmethod
    def extract_text(file_path: str) -> str:
        """Extracts text from a local PDF file."""
        text = ""
        try:
            with open(file_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                for page in reader.pages:
                    text += page.extract_text() + "\n"
        except Exception as e:
            print(f"Error reading PDF {file_path}: {e}")
        return text

class EconomicLogicEngine:
    """The 'AI Extraction Factory' logic."""

    def __init__(self, db_path: str = "causal_truth_db.json", api_key: str = None):
        self.db_path = db_path
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=self.api_key) if self.api_key else None
        self.relationships: List[CausalRelationship] = []
        self._load_db()

    def _load_db(self):
        if os.path.exists(self.db_path):
            try:
                with open(self.db_path, "r") as f:
                    data = json.load(f)
                    self.relationships = [CausalRelationship(**r) for r in data.get("relationships", [])]
            except Exception as e:
                print(f"Error loading database: {e}")

    def save_to_db(self):
        """Persists the current relationship graph to disk."""
        try:
            db_data = {
                "version": "1.5",
                "relationships": [r.model_dump() for r in self.relationships]
            }
            with open(self.db_path, "w") as f:
                json.dump(db_data, f, indent=4)
        except Exception as e:
            print(f"Error saving database: {e}")

    def get_miner_prompt(self, input_text: str) -> str:
        return f"""
System: You are an Economic Logic Engine. Your goal is to extract causal relationships from business text into a strict JSON format.

Input Text: {input_text}

Task: Identify any claims where an Action drives a KPI.
1. Extract the driver_action and target_kpi.
2. Identify the direction and mechanism.
3. Look for quantitative evidence (ranges, percentages). Map these to p10, p50, p90 if possible.
   If only one number is given, treat it as p50 and estimate wide bounds based on context.
4. Extract the citation/quote for the evidence block.
5. Crucial: Identify any mentioned side_effects or preconditions (contextual_validity).

Output Format: JSON matching the CausalTruthSchema (v1.5). Provide a JSON array of relationships.
"""

    def apply_vendor_discount(self, rel_data: Dict[str, Any], tier: SourceTier) -> Dict[str, Any]:
        """Apply a 'Vendor Discount Factor' (0.7) to Tier 2 sources."""
        if tier == SourceTier.TIER_2:
            dist = rel_data.get("impact_distribution", {})
            for key in ["p10", "p50", "p90"]:
                if key in dist and dist[key] is not None:
                    dist[key] = round(float(dist[key]) * 0.7, 4)

            # Update evidence
            if "evidence" in rel_data:
                for ev in rel_data["evidence"]:
                    ev["discount_factor_applied"] = 0.7
        return rel_data

    def process_llm_response(self, raw_json: str, tier: SourceTier, source_metadata: Dict) -> List[CausalRelationship]:
        """Validates and processes the raw JSON from the LLM."""
        try:
            # Clean up potential markdown formatting from LLM
            clean_json = raw_json.strip()
            if clean_json.startswith("```json"):
                clean_json = clean_json[7:-3].strip()
            elif clean_json.startswith("```"):
                clean_json = clean_json[3:-3].strip()

            data = json.loads(clean_json)
            # Handle both single object or list of objects
            relationships_data = data if isinstance(data, list) else data.get("relationships", [data])

            processed_relationships = []
            for rel_data in relationships_data:
                if "id" not in rel_data:
                    rel_data["id"] = str(uuid.uuid4())

                if "evidence" not in rel_data:
                    rel_data["evidence"] = []

                # Apply Vendor Discount if Tier 2
                rel_data = self.apply_vendor_discount(rel_data, tier)

                # Standardize evidence with tier info
                for ev in rel_data["evidence"]:
                    ev["tier"] = tier
                    ev["source_name"] = source_metadata.get("name", "Unknown Source")

                rel = CausalRelationship(**rel_data)
                processed_relationships.append(rel)

            return processed_relationships
        except Exception as e:
            print(f"Error processing LLM response: {e}")
            return []

    def extract_from_text(self, text: str, tier: SourceTier, source_metadata: Dict) -> List[CausalRelationship]:
        """Performs real LLM extraction from text."""
        if not self.client:
            print("⚠️ OpenAI API key not found. Skipping extraction. (Mock enabled)")
            return []

        prompt = self.get_miner_prompt(text)
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            raw_json = response.choices[0].message.content
            return self.process_llm_response(raw_json, tier, source_metadata)
        except Exception as e:
            print(f"Error during LLM extraction: {e}")
            return []
    def get_causal_impact(self, action: str, target_kpi: str, min_confidence: float = 0.5) -> List[CausalRelationship]:
        """Finds relationships where action affects KPI with sufficient confidence."""
        results = []
        action_lower = action.lower()
        kpi_lower = target_kpi.lower()

        for rel in self.relationships:
            if (action_lower in rel.driver_action.lower() and
                kpi_lower in rel.target_kpi.lower() and
                rel.confidence_score >= min_confidence):
                results.append(rel)
        return results

    def simulate_action_outcome(self, action: str, baseline_value: float, confidence_threshold: float = 0.5) -> Dict[str, Any]:
        """Simulates the outcome of an action on its primary KPI.

        For percentage units the result is expressed as a multiplied outcome
        (baseline * (1 + p/100)). For absolute units (days, USD, hours, etc.)
        the impact values are returned as-is alongside the baseline so callers
        can interpret them correctly. Unrecognised units raise ValueError.
        """
        rels = self.get_causal_impact(action, "", confidence_threshold)
        if not rels:
            return {"error": "No matching causal relationships found."}

        # Take the highest confidence relationship for primary simulation
        rel = max(rels, key=lambda x: x.confidence_score)
        dist = rel.impact_distribution

        ABSOLUTE_UNITS = {"days", "usd", "hours", "fte", "count", "units"}

        if dist.unit == "%":
            return {
                "action": action,
                "target_kpi": rel.target_kpi,
                "unit": "%",
                "baseline": baseline_value,
                "expected_outcome": baseline_value * (1.0 + dist.p50 / 100.0),
                "p10_impact": baseline_value * (1.0 + dist.p10 / 100.0),
                "p90_impact": baseline_value * (1.0 + dist.p90 / 100.0),
                "mechanism": rel.mechanism,
                "time_to_realize": rel.time_to_realize,
            }
        elif dist.unit.lower() in ABSOLUTE_UNITS:
            # Absolute units: impact values are deltas, not multipliers.
            return {
                "action": action,
                "target_kpi": rel.target_kpi,
                "unit": dist.unit,
                "baseline": baseline_value,
                "expected_outcome": baseline_value + dist.p50,
                "p10_impact": baseline_value + dist.p10,
                "p90_impact": baseline_value + dist.p90,
                "mechanism": rel.mechanism,
                "time_to_realize": rel.time_to_realize,
            }
        else:
            raise ValueError(
                f"Unrecognised impact unit '{dist.unit}' for relationship '{rel.id}' "
                f"(action: '{rel.driver_action}'). "
                f"Supported units: '%' or one of {sorted(ABSOLUTE_UNITS)}."
            )

    def get_cascading_effects(self, action: str, max_depth: int = 2) -> List[Dict[str, Any]]:
        """Traverses the causal graph to find downstream impacts."""
        results = []
        primary_rels = self.get_causal_impact(action, "")

        for rel in primary_rels:
            path = {
                "layer": 1,
                "kpi": rel.target_kpi,
                "impact": rel.impact_distribution.model_dump(),
                "cascades": []
            }

            # Check secondary impacts defined in schema
            for cascade in rel.cascading_effects:
                path["cascades"].append({
                    "layer": 2,
                    "kpi": cascade.downstream_kpi,
                    "impact": cascade.expected_uplift.model_dump(),
                    "via": cascade.via_formula
                })
            results.append(path)
        return results

    def compare_scenarios(self, scenario_a_action: str, scenario_b_action: str, kpi: str) -> Dict[str, Any]:
        """Compares two possible actions against a target KPI."""
        impact_a = self.get_causal_impact(scenario_a_action, kpi)
        impact_b = self.get_causal_impact(scenario_b_action, kpi)

        res_a = impact_a[0] if impact_a else None
        res_b = impact_b[0] if impact_b else None

        if not res_a and not res_b:
            return {"error": f"No causal data found for either scenario against KPI '{kpi}'."}

        result: Dict[str, Any] = {
            "scenario_a": {
                "action": scenario_a_action,
                "p50": res_a.impact_distribution.p50 if res_a else None,
                "confidence": res_a.confidence_score if res_a else None,
            },
            "scenario_b": {
                "action": scenario_b_action,
                "p50": res_b.impact_distribution.p50 if res_b else None,
                "confidence": res_b.confidence_score if res_b else None,
            },
        }

        if res_a and res_b:
            result["winner"] = (
                scenario_a_action
                if res_a.impact_distribution.p50 > res_b.impact_distribution.p50
                else scenario_b_action
            )
        elif res_a:
            result["winner"] = scenario_a_action
            result["winner_note"] = f"No data for '{scenario_b_action}'; defaulting to '{scenario_a_action}'."
        else:
            result["winner"] = scenario_b_action
            result["winner_note"] = f"No data for '{scenario_a_action}'; defaulting to '{scenario_b_action}'."

        return result
