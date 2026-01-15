import * as React from 'react';

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export function Tabs({ value, defaultValue = '', onValueChange, children, className, ...props }: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const activeValue = value ?? internalValue;

  const handleChange = (next: string) => {
    setInternalValue(next);
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider value={{ value: activeValue, setValue: handleChange }}>
      <div className={className} {...props}>{children}</div>
    </TabsContext.Provider>
  );
}

export const TabsList = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div role="tablist" {...props}>
    {children}
  </div>
);

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({ value: triggerValue, children, ...props }: TabsTriggerProps) {
  const context = React.useContext(TabsContext);
  const isActive = context?.value === triggerValue;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => context?.setValue(triggerValue)}
      {...props}
    >
      {children}
    </button>
  );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({ value: contentValue, children, ...props }: TabsContentProps) {
  const context = React.useContext(TabsContext);
  if (context && context.value !== contentValue) {
    return null;
  }
  return (
    <div role="tabpanel" {...props}>
      {children}
    </div>
  );
}
