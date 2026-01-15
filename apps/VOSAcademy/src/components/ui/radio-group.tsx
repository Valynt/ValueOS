import * as React from 'react';

interface RadioGroupContextValue {
  value?: string;
  onChange?: (value: string) => void;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export function RadioGroup({ value, defaultValue, onValueChange, children, ...props }: RadioGroupProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const handleChange = (next: string) => {
    setInternalValue(next);
    onValueChange?.(next);
  };

  return (
    <RadioGroupContext.Provider value={{ value: value ?? internalValue, onChange: handleChange }}>
      <div role="radiogroup" {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

interface RadioGroupItemProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
}

export function RadioGroupItem({ value: itemValue, children, ...props }: RadioGroupItemProps) {
  const context = React.useContext(RadioGroupContext);
  const checked = context?.value === itemValue;
  return (
    <label>
      <input
        type="radio"
        checked={checked}
        onChange={() => context?.onChange?.(itemValue)}
        value={itemValue}
        {...props}
      />
      {children}
    </label>
  );
}
