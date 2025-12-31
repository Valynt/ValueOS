import { useEffect, useRef } from 'react';
import { trapFocus } from '../utils/accessibility';

export const useFocusTrap = (isActive: boolean) => {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isActive || !elementRef.current) return;

    const cleanup = trapFocus(elementRef.current);
    return cleanup;
  }, [isActive]);

  return elementRef;
};

export const useFocusOnMount = <T extends HTMLElement>() => {
  const elementRef = useRef<T>(null);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.focus();
    }
  }, []);

  return elementRef;
};

export const useRestoreFocus = (isActive: boolean) => {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isActive) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isActive]);
};

export const useKeyboardNavigation = (
  items: any[],
  onSelect: (index: number) => void,
  isActive: boolean = true
) => {
  const selectedIndexRef = useRef(0);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectedIndexRef.current = (selectedIndexRef.current + 1) % items.length;
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectedIndexRef.current =
            (selectedIndexRef.current - 1 + items.length) % items.length;
          break;
        case 'Enter':
          e.preventDefault();
          onSelect(selectedIndexRef.current);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items.length, onSelect, isActive]);

  return selectedIndexRef.current;
};
