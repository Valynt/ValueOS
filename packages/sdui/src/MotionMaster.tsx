/*
 * Motion Master: Centralized motion and entrance animation utilities for SDUI widgets
 * Applies cinematic, non-blocking staggered entrance and spring effects
 */

import React, { createContext, useContext, useRef, useEffect } from "react";

interface MotionMasterContextProps {
  register: (ref: React.RefObject<HTMLElement>) => void;
}

const MotionMasterContext = createContext<MotionMasterContextProps>({
  register: () => {},
});

export const useMotionMaster = () => useContext(MotionMasterContext);

export const MotionMasterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const refs = useRef<React.RefObject<HTMLElement>[]>([]);

  // Staggered entrance effect
  useEffect(() => {
    refs.current.forEach((ref, i) => {
      if (ref.current) {
        ref.current.style.opacity = "0";
        ref.current.style.transform = "translateY(24px)";
        setTimeout(() => {
          ref.current!.style.transition =
            "opacity 0.4s var(--motion-ease-standard), transform 0.4s var(--motion-ease-standard)";
          ref.current!.style.opacity = "1";
          ref.current!.style.transform = "translateY(0)";
        }, 80 * i);
      }
    });
  }, [children]);

  const register = (ref: React.RefObject<HTMLElement>) => {
    refs.current.push(ref);
  };

  return (
    <MotionMasterContext.Provider value={{ register }}>
      {children}
    </MotionMasterContext.Provider>
  );
};
