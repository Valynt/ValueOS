import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronUp,
  HelpCircle,
  LogOut,
  Settings,
  Shield,
  User
} from 'lucide-react';

interface UserProfileDropdownProps {
  isExpanded: boolean;
}

const menuItems = [
  { icon: User, label: 'Account Settings', action: () => console.log('Account') },
  { icon: Settings, label: 'Preferences', action: () => console.log('Preferences') },
  { icon: Bell, label: 'Notifications', action: () => console.log('Notifications') },
  { icon: HelpCircle, label: 'Help & Support', action: () => console.log('Help') },
  { icon: Shield, label: 'Privacy Settings', action: () => console.log('Privacy') },
];

export default function UserProfileDropdown({ isExpanded }: UserProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    } else if (event.key === 'Enter' || event.key === ' ') {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <div
        className={`
          overflow-hidden transition-all duration-300 ease-out
          ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        <div className="pb-2">
          <div className="bg-secondary/80 rounded-xl border border-border/50 overflow-hidden">
            <nav role="menu" aria-label="User menu">
              {menuItems.map((item, index) => (
                <button
                  key={item.label}
                  role="menuitem"
                  tabIndex={isOpen ? 0 : -1}
                  onClick={() => {
                    item.action();
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground
                    hover:bg-secondary hover:text-foreground transition-colors
                    ${index === 0 ? 'rounded-t-xl' : ''}
                    ${index === menuItems.length - 1 ? 'rounded-b-xl' : ''}
                  `}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="border-t border-border/50">
              <button
                role="menuitem"
                tabIndex={isOpen ? 0 : -1}
                onClick={() => {
                  console.log('Logout');
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors rounded-b-xl"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="User profile menu"
        title={!isExpanded ? 'Brian Sullivan' : undefined}
        className={`
          w-full flex items-center rounded-xl transition-all duration-200
          ${isExpanded ? 'gap-3 p-2 hover:bg-secondary/80' : 'justify-center p-2 hover:bg-secondary/80'}
          ${isOpen ? 'bg-secondary/80' : ''}
        `}
      >
        <div className="w-9 h-9 rounded-lg bg-amber-700 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
          B
        </div>

        {isExpanded && (
          <>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium text-foreground truncate">Brian Sullivan</div>
              <div className="text-xs text-muted-foreground truncate">Subscription & Settings</div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-600 text-white rounded">
                Unlimited
              </span>
              <ChevronUp
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </>
        )}
      </button>
    </div>
  );
}
