// /workspaces/ValueOS/src/pages/tabs/ValueHypothesis.tsx
import React, { useState } from "react";
import { useData } from "../../data/store";
import DrawerForm from "../../components/DrawerForm";
import { Hypothesis } from "../../data/types";
import { evaluateFormula } from "../../utils/formulas";

interface ValueHypothesisProps {
  dealId: string;
}

const ValueHypothesis: React.FC<ValueHypothesisProps> = ({ dealId }) => {
  const { state, dispatch } = useData();
  const isAdmin = state.currentUser?.role === "admin";
  const visibleDrivers = isAdmin
    ? state.valueDrivers
    : state.valueDrivers.filter((d) => d.status === "published");
  const hypotheses = state.hypotheses.filter((h) => h.dealId === dealId);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState<{
    driverId: string;
    inputs: Record<string, number>;
    outputs: Record<string, number>;
  }>({
    driverId: "",
    inputs: {},
    outputs: {},
  });

  const handleDriverChange = (driverId: string) => {
    const driver = visibleDrivers.find((d) => d.id === driverId);
    if (driver) {
      setForm({ driverId, inputs: { ...driver.defaultAssumptions }, outputs: {} });
    }
  };

  const handleCompute = () => {
    const driver = visibleDrivers.find((d) => d.id === form.driverId);
    if (driver) {
      const output = evaluateFormula(driver.formula, form.inputs);
      setForm({ ...form, outputs: { output } });
    }
  };

  const handleSave = () => {
    if (form.driverId && Object.keys(form.outputs).length > 0) {
      const hypothesis: Hypothesis = {
        id: Date.now().toString(),
        dealId,
        driverId: form.driverId,
        inputs: form.inputs,
        outputs: form.outputs,
      };
      dispatch({ type: "ADD_HYPOTHESIS", payload: hypothesis });
      setIsDrawerOpen(false);
      setForm({ driverId: "", inputs: {}, outputs: {} });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Value Hypotheses</h2>
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          New Hypothesis
        </button>
      </div>
      <div className="space-y-4">
        {hypotheses.map((h) => {
          const driver = state.valueDrivers.find((d) => d.id === h.driverId);
          return (
            <div key={h.id} className="bg-white p-4 rounded shadow">
              <h3 className="font-semibold">{driver?.name}</h3>
              <p>Inputs: {JSON.stringify(h.inputs)}</p>
              <p>Outputs: {JSON.stringify(h.outputs)}</p>
            </div>
          );
        })}
      </div>
      <DrawerForm
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="New Hypothesis"
      >
        <div className="space-y-4">
          <select
            value={form.driverId}
            onChange={(e) => handleDriverChange(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Select Driver</option>
            {visibleDrivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {Object.keys(form.inputs).map((key) => (
            <div key={key}>
              <label>{key}</label>
              <input
                type="number"
                value={form.inputs[key]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    inputs: { ...form.inputs, [key]: parseFloat(e.target.value) || 0 },
                  })
                }
                className="w-full p-2 border rounded"
              />
            </div>
          ))}
          <button
            onClick={handleCompute}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Compute Outputs
          </button>
          {Object.keys(form.outputs).length > 0 && (
            <div>
              <p>Outputs: {JSON.stringify(form.outputs)}</p>
            </div>
          )}
          <button
            onClick={handleSave}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Hypothesis
          </button>
        </div>
      </DrawerForm>
    </div>
  );
};

export default ValueHypothesis;
