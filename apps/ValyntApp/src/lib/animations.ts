/**
 * Animation System
 *
 * Centralized animation presets using Framer Motion.
 * Glassmorphism effects, staggered reveals, and interaction animations.
 */

import { type Variants, type Transition } from "framer-motion";

// ============================================
// SPRING CONFIGS
// ============================================

interface SpringConfig {
  stiffness: number;
  damping: number;
  mass?: number;
}

export const springs: Record<string, SpringConfig> = {
  // Material Design easing
  standard: { stiffness: 100, damping: 10 } as const,
  decelerate: { stiffness: 200, damping: 20 } as const,
  accelerate: { stiffness: 300, damping: 30 } as const,
  // Emphasized (for UI elements)
  emphasized: { stiffness: 500, damping: 50 } as const,
  emphasizedDecelerate: { stiffness: 600, damping: 60 } as const,
  emphasizedAccelerate: { stiffness: 700, damping: 70 } as const,
};

// ============================================
// EASING FUNCTIONS
// ============================================

export const easings = {
  // Material Design easing
  standard: [0.4, 0, 0.2, 1] as const,
  decelerate: [0, 0, 0.2, 1] as const,
  accelerate: [0.4, 0, 1, 1] as const,
  // Emphasized (for UI elements)
  emphasized: [0.2, 0, 0, 1] as const,
  emphasizedDecelerate: [0.05, 0.7, 0.1, 1] as const,
  emphasizedAccelerate: [0.3, 0, 0.8, 0.15] as const,
};

// ============================================
// GLASSMORPHISM ANIMATIONS
// ============================================

/** Core glassmorphism entrance animation */
export const glassReveal: Variants = {
  hidden: {
    opacity: 0,
    backdropFilter: "blur(0px)",
    backgroundColor: "rgba(255, 255, 255, 0)",
    scale: 0.96,
  },
  visible: {
    opacity: 1,
    backdropFilter: "blur(12px)",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    scale: 1,
    transition: {
      duration: 0.4,
      ease: easings.standard,
    },
  },
  exit: {
    opacity: 0,
    backdropFilter: "blur(0px)",
    scale: 0.96,
    transition: { duration: 0.2, ease: easings.accelerate },
  },
};

/** Floating badge animation for login/signup pages */
export const floatingBadge: Variants = {
  initial: { y: 0, rotate: -2 },
  animate: {
    y: [-8, 8, -8],
    rotate: [-2, 2, -2],
    transition: {
      duration: 6,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

/** Glass card float animation */
export const glassFloat: Variants = {
  initial: { y: 0 },
  animate: {
    y: [-4, 4, -4],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// ============================================
// LAYOUT ANIMATIONS
// ============================================

/** AI sidebar slide-in with staggered content */
export const aiSidebarReveal: Variants = {
  hidden: { x: 380, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    x: 380,
    opacity: 0,
    transition: { duration: 0.3, ease: easings.accelerate },
  },
};

/** Page content slide in from right */
export const slideInRight: Variants = {
  hidden: { x: 24, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: easings.standard },
  },
  exit: {
    x: -24,
    opacity: 0,
    transition: { duration: 0.2, ease: easings.accelerate },
  },
};

/** Page content slide in from bottom */
export const slideInUp: Variants = {
  hidden: { y: 16, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: easings.decelerate },
  },
  exit: {
    y: 16,
    opacity: 0,
    transition: { duration: 0.2, ease: easings.accelerate },
  },
};

// ============================================
// CARD ANIMATIONS
// ============================================

/** Prism card grid stagger */
export const prismGridStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const prismCardItem: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: easings.decelerate,
    },
  },
};

/** Value pyramid layer reveal */
export const pyramidLayerReveal: Variants = {
  hidden: { opacity: 0, y: 20, scaleX: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scaleX: 1,
    transition: {
      delay: i * 0.15,
      duration: 0.5,
      ease: easings.decelerate,
    },
  }),
};

// ============================================
// DATA VISUALIZATION ANIMATIONS
// ============================================

/** Metric card counter animation config */
export const countUpTransition: Transition = {
  duration: 1.5,
  ease: "easeOut",
};

/** Chart bar grow animation */
export const chartBarGrow: Variants = {
  hidden: { scaleY: 0, originY: 1 },
  visible: (height: number) => ({
    scaleY: 1,
    transition: {
      duration: 0.6,
      delay: height * 0.005, // Stagger based on height
      ease: easings.decelerate,
    },
  }),
};

/** Progress ring animation */
export const progressRingFill: Variants = {
  hidden: { pathLength: 0 },
  visible: (percentage: number) => ({
    pathLength: percentage / 100,
    transition: {
      duration: 1,
      ease: easings.decelerate,
    },
  }),
};

// ============================================
// INTERACTION ANIMATIONS
// ============================================

/** Button press effect */
export const buttonPress = {
  scale: 0.97,
  transition: { duration: 0.1 },
};

/** Hover lift effect */
export const hoverLift = {
  y: -2,
  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
  transition: { duration: 0.2, ease: easings.standard },
};

/** Tab/content switch animation */
export const contentSwitch: Variants = {
  enter: { opacity: 0, x: 8 },
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: easings.decelerate },
  },
  exit: {
    opacity: 0,
    x: -8,
    transition: { duration: 0.2, ease: easings.accelerate },
  },
};

// ============================================
// MESSAGE/CHAT ANIMATIONS
// ============================================

/** Chat message bubble animation */
export const messageBubble: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: easings.decelerate,
    },
  },
};

/** Typing indicator dots */
export const typingDot: Variants = {
  animate: {
    y: [0, -4, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
    },
  },
};

// ============================================
// PAGE TRANSITIONS
// ============================================

export const pageTransition: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3, ease: easings.standard },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: easings.accelerate },
  },
};

// ============================================
// WARMTH ANIMATIONS (Phase 4: Hardening)
// ============================================

export const warmthAnimations = {
  solidify: {
    keyframes: `@keyframes solidify {
      0% { border-style: dashed; transform: scale(1); }
      50% { transform: scale(1.02); }
      100% { border-style: solid; transform: scale(1); }
    }`,
    duration: '300ms',
    easing: 'ease-out',
  },
  glow: {
    keyframes: `@keyframes glow {
      0%, 100% { box-shadow: 0 0 4px var(--blue-300); }
      50% { box-shadow: 0 0 12px var(--blue-400); }
    }`,
    duration: '2s',
    easing: 'ease-in-out',
    iteration: 'infinite',
  },
  pulseAttention: {
    keyframes: `@keyframes pulse-attention {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }`,
    duration: '1.5s',
    easing: 'ease-in-out',
    iteration: 'infinite',
  },
} as const;

// CSS class names for warmth animations
export const warmthAnimationClasses = {
  solidify: 'animate-solidify',
  glow: 'animate-glow',
  pulseAttention: 'animate-pulse-attention',
} as const;

// Inject warmth animation keyframes into document
export function injectWarmthAnimationStyles(): void {
  if (typeof document === 'undefined') return;

  const styleId = 'warmth-animations';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = Object.values(warmthAnimations)
    .map(a => a.keyframes)
    .join('\n');
  document.head.appendChild(style);
}

