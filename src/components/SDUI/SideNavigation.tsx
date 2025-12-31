/**
 * SideNavigation Component
 * 
 * Collapsible sidebar navigation with workflow stages.
 * Supports dark theme with neon green active indicators.
 */

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface NavigationItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  badge?: string | number;
  disabled?: boolean;
  children?: NavigationItem[];
}

export interface SideNavigationProps {
  items: NavigationItem[];
  activeId?: string;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  onNavigate?: (item: NavigationItem) => void;
  className?: string;
}

/**
 * SideNavigation Component
 */
export const SideNavigation: React.FC<SideNavigationProps> = ({
  items,
  activeId,
  collapsed: controlledCollapsed,
  onCollapse,
  onNavigate,
  className = '',
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  
  const collapsed = controlledCollapsed ?? internalCollapsed;
  
  const handleCollapse = () => {
    const newCollapsed = !collapsed;
    setInternalCollapsed(newCollapsed);
    onCollapse?.(newCollapsed);
  };

  const handleItemClick = (item: NavigationItem) => {
    if (item.disabled) return;
    
    if (item.onClick) {
      item.onClick();
    }
    
    onNavigate?.(item);
  };

  const renderItem = (item: NavigationItem, level = 0) => {
    const isActive = item.id === activeId;
    const hasChildren = item.children && item.children.length > 0;
    
    return (
      <div key={item.id} className="sdui-nav-item-wrapper">
        <button
          onClick={() => handleItemClick(item)}
          disabled={item.disabled}
          className={`
            sdui-nav-item
            ${isActive ? 'sdui-nav-item-active' : ''}
            ${item.disabled ? 'sdui-nav-item-disabled' : ''}
            ${collapsed ? 'sdui-nav-item-collapsed' : ''}
          `}
          style={{ paddingLeft: `${16 + level * 16}px` }}
          title={collapsed ? item.label : undefined}
        >
          {item.icon && (
            <span className="sdui-nav-item-icon">
              {item.icon}
            </span>
          )}
          
          {!collapsed && (
            <>
              <span className="sdui-nav-item-label">
                {item.label}
              </span>
              
              {item.badge && (
                <span className="sdui-nav-item-badge">
                  {item.badge}
                </span>
              )}
            </>
          )}
        </button>
        
        {!collapsed && hasChildren && (
          <div className="sdui-nav-children">
            {item.children!.map(child => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav
      className={`sdui-side-navigation ${collapsed ? 'sdui-side-navigation-collapsed' : ''} ${className}`}
    >
      <div className="sdui-side-navigation-header">
        <button
          onClick={handleCollapse}
          className="sdui-side-navigation-toggle"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      
      <div className="sdui-side-navigation-content">
        {items.map(item => renderItem(item))}
      </div>
      
      <style jsx>{`
        .sdui-side-navigation {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: #1A1A1A;
          border-right: 1px solid #444444;
          transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1);
          width: 256px;
        }
        
        .sdui-side-navigation-collapsed {
          width: 64px;
        }
        
        .sdui-side-navigation-header {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 16px;
          border-bottom: 1px solid #444444;
        }
        
        .sdui-side-navigation-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background-color: transparent;
          border: none;
          border-radius: 4px;
          color: #B3B3B3;
          cursor: pointer;
          transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .sdui-side-navigation-toggle:hover {
          background-color: #333333;
          color: #39FF14;
        }
        
        .sdui-side-navigation-content {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }
        
        .sdui-nav-item-wrapper {
          margin-bottom: 4px;
        }
        
        .sdui-nav-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 12px 16px;
          background-color: transparent;
          border: none;
          border-radius: 4px;
          color: #B3B3B3;
          font-size: 14px;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .sdui-nav-item:hover:not(.sdui-nav-item-disabled) {
          background-color: #333333;
          color: #FFFFFF;
        }
        
        .sdui-nav-item-active {
          background-color: rgba(57, 255, 20, 0.1);
          color: #39FF14;
          border-left: 3px solid #39FF14;
        }
        
        .sdui-nav-item-disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .sdui-nav-item-collapsed {
          justify-content: center;
          padding: 12px;
        }
        
        .sdui-nav-item-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          margin-right: 12px;
        }
        
        .sdui-nav-item-collapsed .sdui-nav-item-icon {
          margin-right: 0;
        }
        
        .sdui-nav-item-label {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .sdui-nav-item-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          background-color: #39FF14;
          color: #121212;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
          margin-left: 8px;
        }
        
        .sdui-nav-children {
          margin-top: 4px;
        }
      `}</style>
    </nav>
  );
};

export default SideNavigation;
