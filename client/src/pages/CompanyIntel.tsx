/*
 * VALYNT Company Intel Page — Company intelligence database
 * Table of companies with industry, revenue, employees, source
 */
import { useState } from "react";
import { Search, Plus, Building2, Globe, Users, DollarSign, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { companyIntel } from "@/lib/data";
import { toast } from "sonner";

export default function CompanyIntel() {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = companyIntel.filter(
    (c) =>
      c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.industry.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Company Intel</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Intelligence database for target and prospect companies</p>
        </div>
        <Button className="h-9 text-[13px] bg-foreground text-background hover:bg-foreground/90" onClick={() => toast("Add company coming soon")}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add Company
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search companies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </div>

      {/* Company cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((company) => (
          <div
            key={company.id}
            className="border border-border rounded-xl p-5 bg-card hover:border-foreground/20 transition-colors cursor-pointer"
            onClick={() => toast(`Opening ${company.company} profile...`)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center text-[12px] font-bold text-muted-foreground">
                  {company.company.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-foreground">{company.company}</h3>
                  <p className="text-[11px] text-muted-foreground">{company.industry}</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Revenue</p>
                  <p className="text-[13px] font-semibold">{company.revenue}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Employees</p>
                  <p className="text-[13px] font-semibold">{company.employees}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Source</p>
                  <p className="text-[13px] font-semibold">{company.source}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border">
              <span className="text-[10px] text-muted-foreground">Last updated {company.lastUpdated}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
