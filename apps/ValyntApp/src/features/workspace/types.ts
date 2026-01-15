export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  iconUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user?: {
    id: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
  };
}

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
  createdAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = "active" | "archived" | "completed";
