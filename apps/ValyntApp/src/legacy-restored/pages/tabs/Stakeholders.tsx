// /workspaces/ValueOS/src/pages/tabs/Stakeholders.tsx
import React, { useState } from "react";
import { useData } from "../../data/store";
import EntityTable from "../../components/EntityTable";
import DrawerForm from "../../components/DrawerForm";
import { Stakeholder } from "../../data/types";

interface StakeholdersProps {
  dealId: string;
}

const StakeholdersTab: React.FC<StakeholdersProps> = ({ dealId }) => {
  const { state, dispatch } = useData();
  const stakeholders = state.stakeholders.filter((s) => s.dealId === dealId);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null>(null);
  const [form, setForm] = useState<Partial<Stakeholder>>({ influence: 5, priorities: [] });

  const columns = [
    { key: "name" as keyof Stakeholder, label: "Name" },
    { key: "role" as keyof Stakeholder, label: "Role" },
    {
      key: "influence" as keyof Stakeholder,
      label: "Influence",
      render: (value: number) => value.toString(),
    },
    {
      key: "priorities" as keyof Stakeholder,
      label: "Priorities",
      render: (value: string[]) => value.join(", "),
    },
  ];

  const handleRowClick = (stakeholder: Stakeholder) => {
    setEditingStakeholder(stakeholder);
    setForm(stakeholder);
    setIsDrawerOpen(true);
  };

  const handleSubmit = () => {
    if (form.name && form.role) {
      const stakeholder: Stakeholder = editingStakeholder
        ? { ...editingStakeholder, ...form }
        : {
            id: Date.now().toString(),
            dealId,
            name: form.name,
            role: form.role,
            influence: form.influence || 5,
            priorities: form.priorities || [],
          };
      dispatch(
        editingStakeholder
          ? { type: "UPDATE_STAKEHOLDER", payload: stakeholder }
          : { type: "ADD_STAKEHOLDER", payload: stakeholder }
      );
      setIsDrawerOpen(false);
      setEditingStakeholder(null);
      setForm({ influence: 5, priorities: [] });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Stakeholders</h2>
        <button
          onClick={() => {
            setEditingStakeholder(null);
            setForm({ influence: 5, priorities: [] });
            setIsDrawerOpen(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add Stakeholder
        </button>
      </div>
      <EntityTable
        data={stakeholders}
        columns={columns}
        onRowClick={handleRowClick}
        filterKey="name"
      />
      <DrawerForm
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingStakeholder ? "Edit Stakeholder" : "New Stakeholder"}
      >
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Name"
            value={form.name || ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Role"
            value={form.role || ""}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <input
            type="number"
            placeholder="Influence (1-10)"
            value={form.influence || ""}
            onChange={(e) => setForm({ ...form, influence: parseInt(e.target.value) || 5 })}
            className="w-full p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Priorities (comma separated)"
            value={form.priorities?.join(", ") || ""}
            onChange={(e) =>
              setForm({ ...form, priorities: e.target.value.split(",").map((s) => s.trim()) })
            }
            className="w-full p-2 border rounded"
          />
          <button
            onClick={handleSubmit}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {editingStakeholder ? "Update" : "Add"}
          </button>
        </div>
      </DrawerForm>
    </div>
  );
};

export default StakeholdersTab;
