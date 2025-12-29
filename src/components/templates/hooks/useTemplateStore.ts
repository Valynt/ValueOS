import { create } from 'zustand';
import { TemplateDataSource, TrustBadgeProps } from '../types';

interface TemplateState {
  // Data from Phase 3.5
  templateData: TemplateDataSource | null;
  trustBadges: TrustBadgeProps[];
  isLoading: boolean;
  error: string | null;
  
  // UI State
  selectedPersona: string;
  activeTemplate: string;
  showTrustOverlay: boolean;
  selectedTrustBadge: TrustBadgeProps | null;
  
  // Actions
  setTemplateData: (data: TemplateDataSource) => void;
  setTrustBadges: (badges: TrustBadgeProps[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedPersona: (persona: string) => void;
  setActiveTemplate: (template: string) => void;
  setShowTrustOverlay: (show: boolean) => void;
  setSelectedTrustBadge: (badge: TrustBadgeProps | null) => void;
  
  // Computed
  trustBadgeFor: (metric: string) => TrustBadgeProps | null;
  reset: () => void;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  // Initial state
  templateData: null,
  trustBadges: [],
  isLoading: false,
  error: null,
  selectedPersona: 'cfo',
  activeTemplate: 'TrinityDashboard',
  showTrustOverlay: false,
  selectedTrustBadge: null,

  // Actions
  setTemplateData: (data) => set({ templateData: data }),
  setTrustBadges: (badges) => set({ trustBadges: badges }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setSelectedPersona: (persona) => set({ selectedPersona: persona }),
  setActiveTemplate: (template) => set({ activeTemplate: template }),
  setShowTrustOverlay: (show) => set({ showTrustOverlay: show }),
  setSelectedTrustBadge: (badge) => set({ selectedTrustBadge: badge }),

  // Computed
  trustBadgeFor: (metric) => {
    const { trustBadges } = get();
    return trustBadges.find(b => b.metric === metric) || null;
  },

  // Reset
  reset: () => set({
    templateData: null,
    trustBadges: [],
    isLoading: false,
    error: null,
    showTrustOverlay: false,
    selectedTrustBadge: null
  })
}));