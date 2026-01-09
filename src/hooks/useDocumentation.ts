/**
 * Documentation Hook
 * 
 * React hook for fetching and managing documentation data.
 */

import { useCallback, useState } from 'react';
import { DocHealth, DocSection, SearchResult, UserRole } from '../components/docs/types';

const API_BASE = '/api/docs';

export function useDocumentation() {
  const [sections, setSections] = useState<DocSection[]>([]);
  const [currentSection, setCurrentSection] = useState<DocSection | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [health, setHealth] = useState<DocHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all sections
  const fetchSections = useCallback(async (category?: string) => {
    setLoading(true);
    setError(null);

    try {
      const url = category 
        ? `${API_BASE}/sections?category=${category}`
        : `${API_BASE}/sections`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch documentation sections');
      }

      const data = await response.json();
      
      if (data.success) {
        setSections(data.data);
      } else {
        throw new Error(data.error?.message || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documentation');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch specific section
  const fetchSection = useCallback(async (sectionId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/sections/${sectionId}`);
      
      if (!response.ok) {
        throw new Error('Section not found');
      }

      const data = await response.json();
      
      if (data.success) {
        // Fetch the actual markdown content
        const section = data.data;
        const contentResponse = await fetch(section.path);
        const content = await contentResponse.text();
        
        setCurrentSection({
          ...section,
          content
        });
      } else {
        throw new Error(data.error?.message || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load section');
    } finally {
      setLoading(false);
    }
  }, []);

  // Search documentation
  const searchDocs = useCallback(async (query: string, role?: UserRole) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Client-side search through sections
      // In production, this should be a backend API call
      const results = sections
        .filter(section => {
          const searchText = `${section.title} ${section.description || ''} ${section.content || ''}`.toLowerCase();
          return searchText.includes(query.toLowerCase());
        })
        .map(section => {
          // Calculate relevance score
          const titleMatch = section.title.toLowerCase().includes(query.toLowerCase());
          const descMatch = section.description?.toLowerCase().includes(query.toLowerCase());
          const score = titleMatch ? 1.0 : descMatch ? 0.7 : 0.5;

          // Extract matches
          const matches = extractMatches(section, query);

          return {
            section,
            matches,
            score
          };
        })
        .sort((a, b) => b.score - a.score);

      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [sections]);

  // Fetch health metrics
  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();
      
      if (data.success) {
        setHealth(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch health metrics:', err);
    }
  }, []);

  // Detect changes
  const detectChanges = useCallback(async (files: string[]) => {
    try {
      const response = await fetch(`${API_BASE}/detect-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files })
      });

      const data = await response.json();
      return data.success ? data.data : null;
    } catch (err) {
      console.error('Failed to detect changes:', err);
      return null;
    }
  }, []);

  // Mark as synced
  const markSynced = useCallback(async (sectionId: string) => {
    try {
      const response = await fetch(`${API_BASE}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId })
      });

      const data = await response.json();
      return data.success;
    } catch (err) {
      console.error('Failed to mark as synced:', err);
      return false;
    }
  }, []);

  return {
    sections,
    currentSection,
    searchResults,
    health,
    loading,
    error,
    fetchSections,
    fetchSection,
    searchDocs,
    fetchHealth,
    detectChanges,
    markSynced
  };
}

// Helper function to extract search matches
function extractMatches(section: DocSection, query: string) {
  const matches: Array<{ text: string; context: string }> = [];
  const content = section.content || '';
  const queryLower = query.toLowerCase();

  // Split content into sentences
  const sentences = content.split(/[.!?]\s+/);

  sentences.forEach(sentence => {
    if (sentence.toLowerCase().includes(queryLower)) {
      const index = sentence.toLowerCase().indexOf(queryLower);
      const start = Math.max(0, index - 50);
      const end = Math.min(sentence.length, index + query.length + 50);
      
      matches.push({
        text: sentence.substring(index, index + query.length),
        context: sentence.substring(start, end)
      });
    }
  });

  return matches.slice(0, 3); // Return top 3 matches
}

export default useDocumentation;
