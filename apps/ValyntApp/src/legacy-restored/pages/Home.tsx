// /workspaces/ValueOS/src/pages/Home.tsx
import React from "react";
import { useData } from "../data/store";

const Home: React.FC = () => {
  const { state } = useData();
  const totalDeals = state.deals.length;
  const activeDeals = state.deals.filter((d) => d.stage !== "closed").length;
  const publishedDrivers = state.valueDrivers.filter((d) => d.status === "published").length;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold">Total Deals</h3>
          <p className="text-2xl font-bold">{totalDeals}</p>
        </div>
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold">Active Deals</h3>
          <p className="text-2xl font-bold">{activeDeals}</p>
        </div>
        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold">Published Drivers</h3>
          <p className="text-2xl font-bold">{publishedDrivers}</p>
        </div>
      </div>
      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">Recent Deals</h3>
        <ul>
          {state.deals.slice(0, 5).map((deal) => (
            <li key={deal.id} className="border-b py-2">
              {deal.name} - {deal.stage}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Home;
