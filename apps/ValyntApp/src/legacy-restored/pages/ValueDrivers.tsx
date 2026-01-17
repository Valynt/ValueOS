// /workspaces/ValueOS/src/pages/ValueDrivers.tsx
import React, { useState } from "react";
import { useData } from "../data/store";
import EntityTable from "../components/EntityTable";
import DrawerForm from "../components/DrawerForm";
import { ValueDriver } from "../data/types";

const ValueDrivers: React.FC = () => {
  const { state, dispatch } = useData();
  const isAdmin = state.currentUser?.role === "admin";
  const visibleDrivers = isAdmin
    ? state.valueDrivers
    : state.valueDrivers.filter((d) => d.status === "published");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<ValueDriver | null>(null);
  const [form, setForm] = useState<Partial<ValueDriver>>({
    status: "draft",
    version: 1,
    personaTags: [],
    motionTags: [],
    defaultAssumptions: {},
  });

  const columns = [
    { key: "name" as keyof ValueDriver, label: "Name" },
    { key: "type" as keyof ValueDriver, label: "Type" },
    { key: "status" as keyof ValueDriver, label: "Status" },
    { key: "version" as keyof ValueDriver, label: "Version" },
  ];

  const handleRowClick = (driver: ValueDriver) => {
    if (isAdmin) {
      setEditingDriver(driver);
      setForm(driver);
      setIsDrawerOpen(true);
    }
  };

  const handleSubmit = () => {
    if (form.name && form.type && form.formula && form.narrativePitch) {
      const driver: ValueDriver = editingDriver
        ? { ...editingDriver, ...form }
        : {
            id: Date.now().toString(),
            name: form.name,
            type: form.type,
            personaTags: form.personaTags || [],
            motionTags: form.motionTags || [],
            formula: form.formula,
            defaultAssumptions: form.defaultAssumptions || {},
            narrativePitch: form.narrativePitch,
            status: form.status || "draft",
            version: form.version || 1,
          };
      dispatch(
        editingDriver
          ? { type: "UPDATE_VALUE_DRIVER", payload: driver }
          : { type: "ADD_VALUE_DRIVER", payload: driver }
      );
      setIsDrawerOpen(false);
      setEditingDriver(null);
      setForm({
        status: "draft",
        version: 1,
        personaTags: [],
        motionTags: [],
        defaultAssumptions: {},
      });
    }
  };

  const handlePublish = (id: string) => {
    dispatch({ type: "PUBLISH_VALUE_DRIVER", payload: id });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Value Drivers</h1>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingDriver(null);
              setForm({
                status: "draft",
                version: 1,
                personaTags: [],
                motionTags: [],
                defaultAssumptions: {},
              });
              setIsDrawerOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            New Driver
          </button>
        )}
      </div>
      <EntityTable
        data={visibleDrivers}
        columns={columns}
        onRowClick={handleRowClick}
        filterKey="name"
      />
      {isAdmin && (
        <div className="mt-4">
          {state.valueDrivers
            .filter((d) => d.status === "draft")
            .map((driver) => (
              <div
                key={driver.id}
                className="flex justify-between items-center bg-gray-100 p-4 mb-2 rounded"
              >
                <span>{driver.name}</span>
                <button
                  onClick={() => handlePublish(driver.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Publish
                </button>
              </div>
            ))}
        </div>
      )}
      <DrawerForm
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingDriver ? "Edit Driver" : "New Driver"}
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
            placeholder="Type"
            value={form.type || ""}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <textarea
            placeholder="Formula"
            value={form.formula || ""}
            onChange={(e) => setForm({ ...form, formula: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <textarea
            placeholder="Narrative Pitch"
            value={form.narrativePitch || ""}
            onChange={(e) => setForm({ ...form, narrativePitch: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <button
            onClick={handleSubmit}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {editingDriver ? "Update" : "Create"}
          </button>
        </div>
      </DrawerForm>
    </div>
  );
};

export default ValueDrivers;
