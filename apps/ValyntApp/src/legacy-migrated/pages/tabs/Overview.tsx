// /workspaces/ValueOS/src/pages/tabs/Overview.tsx
import React from "react";
import { Deal, Hypothesis, ROIModel } from "../../data/types";

interface OverviewProps {
  deal: Deal;
  hypotheses: Hypothesis[];
  roiModels: ROIModel[];
}

const Overview: React.FC<OverviewProps> = ({ deal, hypotheses, roiModels }) => {
  const roi = roiModels.find((r) => r.dealId === deal.id);
  const totalHypothesisOutputs = hypotheses
    .filter((h) => h.dealId === deal.id)
    .reduce((sum, h) => sum + Object.values(h.outputs).reduce((s, v) => s + v, 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Deal Summary</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>Stage:</strong> {deal.stage}
          </div>
          <div>
            <strong>Amount:</strong> ${deal.amount.toLocaleString()}
          </div>
          <div>
            <strong>Close Date:</strong> {deal.closeDate}
          </div>
          <div>
            <strong>Contacts:</strong> {deal.contacts.join(", ")}
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Key Metrics</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>Total Hypothesis Outputs:</strong> ${totalHypothesisOutputs.toLocaleString()}
          </div>
          {roi && (
            <>
              <div>
                <strong>Revenue Uplift:</strong> ${roi.components.revenueUplift.toLocaleString()}
              </div>
              <div>
                <strong>Cost Savings:</strong> ${roi.components.costSavings.toLocaleString()}
              </div>
              <div>
                <strong>Payback Months:</strong> {roi.paybackMonths}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Overview;
