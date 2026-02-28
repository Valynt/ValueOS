import { useState } from "react";
import {
  Building2,
  Clock,
  Edit3,
  Package,
  RefreshCw,
  Shield,
  Sparkles,
  Swords,
  Users,

} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompanyValueContext } from "@/contexts/CompanyContextProvider";
import { Link } from "react-router-dom";

type Tab = "overview" | "products" | "competitors" | "personas" | "claims" | "history";

const tabs: Array<{ key: Tab; label: string; icon: React.ElementType }> = [
  { key: "overview", label: "Overview", icon: Building2 },
  { key: "products", label: "Products", icon: Package },
  { key: "competitors", label: "Competitors", icon: Swords },
  { key: "personas", label: "Personas", icon: Users },
  { key: "claims", label: "Claim Rules", icon: Shield },
  { key: "history", label: "History", icon: Clock },
];

export default function CompanyKnowledge() {
  const { companyContext, isLoading, isReady } = useCompanyValueContext();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Demo fallback data when Supabase isn't connected
  const ctx = companyContext?.context;
  const products = companyContext?.products ?? [];
  const competitors = companyContext?.competitors ?? [];
  const personas = companyContext?.personas ?? [];
  const claims = companyContext?.claimGovernance ?? [];

  if (isLoading) {
    return (
      <div className="p-10 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isReady || !ctx) {
    return (
      <div className="p-10 max-w-lg mx-auto text-center">
        <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7 text-zinc-400" />
        </div>
        <h2 className="text-[18px] font-black text-zinc-950 tracking-tight mb-2">No Company Intelligence Yet</h2>
        <p className="text-[13px] text-zinc-400 mb-6">
          Complete the onboarding to build your company's value intelligence foundation.
        </p>
        <Link
          to="/onboarding"
          className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-950 text-white rounded-xl text-[13px] font-medium hover:bg-zinc-800 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Start Onboarding
        </Link>
      </div>
    );
  }

  const riskColors = {
    safe: { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    conditional: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
    high_risk: { color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1000px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-[-0.05em]">{ctx.company_name}</h1>
          <p className="text-[13px] text-zinc-400 mt-0.5">
            Company Intelligence · v{ctx.version} · Last updated {new Date(ctx.updated_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 rounded-xl text-[12px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 rounded-xl text-[12px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
            <Edit3 className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 p-0.5 bg-zinc-100 rounded-xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-colors flex-1 justify-center",
                activeTab === tab.key
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Products", value: products.length, icon: Package },
              { label: "Competitors", value: competitors.length, icon: Swords },
              { label: "Personas", value: personas.length, icon: Users },
              { label: "Claim Rules", value: claims.length, icon: Shield },
            ].map((s) => {
              const SIcon = s.icon;
              return (
                <div key={s.label} className="bg-white border border-zinc-200 rounded-2xl p-4 text-center">
                  <SIcon className="w-5 h-5 text-zinc-400 mx-auto mb-2" />
                  <p className="text-2xl font-black text-zinc-950 tracking-tight">{s.value}</p>
                  <p className="text-[11px] text-zinc-400 font-medium">{s.label}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-5">
            <h3 className="text-[13px] font-semibold text-zinc-900 mb-3">Company Profile</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Industry", value: ctx.industry },
                { label: "Size", value: ctx.company_size?.replace("_", " ") },
                { label: "Sales Motion", value: ctx.sales_motion?.replace("_", " ") },
                { label: "Website", value: ctx.website_url },
                { label: "Revenue", value: ctx.annual_revenue },
                { label: "Employees", value: ctx.employee_count?.toLocaleString() },
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-[11px] text-zinc-400">{f.label}</p>
                  <p className="text-[13px] font-medium text-zinc-900 capitalize">{f.value || "—"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "products" && (
        <div className="space-y-3">
          {products.length === 0 ? (
            <p className="text-[13px] text-zinc-400 text-center py-10">No products added yet</p>
          ) : (
            products.map((p) => (
              <div key={p.id} className="bg-white border border-zinc-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[14px] font-bold text-zinc-900">{p.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-semibold capitalize">
                    {p.product_type?.replace("_", " ")}
                  </span>
                </div>
                {p.description && <p className="text-[12px] text-zinc-500">{p.description}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "competitors" && (
        <div className="space-y-3">
          {competitors.length === 0 ? (
            <p className="text-[13px] text-zinc-400 text-center py-10">No competitors added yet</p>
          ) : (
            competitors.map((c) => (
              <div key={c.id} className="bg-white border border-zinc-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[14px] font-bold text-zinc-900">{c.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-semibold capitalize">
                    {c.relationship}
                  </span>
                </div>
                {c.differentiated_claims.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 mb-1">Differentiated</p>
                    <div className="flex flex-wrap gap-1">
                      {c.differentiated_claims.map((cl) => (
                        <span key={cl} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] rounded-md font-medium">{cl}</span>
                      ))}
                    </div>
                  </div>
                )}
                {c.risky_claims.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 mb-1">Risky Claims</p>
                    <div className="flex flex-wrap gap-1">
                      {c.risky_claims.map((cl) => (
                        <span key={cl} className="px-2 py-0.5 bg-red-50 text-red-700 text-[10px] rounded-md font-medium">{cl}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "personas" && (
        <div className="space-y-3">
          {personas.length === 0 ? (
            <p className="text-[13px] text-zinc-400 text-center py-10">No personas added yet</p>
          ) : (
            personas.map((p) => (
              <div key={p.id} className="bg-white border border-zinc-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[14px] font-bold text-zinc-900">{p.title}</h3>
                  <div className="flex gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold capitalize">
                      {p.persona_type?.replace("_", " ")}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-semibold capitalize">
                      {p.seniority?.replace("_", " ")}
                    </span>
                  </div>
                </div>
                {p.typical_kpis.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 mb-1">KPIs</p>
                    <div className="flex flex-wrap gap-1">
                      {p.typical_kpis.map((k) => (
                        <span key={k} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded-md font-medium">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
                {p.pain_points.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 mb-1">Pain Points</p>
                    <div className="flex flex-wrap gap-1">
                      {p.pain_points.map((pp) => (
                        <span key={pp} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] rounded-md font-medium">{pp}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "claims" && (
        <div className="space-y-3">
          {claims.length === 0 ? (
            <p className="text-[13px] text-zinc-400 text-center py-10">No claim rules added yet</p>
          ) : (
            claims.map((c) => {
              const rc = riskColors[c.risk_level];
              return (
                <div key={c.id} className={cn("p-4 rounded-2xl border", rc.border, rc.bg)}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold border flex-shrink-0", rc.color, rc.bg, rc.border)}>
                      {c.risk_level.replace("_", " ")}
                    </span>
                    {c.category && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-semibold capitalize">
                        {c.category}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-zinc-800 font-medium">{c.claim_text}</p>
                  {c.rationale && <p className="text-[11px] text-zinc-500 mt-1">{c.rationale}</p>}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <p className="text-[13px] text-zinc-400 text-center py-10">
            Version history will appear here as changes are made to the company intelligence.
          </p>
        </div>
      )}
    </div>
  );
}
