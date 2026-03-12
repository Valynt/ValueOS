import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as serverSupabase } from "../lib/supabase.js";

export const projectStatuses = ["planned", "active", "paused", "completed"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export interface ProjectRecord {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  tags: string[];
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectListOptions {
  page: number;
  pageSize: number;
  status?: ProjectStatus;
  search?: string;
}

export interface ProjectListResult {
  items: ProjectRecord[];
  total: number;
}

export interface CreateProjectInput {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  tags: string[];
  ownerId: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  tags?: string[];
}

export class ProjectsRepository {
  constructor(private readonly db: SupabaseClient = serverSupabase) {}

  async findByName(organizationId: string, name: string): Promise<ProjectRecord | null> {
    const { data } = await this.db
      .from("projects")
      .select("*")
      .eq("organization_id", organizationId)
      .ilike("name", name)
      .maybeSingle();

    return (data as ProjectRecord | null) ?? null;
  }

  async create(input: CreateProjectInput): Promise<ProjectRecord> {
    const now = new Date().toISOString();
    const row = {
      id: input.id,
      organization_id: input.organizationId,
      name: input.name,
      description: input.description ?? null,
      status: input.status,
      tags: input.tags,
      owner_id: input.ownerId,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await this.db
      .from("projects")
      .insert(row)
      .select("*")
      .single();

    if (error) throw error;
    return data as ProjectRecord;
  }

  async list(organizationId: string, options: ProjectListOptions): Promise<ProjectListResult> {
    const from = (options.page - 1) * options.pageSize;
    const to = from + options.pageSize - 1;

    let query = this.db
      .from("projects")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (options.status) {
      query = query.eq("status", options.status);
    }

    if (options.search) {
      const escaped = options.search.replace(/%/g, "\\%").replace(/,/g, "\\,");
      query = query.or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%`);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return {
      items: (data as ProjectRecord[] | null) ?? [],
      total: count ?? 0,
    };
  }

  async getById(organizationId: string, projectId: string): Promise<ProjectRecord | null> {
    const { data, error } = await this.db
      .from("projects")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", projectId)
      .maybeSingle();

    if (error) throw error;
    return (data as ProjectRecord | null) ?? null;
  }

  async update(
    organizationId: string,
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectRecord | null> {
    const { data, error } = await this.db
      .from("projects")
      .update({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", projectId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return (data as ProjectRecord | null) ?? null;
  }

  async delete(organizationId: string, projectId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from("projects")
      .delete()
      .eq("organization_id", organizationId)
      .eq("id", projectId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }
}

export const projectsRepository = new ProjectsRepository();
