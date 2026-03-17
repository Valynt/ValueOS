import { useCallback, useEffect, useState } from "react";

import type { Project } from "../types";

import { apiClient } from "@/api/client/unified-api-client";

export function useProjects(workspaceId?: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ projects: Project[] }>(`/api/workspaces/${workspaceId}/projects`);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message ?? "Failed to fetch projects");
      }
      setProjects(response.data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch projects");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (data: { name: string; description?: string }) => {
    if (!workspaceId) return null;

    try {
      const response = await apiClient.post<Project>(`/api/workspaces/${workspaceId}/projects`, data);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message ?? "Failed to create project");
      }

      const newProject = response.data;
      // Prepend new project as we sort by newest first in backend
      setProjects((prev) => [newProject, ...prev]);
      return newProject;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project";
      setError(message);
      return null;
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    if (!workspaceId) return;

    try {
      const response = await apiClient.put<Project>(`/api/workspaces/${workspaceId}/projects/${projectId}`, updates);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message ?? "Failed to update project");
      }

      const updatedProject = response.data;
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? updatedProject : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project");
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!workspaceId) return;

    try {
      const response = await apiClient.delete(`/api/workspaces/${workspaceId}/projects/${projectId}`);

      if (!response.success) {
        throw new Error(response.error?.message ?? "Failed to delete project");
      }

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  };

  return {
    projects,
    isLoading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refetch: fetchProjects,
  };
}
