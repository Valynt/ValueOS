/**
 * Projects view — lists projects within the current workspace.
 *
 * Uses useProjects + useWorkspace from features/workspace.
 */

import { FolderOpen, Loader2, Plus } from "lucide-react";
import { useState } from "react";

import { useWorkspace } from "@/features/workspace/hooks/useWorkspace";
import { useProjects } from "@/features/workspace/hooks/useProjects";
import type { ProjectStatus } from "@/features/workspace/types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface ProjectsProps {
  organizationId?: string;
}

const STATUS_COLORS: Record<ProjectStatus, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  archived: "bg-gray-100 text-gray-600",
};

export function Projects(_props: ProjectsProps) {
  const { workspace, isLoading: wsLoading } = useWorkspace();
  const { projects, isLoading, error, createProject } = useProjects(workspace?.id);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createProject({ name: newName.trim(), description: newDesc.trim() || undefined });
    setNewName("");
    setNewDesc("");
    setShowCreate(false);
  };

  if (wsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Project
        </Button>
      </div>

      {showCreate && (
        <Card className="p-4 space-y-3">
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Project name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <FolderOpen className="h-10 w-10 mb-2" />
          <p>No projects yet. Create your first project to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <h3 className="font-medium truncate">{project.name}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[project.status]}`}
                >
                  {project.status}
                </span>
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {project.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Created {new Date(project.createdAt).toLocaleDateString()}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
