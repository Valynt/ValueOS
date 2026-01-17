// /workspaces/ValueOS/src/pages/Benchmarks.tsx
import React, { useState } from "react";
import { useData } from "../data/store";
import EntityTable from "../components/EntityTable";
import DrawerForm from "../components/DrawerForm";
import { Benchmark } from "../data/types";

const Benchmarks: React.FC = () => {
  const { state, dispatch } = useData();
  const isAdmin = state.currentUser?.role === "admin";
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState<Benchmark | null>(null);
  const [form, setForm] = useState<Partial<Benchmark>>({ confidence: 0.5 });

  const columns = [
    { key: "industry" as keyof Benchmark, label: "Industry" },
    { key: "metric" as keyof Benchmark, label: "Metric" },
    {
      key: "baselineMin" as keyof Benchmark,
      label: "Min Baseline",
      render: (value: number) => value.toString(),
    },
    {
      key: "baselineMax" as keyof Benchmark,
      label: "Max Baseline",
      render: (value: number) => value.toString(),
    },
    { key: "source" as keyof Benchmark, label: "Source" },
    {
      key: "confidence" as keyof Benchmark,
      label: "Confidence",
      render: (value: number) => `${(value * 100).toFixed(0)}%`,
    },
  ];

  const handleRowClick = (benchmark: Benchmark) => {
    if (isAdmin) {
      setEditingBenchmark(benchmark);
      setForm(benchmark);
      setIsDrawerOpen(true);
    }
  };

  const handleSubmit = () => {
    if (
      form.industry &&
      form.metric &&
      form.baselineMin !== undefined &&
      form.baselineMax !== undefined &&
      form.source
    ) {
      const benchmark: Benchmark = editingBenchmark
        ? { ...editingBenchmark, ...form }
        : {
            id: Date.now().toString(),
            industry: form.industry,
            metric: form.metric,
            baselineMin: form.baselineMin,
            baselineMax: form.baselineMax,
            source: form.source,
            confidence: form.confidence || 0.5,
          };
      dispatch(
        editingBenchmark
          ? { type: "UPDATE_BENCHMARK", payload: benchmark }
          : { type: "ADD_BENCHMARK", payload: benchmark }
      );
      setIsDrawerOpen(false);
      setEditingBenchmark(null);
      setForm({ confidence: 0.5 });
    }
  };

  // Add UPDATE_BENCHMARK and ADD_BENCHMARK to store reducer if not there.

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Benchmarks</h1>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingBenchmark(null);
              setForm({ confidence: 0.5 });
              setIsDrawerOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            New Benchmark
          </button>
        )}
      </div>
      <EntityTable
        data={state.benchmarks}
        columns={columns}
        onRowClick={handleRowClick}
        filterKey="industry"
      />
      <DrawerForm
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingBenchmark ? "Edit Benchmark" : "New Benchmark"}
      >
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Industry"
            value={form.industry || ""}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Metric"
            value={form.metric || ""}
            onChange={(e) => setForm({ ...form, metric: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <input
            type="number"
            placeholder="Baseline Min"
            value={form.baselineMin || ""}
            onChange={(e) => setForm({ ...form, baselineMin: parseFloat(e.target.value) || 0 })}
            className="w-full p-2 border rounded"
          />
          <input
            type="number"
            placeholder="Baseline Max"
            value={form.baselineMax || ""}
            onChange={(e) => setForm({ ...form, baselineMax: parseFloat(e.target.value) || 0 })}
            className="w-full p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Source"
            value={form.source || ""}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            className="w-full p-2 border rounded"
          />
          <input
            type="number"
            placeholder="Confidence (0-1)"
            value={form.confidence || ""}
            onChange={(e) => setForm({ ...form, confidence: parseFloat(e.target.value) || 0.5 })}
            className="w-full p-2 border rounded"
          />
          <button
            onClick={handleSubmit}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {editingBenchmark ? "Update" : "Create"}
          </button>
        </div>
      </DrawerForm>
    </div>
  );
};

export default Benchmarks;
