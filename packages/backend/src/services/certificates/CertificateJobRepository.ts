/**
 * CertificateJobRepository
 *
 * Handles persistence of certificate generation job status and results.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type CertificateJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface CertificateJob {
  id: string;
  tenant_id: string;
  organization_id: string;
  user_id: string;
  certification_id: number;
  format: 'pdf' | 'png';
  status: CertificateJobStatus;
  download_url?: string;
  certificate_blob?: string;
  error_message?: string;
  queued_at: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  trace_id?: string;
}

export interface CreateCertificateJobInput {
  tenantId: string;
  organizationId: string;
  userId: string;
  certificationId: number;
  format: 'pdf' | 'png';
  traceId: string;
}

export class CertificateJobRepository {
  private TABLE_NAME = 'certificate_jobs';

  /**
   * Create a new certificate job row with status 'queued'.
   * Returns the persisted job.
   */
  async create(input: CreateCertificateJobInput): Promise<CertificateJob> {
    const supabase = this.getSupabaseClient();

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .insert({
        tenant_id: input.tenantId,
        organization_id: input.organizationId,
        user_id: input.userId,
        certification_id: input.certificationId,
        format: input.format,
        status: 'queued',
        queued_at: now,
        trace_id: input.traceId,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create certificate job: ${error.message}`);
    }

    return data as CertificateJob;
  }

  /**
   * Update job status and optionally set download URL, blob, or error.
   */
  async updateStatus(
    jobId: string,
    status: CertificateJobStatus,
    downloadUrl?: string,
    certificateBlob?: string,
    errorMessage?: string
  ): Promise<void> {
    const supabase = this.getSupabaseClient();

    const update: Record<string, unknown> = { status };

    if (status === 'running') {
      update.started_at = new Date().toISOString();
    } else if (status === 'completed') {
      update.completed_at = new Date().toISOString();
      if (downloadUrl) update.download_url = downloadUrl;
      if (certificateBlob) update.certificate_blob = certificateBlob;
    } else if (status === 'failed') {
      update.failed_at = new Date().toISOString();
      if (errorMessage) update.error_message = errorMessage;
    }

    const { error } = await supabase
      .from(this.TABLE_NAME)
      .update(update)
      .eq('id', jobId);

    if (error) {
      throw new Error(`Failed to update certificate job: ${error.message}`);
    }
  }

  /**
   * Get job by ID.
   */
  async getById(jobId: string): Promise<CertificateJob | null> {
    const supabase = this.getSupabaseClient();

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch certificate job: ${error.message}`);
    }

    return data as CertificateJob;
  }

  /**
   * Get active (queued or running) job for a certification.
   * Returns null if none exists.
   */
  async getActiveJobForCertification(
    tenantId: string,
    userId: string,
    certificationId: number
  ): Promise<CertificateJob | null> {
    const supabase = this.getSupabaseClient();

    const { data, error } = await supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('certification_id', certificationId)
      .in('status', ['queued', 'running'])
      .order('queued_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch active certificate job: ${error.message}`);
    }

    return data as CertificateJob | null;
  }

  /**
   * Get Supabase client with service role for background jobs.
   */
  private getSupabaseClient(): SupabaseClient {
    const { createServerSupabaseClient } = require('../lib/supabase.js');
    return createServerSupabaseClient();
  }
}

// Singleton instance
export const certificateJobRepository = new CertificateJobRepository();
