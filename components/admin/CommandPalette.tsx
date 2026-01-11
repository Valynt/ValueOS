/**
 * Command Palette Component
 * 
 * Quick access to all configuration settings via keyboard (⌘+K)
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Settings, Zap, Shield, DollarSign } from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (tab: 'organization' | 'ai', section?: string) => void;
}

interface Command {
  id: string;
  title: string;
  description: string;
  category: 'organization' | 'ai';
  section?: string;
  icon: React.ReactNode;
  keywords: string[];
}

const commands: Command[] = [
  // Organization commands
  {
    id: 'tenant-provisioning',
    title: 'Tenant Provisioning',
    description: 'Manage tenant lifecycle and resource limits',
    category: 'organization',
    section: 'tenant_provisioning',
    icon: <Settings className="h-4 w-4" />,
    keywords: ['tenant', 'provision', 'status', 'users', 'storage', 'limits']
  },
  {
    id: 'custom-branding',
    title: 'Custom Branding',
    description: 'Customize organization appearance and theme',
    category: 'organization',
    section: 'custom_branding',
    icon: <Settings className="h-4 w-4" />,
    keywords: ['branding', 'logo', 'colors', 'theme', 'fonts']
  },
  {
    id: 'data-residency',
    title: 'Data Residency',
    description: 'Configure geographic data storage',
    category: 'organization',
    section: 'data_residency',
    icon: <Settings className="h-4 w-4" />,
    keywords: ['data', 'residency', 'region', 'compliance', 'gdpr']
  },
  // AI commands
  {
    id: 'llm-spending',
    title: 'LLM Spending Limits',
    description: 'Configure budget caps and spending alerts',
    category: 'ai',
    section: 'llm_spending_limits',
    icon: <DollarSign className="h-4 w-4" />,
    keywords: ['llm', 'spending', 'budget', 'limits', 'cost', 'alerts']
  },
  {
    id: 'model-routing',
    title: 'Model Routing',
    description: 'Configure default model and routing strategies',
    category: 'ai',
    section: 'model_routing',
    icon: <Zap className="h-4 w-4" />,
    keywords: ['model', 'routing', 'llm', 'gpt', 'claude', 'llama']
  },
  {
    id: 'agent-toggles',
    title: 'Agent Toggles',
    description: 'Enable or disable specific AI agents',
    category: 'ai',
    section: 'agent_toggles',
    icon: <Zap className="h-4 w-4" />,
    keywords: ['agent', 'toggle', 'enable', 'disable', 'ai']
  },
  {
    id: 'hitl-thresholds',
    title: 'HITL Thresholds',
    description: 'Configure human-in-the-loop confidence thresholds',
    category: 'ai',
    section: 'hitl_thresholds',
    icon: <Shield className="h-4 w-4" />,
    keywords: ['hitl', 'human', 'review', 'threshold', 'confidence']
  }
];

export function CommandPalette({ open, onOpenChange, onNavigate }: CommandPaletteProps) {
  const [search, setSearch] = useState('');

  const filteredCommands = useMemo(() => {
    if (!search) return commands;

    const searchLower = search.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(searchLower) ||
        cmd.description.toLowerCase().includes(searchLower) ||
        cmd.keywords.some((kw) => kw.includes(searchLower))
    );
  }, [search]);

  const handleSelect = (command: Command) => {
    onNavigate(command.category, command.section);
    onOpenChange(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="sr-only">Command Palette</DialogTitle>
          <DialogDescription className="sr-only">
            Search and navigate to configuration settings
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search settings..."
            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">ESC</span>
          </kbd>
        </div>

        <ScrollArea className="max-h-[400px]">
          {filteredCommands.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No settings found
            </div>
          ) : (
            <div className="p-2">
              {filteredCommands.map((command) => (
                <button
                  key={command.id}
                  onClick={() => handleSelect(command)}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-3 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-md border bg-background">
                    {command.icon}
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium">{command.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {command.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Navigate with ↑↓ • Select with ↵</span>
            <span>Close with ESC</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
