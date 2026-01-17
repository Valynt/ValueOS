// /workspaces/ValueOS/src/pages/tabs/ROIModel.tsx
import React, { useState } from "react";
import { useData } from "../../data/store";
import DrawerForm from "../../components/DrawerForm";
import { ROIModel } from "../../data/types";

interface ROIModelProps {
  dealId: string;
}

const ROIModelTab: React.FC<ROIModelProps> = ({ dealId }) => {
  const { state, dispatch } = useData();
  const roi = state.roiModels.find((r) => r.dealId === dealId);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState<Partial<ROIModel>>({
    components: { revenueUplift: 0, costSavings: 0, riskReduction: 0 },
    paybackMonths: 0,
    scenarios: [],
  });

  const handleCompute = () => {
    const deal = state.deals.find((d) => d.id === dealId);
    if (deal && form.components) {
      const annualBenefit = form.components.revenueUplift + form.components.costSavings;
      const paybackMonths = annualBenefit > 0 ? (deal.amount / annualBenefit) * 12 : 0;
      setForm({ ...form, paybackMonths });
    }
  };

  const handleSave = () => {
    if (form.components) {
      const roiModel: ROIModel = {
        id: roi ? roi.id : Date.now().toString(),
        dealId,
        components: form.components,
        paybackMonths: form.paybackMonths || 0,
        scenarios: form.scenarios || [],
      };
      dispatch(
        roi
          ? { type: "UPDATE_ROI_MODEL", payload: roiModel }
          : { type: "ADD_ROI_MODEL", payload: roiModel }
      );
      setIsDrawerOpen(false);
      setForm({
        components: { revenueUplift: 0, costSavings: 0, riskReduction: 0 },
        paybackMonths: 0,
        scenarios: [],
      });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">ROI Model</h2>
        <button
          onClick={() => {
            if (roi) setForm(roi);
            setIsDrawerOpen(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {roi ? "Edit" : "Create"} ROI Model
        </button>
      </div>
      {roi && (
        <div className="bg-white p-6 rounded shadow">
          <p>Revenue Uplift: ${roi.components.revenueUplift.toLocaleString()}</p>
          <p>Cost Savings: ${roi.components.costSavings.toLocaleString()}</p>
          <p>Risk Reduction: ${roi.components.riskReduction.toLocaleString()}</p>
          <p>Payback Months: {roi.paybackMonths}</p>
          <p>Scenarios: {roi.scenarios.map((s) => `${s.name}: ${s.multiplier}`).join(", ")}</p>
        </div>
      )}
      <DrawerForm
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={roi ? "Edit ROI Model" : "New ROI Model"}
      >
        <div className="space-y-4">
          <div>
            <label>Revenue Uplift</label>
            <input
              type="number"
              value={form.components?.revenueUplift || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  components: {
                    ...form.components!,
                    revenueUplift: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label>Cost Savings</label>
            <input
              type="number"
              value={form.components?.costSavings || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  components: { ...form.components!, costSavings: parseFloat(e.target.value) || 0 },
                })
              }
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label>Risk Reduction</label>
            <input
              type="number"
              value={form.components?.riskReduction || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  components: {
                    ...form.components!,
                    riskReduction: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="w-full p-2 border rounded"
            />
          </div>
          <button
            onClick={handleCompute}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Compute Payback
          </button>
          {form.paybackMonths !== undefined && (
            <p>Payback Months: {form.paybackMonths.toFixed(1)}</p>
          )}
          <button
            onClick={handleSave}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save ROI Model
          </button>
        </div>
      </DrawerForm>
    </div>
  );
};

export default ROIModelTab;
