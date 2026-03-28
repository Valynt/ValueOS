import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { OpportunityValueBrief } from "@/features/opportunities";
import { useCreateCase } from "@/hooks/useCases";

export function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const createCase = useCreateCase();

  const handleStartCase = () => {
    if (!id) return;
    createCase.mutate(
      { name: "New Value Case", stage: "discovery" },
      {
        onSuccess: (newCase) => {
          navigate(`/opportunities/${id}/cases/${newCase.id}`);
        },
      }
    );
  };

  if (!id) return null;

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          to="/opportunities"
          className="flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Opportunities
        </Link>
        <span className="text-zinc-300">/</span>
        <span className="text-[13px] text-zinc-700 font-medium truncate max-w-[200px]">{id}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-[-0.05em]">
            Opportunity Value Brief
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            Account context, lifecycle stage, and value hypotheses.
          </p>
        </div>
        <button
          onClick={handleStartCase}
          disabled={createCase.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createCase.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Start Value Case
        </button>
      </div>

      {/* Primary surface: OpportunityValueBrief */}
      <OpportunityValueBrief opportunityId={id} />
    </div>
  );
}
