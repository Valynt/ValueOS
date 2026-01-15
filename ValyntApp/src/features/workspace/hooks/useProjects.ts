import { useState, useEffect, useCallback } from "react";
import type { Project } from "../types";

export function useProjects(workspaceId?: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    try {
      // TODO: Implement actual API call
      // const res = await fetch(`/api/workspaces/${workspaceId}/projects`);
      // const data = await res.json();
      // setProjects(data.projects);

      // Mock data for now
      setProjects([]);
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
      // TODO: Implement actual API call
      const newProject: Project = {
        id: `proj_${Date.now()}`,
        workspaceId,
        name: data.name,
        description: data.description,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProjects((prev) => [...prev, newProject]);
      return newProject;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      return null;
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    try {
      // TODO: Implement actual API call
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project");
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      // TODO: Implement actual API call
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
