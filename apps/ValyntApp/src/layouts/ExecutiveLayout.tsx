/**
 * ExecutiveLayout Component
 *
 * Three-panel layout with:
 * - Left: Compact icon navigation (80px)
 * - Center: Main content area (flexible)
 * - Right: AI chat sidebar (380px)
 *
 * Used for executive summary, value case workspace, and dashboard views.
 */

import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { AIChatPanel } from '@/components/ui/AIChatPanel';
import { aiSidebarReveal, slideInUp } from '@/lib/animations';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/components/ui/AIChatPanel';

// Navigation items
const navItems = [
  { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { id: 'opportunities', icon: 'psychology', label: 'Intelligence', path: '/opportunities' },
  { id: 'models', icon: 'calculate', label: 'Models', path: '/models' },
  { id: 'integrations', icon: 'settings_input_component', label: 'Integrations', path: '/integrations' },
];

const bottomNavItems = [
  { id: 'help', icon: 'help', label: 'Help', path: '/help' },
  { id: 'profile', icon: 'account_circle', label: 'Profile', path: '/settings' },
];

// Mock chat messages for demo
const mockMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    content: 'Hello! I\'m your Vizit AI Assistant. I\'ve analyzed the latest visual intelligence data for your value case.',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: '2',
    role: 'assistant',
    content: 'The revenue category is currently trending upward. Adjusting your projections could increase conversion by 4.1%.',
    timestamp: new Date(Date.now() - 1000 * 60 * 4),
    metadata: {
      agentId: 'value-analyst',
      actions: [
        { label: 'View Data', action: 'view-data' },
        { label: 'Apply Bias', action: 'apply-bias' },
      ],
    },
  },
];

export function ExecutiveLayout() {
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState(mockMessages);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const { user, logout } = useAuth();
  const { currentTenant } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = location.pathname;

  const isActiveRoute = (path: string) => {
    if (path === '/dashboard') {
      return currentPath === '/dashboard' || currentPath === '/';
    }
    return currentPath.startsWith(path);
  };

  const handleSendMessage = async (message: string) => {
    // Add user message
    const userMsg = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: message,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsAiLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: `I've analyzed your request about "${message}". Based on your current value model, I recommend focusing on the revenue optimization strategies we discussed.`,
        timestamp: new Date(),
        metadata: {
          agentId: 'executive-assistant',
          confidence: 0.92,
        },
      };
      setChatMessages(prev => [...prev, aiMsg]);
      setIsAiLoading(false);
    }, 2000);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-md-surface">
      {/* Left Navigation */}
      <aside className="w-20 flex-shrink-0 bg-md-surface-container-lowest border-r border-md-outline-variant flex flex-col py-6">
        {/* Logo */}
        <div className="px-4 mb-8 flex justify-center">
          <div className="w-12 h-12 bg-md-primary-container rounded-xl flex items-center justify-center text-white shadow-lg">
            <MaterialIcon icon="auto_awesome" filled className="text-xl" />
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 flex flex-col gap-1 px-2">
          {navItems.map((item) => {
            const isActive = isActiveRoute(item.path);
            return (
              <Link
                key={item.id}
                to={item.path}
                className={cn(
                  'flex items-center justify-center py-3 rounded-xl transition-all duration-200 group',
                  isActive
                    ? 'bg-md-surface-container-high text-md-tertiary-container'
                    : 'text-md-on-surface-variant hover:bg-md-surface-container-high hover:text-md-on-surface'
                )}
                title={item.label}
              >
                <MaterialIcon
                  icon={item.icon}
                  size="lg"
                  filled={isActive}
                  className={cn(
                    'transition-transform duration-200',
                    !isActive && 'group-hover:scale-110'
                  )}
                />
              </Link>
            );
          })}
        </nav>

        {/* Bottom Navigation */}
        <div className="mt-auto pt-6 flex flex-col gap-1 px-2 border-t border-md-outline-variant/50">
          {bottomNavItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              className={cn(
                'flex items-center justify-center py-3 rounded-xl transition-all duration-200',
                isActiveRoute(item.path)
                  ? 'bg-md-surface-container-high text-md-tertiary-container'
                  : 'text-md-on-surface-variant hover:bg-md-surface-container-high hover:text-md-on-surface'
              )}
              title={item.label}
            >
              <MaterialIcon icon={item.icon} size="lg" />
            </Link>
          ))}

          {/* User Avatar */}
          {user && (
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="flex items-center justify-center py-3 mt-2"
              title="Profile"
            >
              <div className="w-10 h-10 rounded-full bg-md-secondary-container flex items-center justify-center text-white text-sm font-bold">
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top App Bar */}
        <header className="h-16 bg-md-surface-container-lowest border-b border-md-outline-variant flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-md-on-surface">
              {currentTenant?.name || 'Dashboard'}
            </h1>

            {/* Search */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-md-surface-container-high rounded-lg border border-md-outline-variant/50">
              <MaterialIcon icon="search" size="sm" className="text-md-outline" />
              <input
                type="text"
                placeholder="Search analytics..."
                className="bg-transparent border-none text-sm focus:ring-0 p-0 w-48 text-md-on-surface placeholder:text-md-outline"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* AI Toggle Button */}
            <button
              type="button"
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              className={cn(
                'p-2 rounded-full transition-colors relative',
                aiPanelOpen
                  ? 'bg-md-tertiary-container/10 text-md-tertiary-container'
                  : 'text-md-on-surface-variant hover:bg-md-surface-container-high'
              )}
              title={aiPanelOpen ? 'Close AI Panel' : 'Open AI Panel'}
            >
              <MaterialIcon icon="smart_toy" size="lg" />
              {!aiPanelOpen && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              )}
            </button>

            {/* Notifications */}
            <button
              type="button"
              className="p-2 text-md-on-surface-variant hover:bg-md-surface-container-high rounded-full transition-colors"
              title="Notifications"
            >
              <MaterialIcon icon="notifications" size="lg" />
            </button>

            {/* Settings */}
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="p-2 text-md-on-surface-variant hover:bg-md-surface-container-high rounded-full transition-colors"
              title="Settings"
            >
              <MaterialIcon icon="settings" size="lg" />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <motion.div
              key={currentPath}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={slideInUp}
              className="p-8"
            >
              <Outlet />
            </motion.div>
          </div>

          {/* AI Sidebar */}
          <AnimatePresence mode="wait">
            {aiPanelOpen && (
              <motion.div
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={aiSidebarReveal}
                className="flex-shrink-0"
              >
                <AIChatPanel
                  messages={chatMessages}
                  inputValue={chatInput}
                  onInputChange={setChatInput}
                  onSendMessage={handleSendMessage}
                  isLoading={isAiLoading}
                  isOnline={true}
                  onClose={() => setAiPanelOpen(false)}
                  quickActions={[
                    { label: 'History', icon: 'history', action: () => console.log('History') },
                    { label: 'Export', icon: 'download', action: () => console.log('Export') },
                  ]}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
