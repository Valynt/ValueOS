import * as React from "react"

import { cn } from "../../lib/utils"

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  onValueChange?: (value: string) => void
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("grid gap-2", className)}
      role="radiogroup"
      {...props}
    />
  )
)
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { value?: string }
>(({ className, value, ...props }, ref) => (
  <input
    type="radio"
    value={value}
    className={cn(
      "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  />
))
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
