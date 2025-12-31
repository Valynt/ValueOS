import { Link } from 'react-router-dom';
import { Building2, ChevronRight, Clock, Plus, Search, Sparkles } from 'lucide-react';
import AgentBadge from '../components/Agents/AgentBadge';

const accounts = [
  {
    id: 1,
    name: 'Acme Corp',
    industry: 'Manufacturing',
    stage: 'Value Architecture',
    potential: '$4.2M',
    health: 88,
    lastActive: '2h ago',
    logo: 'AC',
  },
  {
    id: 2,
    name: 'TechStart Inc',
    industry: 'Software',
    stage: 'Discovery',
    potential: '$1.5M',
    health: 92,
    lastActive: 'Yesterday',
    logo: 'TS',
  },
  {
    id: 3,
    name: 'Global Logistics',
    industry: 'Transport',
    stage: 'Business Case',
    potential: '$8.5M',
    health: 74,
    lastActive: '3d ago',
    logo: 'GL',
  },
  {
    id: 4,
    name: 'FinServe Group',
    industry: 'Finance',
    stage: 'Realization',
    potential: '$2.1M',
    health: 96,
    lastActive: '1w ago',
    logo: 'FS',
  }
];

export default function Home() {
  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="max-w-6xl mx-auto px-8 py-12">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight mb-2">
              Accounts & Prospects
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage your client portfolio and value lifecycles.
            </p>
          </div>
          <button className="btn btn-primary h-10 px-4 shadow-lg shadow-primary/10">
            <Plus className="w-4 h-4 mr-2" />
            New Opportunity
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="card p-5 border-l-4 border-l-primary">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-2">Pipeline Value</div>
            <div className="text-3xl font-bold text-foreground">$16.3M</div>
          </div>
          <div className="card p-5 border-l-4 border-l-primary/70">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-2">Active Engagements</div>
            <div className="text-3xl font-bold text-foreground">12</div>
          </div>
          <div className="card p-5 border-l-4 border-l-primary/50">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-2">Realized To Date</div>
            <div className="text-3xl font-bold text-foreground">$4.8M</div>
          </div>
          <div className="card p-5 border-l-4 border-l-neutral-500">
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-2">System Integrity</div>
            <div className="text-3xl font-bold text-primary">94%</div>
          </div>
        </div>

        <div className="card p-4 mb-8 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <AgentBadge agentId="company-intelligence" size="sm" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">
                <span className="font-medium">Ready to research.</span>
                <span className="text-muted-foreground ml-1">I can scan 10-K filings, news, and industry reports for any company.</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-outline h-8 px-3 text-xs">
                <Search className="w-3.5 h-3.5 mr-1.5" />
                Research Acme Corp
              </button>
              <button className="btn btn-primary h-8 px-3 text-xs">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Scan New Company
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-12 px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border/50">
            <div className="col-span-4">Company</div>
            <div className="col-span-3">Current Stage</div>
            <div className="col-span-2">Value Potential</div>
            <div className="col-span-2">Last Activity</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {accounts.map((account) => {
            const stageAgent = {
              'Discovery': 'company-intelligence',
              'Value Architecture': 'value-mapping',
              'Business Case': 'financial-modeling',
              'Realization': 'realization'
            }[account.stage] as 'company-intelligence' | 'value-mapping' | 'financial-modeling' | 'realization';

            return (
              <Link
                key={account.id}
                to="/canvas"
                className="group card grid grid-cols-12 items-center px-6 py-4 hover:border-primary/30 hover:shadow-md transition-all duration-200"
              >
                <div className="col-span-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold shadow-sm">
                    {account.logo}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-base">{account.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="w-3 h-3" />
                      {account.industry}
                    </div>
                  </div>
                </div>

                <div className="col-span-3 flex items-center gap-2">
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-foreground border border-border">
                    {account.stage}
                  </div>
                  <AgentBadge agentId={stageAgent} size="sm" showName={false} />
                </div>

                <div className="col-span-2">
                  <div className="text-sm font-medium text-foreground">{account.potential}</div>
                </div>

                <div className="col-span-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  {account.lastActive}
                </div>

                <div className="col-span-1 flex justify-end">
                  <button className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
