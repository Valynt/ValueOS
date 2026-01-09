/**
 * Silent Mode Hook
 * 
 * Manages the silent mode state for power users who want to focus
 * on the canvas without chat interface distractions.
 * 
 * Features:
 * - Persists preference to localStorage
 * - Keyboard shortcut (⌘/Ctrl + \)
 * - Smooth transitions
 */

import { useCallback, useEffect, useState } from 'react';
import { logger } from '../lib/logger';

const SILENT_MODE_KEY = 'valueOS:silentMode';

export function useSilentMode() {
  // Initialize from localStorage
  const [silentMode, setSilentMode] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(SILENT_MODE_KEY);
      return stored === 'true';
    } catch (error) {
      logger.warn('Failed to load silent mode preference', { error });
      return false;
    }
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SILENT_MODE_KEY, String(silentMode));
      logger.info('Silent mode updated', { silentMode });
    } catch (error) {
      logger.error('Failed to save silent mode preference', { error });
    }
  }, [silentMode]);

  // Toggle function
  const toggleSilentMode = useCallback(() => {
    setSilentMode(prev => !prev);
  }, []);

  // Keyboard shortcut (⌘/Ctrl + \)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleSilentMode();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [toggleSilentMode]);

  return {
    silentMode,
    setSilentMode,
    toggleSilentMode,
  };
}
