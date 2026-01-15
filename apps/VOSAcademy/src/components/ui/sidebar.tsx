import * as React from 'react';

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
  state?: 'expanded' | 'collapsed';
  toggleSidebar?: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

interface SidebarProviderComponentProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function SidebarProvider({ children, style }: SidebarProviderComponentProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const toggle = React.useCallback(() => setCollapsed(prev => !prev), []);

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggle,
        state: collapsed ? 'collapsed' : 'expanded',
        toggleSidebar: toggle
      }}
    >
      <div style={style}>
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) {
    return {
      collapsed: false,
      toggle: () => {},
      state: 'expanded' as const,
      toggleSidebar: () => {}
    };
  }
  return ctx;
};

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsible?: 'icon' | 'offcanvas' | 'none';
  disableTransition?: boolean;
}

export const Sidebar = ({ children, collapsible, disableTransition, style, ...props }: SidebarProps) => (
  <aside {...props} style={style} data-collapsible={collapsible}>
    {children}
  </aside>
);

interface SidebarProviderProps extends React.HTMLAttributes<HTMLDivElement> {
  style?: React.CSSProperties;
}

export const SidebarHeader = ({ children, style, ...props }: SidebarProviderProps) => <div {...props} style={style}>{children}</div>;
export const SidebarContent = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>;
export const SidebarFooter = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>;
export const SidebarInset = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>;
export const SidebarMenu = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <nav {...props}>{children}</nav>;
export const SidebarMenuItem = ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => <li {...props}>{children}</li>;

interface SidebarMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
  tooltip?: string;
  asChild?: boolean;
}

export const SidebarMenuButton = ({ children, isActive, tooltip, asChild, ...props }: SidebarMenuButtonProps) => (
  <button type="button" data-active={isActive} title={tooltip} {...props}>
    {children}
  </button>
);

export const SidebarTrigger = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const ctx = React.useContext(SidebarContext);
  return (
    <button type="button" onClick={() => ctx?.toggle()} {...props}>
      {children}
    </button>
  );
};
