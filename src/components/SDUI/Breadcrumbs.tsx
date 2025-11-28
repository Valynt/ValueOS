/**
 * Breadcrumbs Component
 * 
 * Path indicators with separators for navigation hierarchy.
 * Supports dark theme with neon green active state.
 */

import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  showHome?: boolean;
  maxItems?: number;
  onNavigate?: (item: BreadcrumbItem) => void;
  className?: string;
}

/**
 * Breadcrumbs Component
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  separator = <ChevronRight size={16} />,
  showHome = true,
  maxItems,
  onNavigate,
  className = '',
}) => {
  const handleItemClick = (item: BreadcrumbItem, index: number) => {
    // Don't navigate if it's the last item (current page)
    if (index === items.length - 1) return;
    
    if (item.onClick) {
      item.onClick();
    }
    
    onNavigate?.(item);
  };

  // Collapse items if maxItems is set
  const displayItems = React.useMemo(() => {
    if (!maxItems || items.length <= maxItems) {
      return items;
    }
    
    // Show first item, ellipsis, and last (maxItems - 2) items
    const firstItem = items[0];
    const lastItems = items.slice(-(maxItems - 2));
    
    return [
      firstItem,
      { id: 'ellipsis', label: '...', onClick: undefined },
      ...lastItems,
    ];
  }, [items, maxItems]);

  return (
    <nav
      className={`sdui-breadcrumbs ${className}`}
      aria-label="Breadcrumb"
    >
      <ol className="sdui-breadcrumbs-list">
        {showHome && (
          <>
            <li className="sdui-breadcrumb-item">
              <button
                onClick={() => onNavigate?.({ id: 'home', label: 'Home' })}
                className="sdui-breadcrumb-link"
                aria-label="Home"
              >
                <Home size={16} />
              </button>
            </li>
            <li className="sdui-breadcrumb-separator" aria-hidden="true">
              {separator}
            </li>
          </>
        )}
        
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const isEllipsis = item.id === 'ellipsis';
          
          return (
            <React.Fragment key={item.id}>
              <li className="sdui-breadcrumb-item">
                {isEllipsis ? (
                  <span className="sdui-breadcrumb-ellipsis">
                    {item.label}
                  </span>
                ) : isLast ? (
                  <span className="sdui-breadcrumb-current" aria-current="page">
                    {item.icon && (
                      <span className="sdui-breadcrumb-icon">
                        {item.icon}
                      </span>
                    )}
                    {item.label}
                  </span>
                ) : (
                  <button
                    onClick={() => handleItemClick(item, index)}
                    className="sdui-breadcrumb-link"
                  >
                    {item.icon && (
                      <span className="sdui-breadcrumb-icon">
                        {item.icon}
                      </span>
                    )}
                    {item.label}
                  </button>
                )}
              </li>
              
              {!isLast && (
                <li className="sdui-breadcrumb-separator" aria-hidden="true">
                  {separator}
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
      
      <style jsx>{`
        .sdui-breadcrumbs {
          display: flex;
          align-items: center;
          padding: 12px 0;
        }
        
        .sdui-breadcrumbs-list {
          display: flex;
          align-items: center;
          gap: 8px;
          list-style: none;
          margin: 0;
          padding: 0;
        }
        
        .sdui-breadcrumb-item {
          display: flex;
          align-items: center;
        }
        
        .sdui-breadcrumb-link {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          background-color: transparent;
          border: none;
          border-radius: 4px;
          color: #B3B3B3;
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .sdui-breadcrumb-link:hover {
          background-color: rgba(57, 255, 20, 0.1);
          color: #39FF14;
        }
        
        .sdui-breadcrumb-current {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          color: #39FF14;
          font-size: 14px;
          font-weight: 600;
        }
        
        .sdui-breadcrumb-ellipsis {
          padding: 4px 8px;
          color: #808080;
          font-size: 14px;
          font-weight: 500;
        }
        
        .sdui-breadcrumb-separator {
          display: flex;
          align-items: center;
          color: #808080;
        }
        
        .sdui-breadcrumb-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </nav>
  );
};

export default Breadcrumbs;
