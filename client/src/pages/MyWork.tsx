/*
 * VALYNT My Work Page — Personal dashboard
 * Shows "Continue where you left off", recent cases, quick actions
 * Matches reference: greeting + resume card + recent cases
 */
import { Link } from "wouter";
import { ArrowRight, Clock, TrendingUp, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { valueCases, formatCurrency } from "@/lib/data";
import { toast } from "sonner";

const myRecentCases = valueCases.filter((c) => c.ownerEmail === "brian@me.com").slice(0, 3);

export default function MyWork() {
  return (
    <div className="p-6 max-w-4xl">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-foreground">Good evening, Brian</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Ready to prove some value today?</p>
      </div>

      {/* Continue where you left off */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-emerald-600" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Continue where you left off</p>
          <span className="text-[10px] text-muted-foreground">· Edited 25m ago</span>
        </div>
        <Link href="/cases/vc_1">
          <div className="border border-border rounded-xl p-4 bg-card hover:bg-accent/30 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-semibold text-foreground">Acme Corp Value Case</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">Refining cost assumptions in the "Efficiency Model" stage</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </Link>
      </div>

      {/* Start something new */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Start something new</p>
        <div className="flex items-center gap-2 border border-border rounded-xl px-4 py-3 bg-card">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder='e.g., "Build a business case for Stripe" or "Analyze..."'
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter") toast("Agent analysis starting...");
            }}
          />
        </div>
      </div>

      {/* Research Company */}
      <div className="mb-6">
        <div className="flex items-center gap-2 border border-border rounded-xl px-4 py-3 bg-card">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Research Company"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Recent Cases */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent Cases</p>
        <div className="space-y-2">
          {myRecentCases.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`}>
              <div className="border border-border rounded-xl p-4 bg-card hover:bg-accent/30 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground">
                      {c.company.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-foreground">{c.company}</p>
                        <Badge className={cn(
                          "text-[9px] font-semibold capitalize",
                          c.status === "running" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                          c.status === "committed" ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
                          c.status === "completed" ? "bg-purple-100 text-purple-700 hover:bg-purple-100" :
                          "bg-muted text-muted-foreground hover:bg-muted"
                        )}>
                          {c.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="w-3 h-3" />
                        {formatCurrency(c.totalValue)} Value
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Edited {c.lastUpdated}</p>
                    <button className="text-[11px] text-foreground font-medium hover:underline">Open →</button>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
