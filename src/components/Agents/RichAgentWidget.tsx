import { useState } from 'react';
import { Check, ChevronRight, Undo2, X } from 'lucide-react';

interface SliderWidgetConfig {
  type: 'slider';
  label: string;
  min: number;
  max: number;
  value: number;
  unit: string;
  suggestion: number;
}

interface SelectWidgetConfig {
  type: 'select';
  label: string;
  options: Array<{ id: string; label: string; description?: string }>;
  selected?: string;
}

interface ConfirmWidgetConfig {
  type: 'confirm';
  action: string;
  description: string;
  impact?: string;
}

interface ScenarioWidgetConfig {
  type: 'scenario';
  title: string;
  description: string;
  options: Array<{ id: string; label: string; impact: string }>;
}

type WidgetConfig = SliderWidgetConfig | SelectWidgetConfig | ConfirmWidgetConfig | ScenarioWidgetConfig;

interface RichAgentWidgetProps {
  config: WidgetConfig;
  onConfirm: (value: unknown) => void;
  onCancel?: () => void;
}

function SliderWidget({ config, onConfirm }: { config: SliderWidgetConfig; onConfirm: (value: number) => void }) {
  const [value, setValue] = useState(config.suggestion);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm(value);
  };

  if (confirmed) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-500">
        <Check className="w-3.5 h-3.5" />
        <span>Applied: {value}{config.unit}</span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-background/50 rounded-lg border border-border/50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{config.label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{value}{config.unit}</span>
          {value !== config.value && (
            <button
              onClick={() => setValue(config.value)}
              className="p-1 hover:bg-secondary rounded text-muted-foreground"
              title="Reset to original"
            >
              <Undo2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={config.min}
        max={config.max}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{config.min}{config.unit}</span>
        <span className="text-amber-400">Suggested: {config.suggestion}{config.unit}</span>
        <span>{config.max}{config.unit}</span>
      </div>
      <button
        onClick={handleConfirm}
        className="w-full btn btn-primary h-8 text-xs justify-center"
      >
        Apply {value}{config.unit}
      </button>
    </div>
  );
}

function SelectWidget({ config, onConfirm }: { config: SelectWidgetConfig; onConfirm: (value: string) => void }) {
  const [selected, setSelected] = useState(config.selected);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    if (!selected) return;
    setConfirmed(true);
    onConfirm(selected);
  };

  if (confirmed) {
    const option = config.options.find(o => o.id === selected);
    return (
      <div className="flex items-center gap-2 text-xs text-green-500">
        <Check className="w-3.5 h-3.5" />
        <span>Selected: {option?.label}</span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-background/50 rounded-lg border border-border/50 space-y-2">
      <span className="text-xs text-muted-foreground">{config.label}</span>
      <div className="space-y-1.5">
        {config.options.map((option) => (
          <button
            key={option.id}
            onClick={() => setSelected(option.id)}
            className={`w-full p-2 rounded-lg border text-left transition-colors ${
              selected === option.id
                ? 'bg-foreground/10 border-foreground/30'
                : 'bg-secondary/30 border-border hover:border-muted-foreground/30'
            }`}
          >
            <div className="text-xs font-medium text-foreground">{option.label}</div>
            {option.description && (
              <div className="text-[10px] text-muted-foreground mt-0.5">{option.description}</div>
            )}
          </button>
        ))}
      </div>
      <button
        onClick={handleConfirm}
        disabled={!selected}
        className="w-full btn btn-primary h-8 text-xs justify-center disabled:opacity-50"
      >
        Confirm Selection
      </button>
    </div>
  );
}

function ConfirmWidget({ config, onConfirm, onCancel }: { config: ConfirmWidgetConfig; onConfirm: () => void; onCancel?: () => void }) {
  const [confirmed, setConfirmed] = useState<boolean | null>(null);

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm();
  };

  const handleCancel = () => {
    setConfirmed(false);
    onCancel?.();
  };

  if (confirmed === true) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-500">
        <Check className="w-3.5 h-3.5" />
        <span>Confirmed: {config.action}</span>
      </div>
    );
  }

  if (confirmed === false) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <X className="w-3.5 h-3.5" />
        <span>Declined</span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-background/50 rounded-lg border border-border/50 space-y-2">
      <div className="text-xs font-medium text-foreground">{config.action}</div>
      <div className="text-[10px] text-muted-foreground">{config.description}</div>
      {config.impact && (
        <div className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
          Impact: {config.impact}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={handleConfirm} className="flex-1 btn btn-primary h-8 text-xs justify-center">
          <Check className="w-3.5 h-3.5 mr-1" />
          Approve
        </button>
        <button onClick={handleCancel} className="btn btn-outline h-8 text-xs px-3">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function ScenarioWidget({ config, onConfirm }: { config: ScenarioWidgetConfig; onConfirm: (value: string) => void }) {
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setConfirmed(id);
    onConfirm(id);
  };

  if (confirmed) {
    const option = config.options.find(o => o.id === confirmed);
    return (
      <div className="flex items-center gap-2 text-xs text-green-500">
        <Check className="w-3.5 h-3.5" />
        <span>Pursuing: {option?.label}</span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-background/50 rounded-lg border border-border/50 space-y-2">
      <div className="text-xs font-medium text-foreground">{config.title}</div>
      <div className="text-[10px] text-muted-foreground">{config.description}</div>
      <div className="space-y-1.5 pt-1">
        {config.options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            className="w-full p-2 rounded-lg bg-secondary/30 border border-border hover:border-muted-foreground/30 text-left transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{option.label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5">{option.impact}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RichAgentWidget({ config, onConfirm, onCancel }: RichAgentWidgetProps) {
  switch (config.type) {
    case 'slider':
      return <SliderWidget config={config} onConfirm={onConfirm as (value: number) => void} />;
    case 'select':
      return <SelectWidget config={config} onConfirm={onConfirm as (value: string) => void} />;
    case 'confirm':
      return <ConfirmWidget config={config} onConfirm={onConfirm as () => void} onCancel={onCancel} />;
    case 'scenario':
      return <ScenarioWidget config={config} onConfirm={onConfirm as (value: string) => void} />;
    default:
      return null;
  }
}
