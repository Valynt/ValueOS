// /workspaces/ValueOS/src/pages/tabs/ValueRealization.tsx
import React, { useState } from "react";
import { useData } from "../../data/store";
import { ValueRealization } from "../../data/types";

interface ValueRealizationProps {
  dealId: string;
}

const ValueRealizationTab: React.FC<ValueRealizationProps> = ({ dealId }) => {
  const { state, dispatch } = useData();
  const deal = state.deals.find((d) => d.id === dealId);
  const realization = state.valueRealizations.find((v) => v.dealId === dealId);
  const [form, setForm] = useState<Partial<ValueRealization>>({
    committed: {},
    actual: {},
    variance: {},
    rootCause: "",
    actions: [],
  });

  if (deal?.stage !== "closed") {
    return (
      <div>This deal is not closed. Value realization tracking is available for closed deals.</div>
    );
  }

  const handleSubmit = () => {
    if (form.committed && form.actual) {
      const variance: Record<string, number> = {};
      Object.keys(form.actual).forEach((key) => {
        variance[key] = (form.actual![key] || 0) - (form.committed![key] || 0);
      });
      const valueRealization: ValueRealization = {
        id: realization ? realization.id : Date.now().toString(),
        dealId,
        committed: form.committed,
        actual: form.actual,
        variance,
        rootCause: form.rootCause || "",
        actions: form.actions || [],
      };
      dispatch(
        realization
          ? { type: "UPDATE_VALUE_REALIZATION", payload: valueRealization }
          : { type: "ADD_VALUE_REALIZATION", payload: valueRealization }
      );
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Value Realization</h2>
      <div className="space-y-4">
        <div>
          <label>Committed (JSON)</label>
          <textarea
            value={JSON.stringify(form.committed, null, 2)}
            onChange={(e) => setForm({ ...form, committed: JSON.parse(e.target.value || "{}") })}
            className="w-full p-2 border rounded"
            rows={4}
          />
        </div>
        <div>
          <label>Actual (JSON)</label>
          <textarea
            value={JSON.stringify(form.actual, null, 2)}
            onChange={(e) => setForm({ ...form, actual: JSON.parse(e.target.value || "{}") })}
            className="w-full p-2 border rounded"
            rows={4}
          />
        </div>
        <div>
          <label>Variance (auto calculated)</label>
          <textarea
            value={JSON.stringify(form.variance, null, 2)}
            readOnly
            className="w-full p-2 border rounded bg-gray-100"
            rows={4}
          />
        </div>
        <input
          type="text"
          placeholder="Root Cause"
          value={form.rootCause || ""}
          onChange={(e) => setForm({ ...form, rootCause: e.target.value })}
          className="w-full p-2 border rounded"
        />
        <textarea
          placeholder="Actions (one per line)"
          value={form.actions?.join("\n") || ""}
          onChange={(e) => setForm({ ...form, actions: e.target.value.split("\n") })}
          className="w-full p-2 border rounded"
          rows={4}
        />
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save Value Realization
        </button>
      </div>
      {realization && (
        <div className="mt-6 bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Current Value Realization</h3>
          <p>Committed: {JSON.stringify(realization.committed)}</p>
          <p>Actual: {JSON.stringify(realization.actual)}</p>
          <p>Variance: {JSON.stringify(realization.variance)}</p>
          <p>Root Cause: {realization.rootCause}</p>
          <p>Actions: {realization.actions.join(", ")}</p>
        </div>
      )}
    </div>
  );
};

export default ValueRealizationTab;
