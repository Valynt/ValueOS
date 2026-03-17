import * as React from 'react';

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export function Select({ value, defaultValue, onValueChange, children }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue);

  const handleChange = (next: string) => {
    setInternalValue(next);
    onValueChange?.(next);
  };

  return (
    <SelectContext.Provider value={{ value: value ?? internalValue, onValueChange: handleChange }}>
      <div>{children}</div>
    </SelectContext.Provider>
  );
}

export const SelectTrigger = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" {...props}>
    {children}
  </button>
);

export const SelectContent = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div role="listbox" {...props}>
    {children}
  </div>
);

interface SelectItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function SelectItem({ value: itemValue, children, ...props }: SelectItemProps) {
  const context = React.useContext<SelectContextValue | null>(SelectContext);
  const handleClick = () => context?.onValueChange?.(itemValue);

  return (
    // eslint-disable-next-line jsx-a11y/role-has-required-aria-props -- managed by parent component
    <button type="button" role="option" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

interface SelectValueProps {
  placeholder?: React.ReactNode;
}

export function SelectValue({ placeholder }: SelectValueProps) {
  const context = React.useContext<SelectContextValue | null>(SelectContext);
  return <span>{context?.value ?? placeholder}</span>;
}
