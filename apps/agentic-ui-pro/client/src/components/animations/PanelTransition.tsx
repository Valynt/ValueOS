/**
 * PanelTransition
 *
 * Smooth panel transitions using Framer Motion.
 * Provides consistent animation for panel switching.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface PanelTransitionProps {
  children: ReactNode;
  isActive: boolean;
  direction?: 'left' | 'right' | 'up' | 'down';
}

const variants = {
  hidden: (direction: string) => ({
    x: direction === 'left' ? -20 : direction === 'right' ? 20 : 0,
    y: direction === 'up' ? -20 : direction === 'down' ? 20 : 0,
    opacity: 0,
  }),
  visible: {
    x: 0,
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.25,
      ease: [0.25, 0.1, 0.25, 1], // Cubic-bezier for smooth feel
    },
  },
  exit: (direction: string) => ({
    x: direction === 'left' ? 20 : direction === 'right' ? -20 : 0,
    y: direction === 'up' ? 20 : direction === 'down' ? -20 : 0,
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1],
    },
  }),
};

export function PanelTransition({
  children,
  isActive,
  direction = 'right',
}: PanelTransitionProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {isActive && (
        <motion.div
          key="panel"
          custom={direction}
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="h-full"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.3,
  className,
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface SlideInProps {
  children: ReactNode;
  direction?: 'left' | 'right';
  className?: string;
}

export function SlideIn({
  children,
  direction = 'right',
  className,
}: SlideInProps) {
  return (
    <motion.div
      initial={{
        x: direction === 'right' ? 100 : -100,
        opacity: 0,
      }}
      animate={{ x: 0, opacity: 1 }}
      transition={{
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
