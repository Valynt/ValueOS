/**
 * TabBar Component
 * 
 * Secondary navigation with neon green active indicator.
 * Supports horizontal scrolling for many tabs.
 */

import React, { useRef, useEffect } from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
  href?: string;
}

export interface TabBarProps {
  tabs: Tab[];
  activeId?: string;
  onTabChange?: (tab: Tab) => void;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * TabBar Component
 */
export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeId,
  onTabChange,
  variant = 'underline',
  size = 'md',
  className = '',
}) => {
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Scroll active tab into view
  useEffect(() => {
    if (activeTabRef.current && tabsRef.current) {
      const tabElement = activeTabRef.current;
      const containerElement = tabsRef.current;
      
      const tabLeft = tabElement.offsetLeft;
      const tabRight = tabLeft + tabElement.offsetWidth;
      const containerLeft = containerElement.scrollLeft;
      const containerRight = containerLeft + containerElement.offsetWidth;
      
      if (tabLeft < containerLeft) {
        containerElement.scrollLeft = tabLeft - 16;
      } else if (tabRight > containerRight) {
        containerElement.scrollLeft = tabRight - containerElement.offsetWidth + 16;
      }
    }
  }, [activeId]);

  const handleTabClick = (tab: Tab) => {
    if (tab.disabled) return;
    onTabChange?.(tab);
  };

  const sizeClasses = {
    sm: 'sdui-tab-sm',
    md: 'sdui-tab-md',
    lg: 'sdui-tab-lg',
  };

  return (
    <div className={`sdui-tab-bar sdui-tab-bar-${variant} ${className}`}>
      <div ref={tabsRef} className="sdui-tab-bar-scroll">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          
          return (
            <button
              key={tab.id}
              ref={isActive ? activeTabRef : null}
              onClick={() => handleTabClick(tab)}
              disabled={tab.disabled}
              className={`
                sdui-tab
                ${sizeClasses[size]}
                ${isActive ? 'sdui-tab-active' : ''}
                ${tab.disabled ? 'sdui-tab-disabled' : ''}
              `}
              aria-selected={isActive}
              role="tab"
            >
              {tab.icon && (
                <span className="sdui-tab-icon">
                  {tab.icon}
                </span>
              )}
              
              <span className="sdui-tab-label">
                {tab.label}
              </span>
              
              {tab.badge && (
                <span className="sdui-tab-badge">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      
      <style jsx>{`
        .sdui-tab-bar {
          position: relative;
          background-color: #1A1A1A;
          border-bottom: 1px solid #444444;
        }
        
        .sdui-tab-bar-scroll {
          display: flex;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        
        .sdui-tab-bar-scroll::-webkit-scrollbar {
          display: none;
        }
        
        .sdui-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background-color: transparent;
          border: none;
          color: #B3B3B3;
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
          cursor: pointer;
          transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }
        
        .sdui-tab:hover:not(.sdui-tab-disabled) {
          color: #FFFFFF;
          background-color: rgba(255, 255, 255, 0.05);
        }
        
        .sdui-tab-active {
          color: #39FF14;
        }
        
        .sdui-tab-disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        /* Underline variant */
        .sdui-tab-bar-underline .sdui-tab-active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background-color: #39FF14;
          box-shadow: 0 0 8px #39FF14;
        }
        
        /* Pills variant */
        .sdui-tab-bar-pills .sdui-tab {
          margin: 4px;
          border-radius: 4px;
        }
        
        .sdui-tab-bar-pills .sdui-tab-active {
          background-color: rgba(57, 255, 20, 0.1);
        }
        
        /* Default variant */
        .sdui-tab-bar-default .sdui-tab-active {
          background-color: #333333;
        }
        
        /* Sizes */
        .sdui-tab-sm {
          padding: 8px 12px;
          font-size: 12px;
        }
        
        .sdui-tab-md {
          padding: 12px 16px;
          font-size: 14px;
        }
        
        .sdui-tab-lg {
          padding: 16px 20px;
          font-size: 16px;
        }
        
        .sdui-tab-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
        }
        
        .sdui-tab-label {
          line-height: 1;
        }
        
        .sdui-tab-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 6px;
          background-color: #39FF14;
          color: #121212;
          border-radius: 9px;
          font-size: 11px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default TabBar;
