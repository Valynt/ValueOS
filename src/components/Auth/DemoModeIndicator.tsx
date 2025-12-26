/**
 * Demo Mode Indicator
 * 
 * Visual indicator shown in the app header when running in demo mode.
 * Provides clear visibility that the app is using mock authentication.
 */

import { FlaskConical, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface DemoModeIndicatorProps {
  /** Whether to show a dismiss/exit button */
  showExitButton?: boolean;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

export function DemoModeIndicator({ showExitButton = true, compact = false }: DemoModeIndicatorProps) {
  const { isDemoMode, logout } = useAuth();

  if (!isDemoMode) {
    return null;
  }

  const handleExit = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to exit demo mode:', error);
    }
  };

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500 text-white text-xs font-medium rounded-full">
        <FlaskConical className="w-3 h-3" />
        <span>DEMO</span>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4" />
          <span className="text-sm font-medium">
            Demo Mode Active
          </span>
          <span className="text-xs opacity-80">
            — Using mock authentication. No real data is being accessed.
          </span>
        </div>
        
        {showExitButton && (
          <button
            onClick={handleExit}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-full transition-colors duration-200"
            title="Exit Demo Mode"
          >
            <X className="w-3 h-3" />
            <span>Exit Demo</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Demo Mode Banner for page layouts
 * Use this inside page content areas
 */
export function DemoModeBanner() {
  const { isDemoMode } = useAuth();

  if (!isDemoMode) {
    return null;
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-orange-600" />
        <span className="text-sm text-orange-800">
          <strong>Demo Mode:</strong> You're viewing the app with mock data. 
          Actions won't persist to the database.
        </span>
      </div>
    </div>
  );
}

export default DemoModeIndicator;
