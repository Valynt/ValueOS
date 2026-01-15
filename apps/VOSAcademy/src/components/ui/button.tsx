import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: string;
  size?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} {...props}>
      {children}
    </button>
  )
);

Button.displayName = 'Button';
