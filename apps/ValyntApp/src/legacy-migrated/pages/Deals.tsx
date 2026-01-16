// /workspaces/ValueOS/src/pages/Deals.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../data/store";
import EntityTable from "../components/EntityTable";
import DrawerForm from "../components/DrawerForm";
import { Deal } from "../data/types";

const Deals: React.FC = () => {
  const { state, dispatch } = useData();
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState<Partial<Deal>>({ stage: "discovery", amount: 0, closeDate: "" });

  const columns = [
    { key: "name" as keyof Deal, label: "Name" },
    { key: "stage" as keyof Deal, label: "Stage" },
    {
      key: "amount" as keyof Deal,
      label: "Amount",
      render: (value: number) => `$${value.toLocaleString()}`,
    },
    { key: "closeDate" as keyof Deal, label: "Close Date" },
  ];

  const handleRowClick = (deal: Deal) => {
    navigate(`/deals/${deal.id}`);
  };

  const handleSubmit = () => {
    if (form.name && form.stage && form.amount !== undefined && form.closeDate) {
      const newDeal: Deal = {
        id: Date.now().toString(),
        name: form.name,
        stage: form.stage,
        amount: form.amount,
        closeDate: form.closeDate,
        contacts: [],
      };
      dispatch({ type: "ADD_DEAL", payload: newDeal });
      setIsDrawerOpen(false);
      setForm({ stage: "discovery", amount: 0, closeDate: "" });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Deals</h1>
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          New Deal
        </button>
      </div>
      <EntityTable
        data={state.deals}
        columns={columns}
        onRowClick={handleRowClick}
        filterKey="name"
      />
      <DrawerForm isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title="New Deal">
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Deal Name"
            value={form.name || ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <select
            value={form.stage || ""}
            onChange={(e) => setForm({ ...form, stage: e.target.value })}
            className="w-full p-2 border rounded"
          >
            <option value="discovery">Discovery</option>
            <option value="negotiation">Negotiation</option>
            <option value="closed">Closed</option>
          </select>
          <input
            type="number"
            placeholder="Amount"
            value={form.amount || ""}
            onChange={(e) => setForm({ ...form, amount: parseInt(e.target.value) || 0 })}
            className="w-full p-2 border rounded"
          />
          <input
            type="date"
            value={form.closeDate || ""}
            onChange={(e) => setForm({ ...form, closeDate: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <button
            onClick={handleSubmit}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Deal
          </button>
        </div>
      </DrawerForm>
    </div>
  );
};

export default Deals;
