/**
 * CertificateGenerationWorker
 *
 * BullMQ worker that processes 'generate-certificate' jobs.
 *
 * For each job it:
 *   1. Marks the certificate_jobs row as 'running'
 *   2. Generates the certificate PDF using jsPDF
 *   3. Stores the PDF in Supabase storage or database
 *   4. Marks the job 'completed' with the download URL
 *
 * On any error the job is marked 'failed' with the error message so the
 * frontend can surface it. The error is then rethrown so BullMQ records the
 * failure and can retry according to the queue's retry policy.
 */

import { Queue, Worker, type Job } from 'bullmq';

import { logger } from '../lib/logger.js';
import { createServerSupabaseClient } from '../lib/supabase.js';
import { getAgentMessageQueueConfig } from '../config/ServiceConfigManager.js';
import { attachQueueMetrics } from '../observability/queueMetrics.js';
import { CertificateJobRepository } from '../services/certificates/CertificateJobRepository.js';
import type { LifecycleContext } from '../types/agent.js';

// ---------------------------------------------------------------------------
// Job payload type
// ---------------------------------------------------------------------------

export interface CertificateGenerationJobPayload {
  jobId: string;
  tenantId: string;
  organizationId: string;
  userId: string;
  certificationId: number;
  format: 'pdf' | 'png';
  traceId: string;
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

const QUEUE_NAME = 'certificate-generation';

const certJobRepo = new CertificateJobRepository();

/**
 * Generate certificate PDF
 */
function generateCertificatePDF(data: {
  userName: string;
  pillarTitle: string;
  vosRole: string;
  tier: 'bronze' | 'silver' | 'gold';
  score: number;
  awardedAt: Date;
  certificateId: string;
}): string {
  // Dynamic import kept synchronous via require — jsPDF is a dependency
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { jsPDF } = require("jspdf") as typeof import("jspdf");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  const TIER_COLORS: Record<string, { r: number; g: number; b: number }> = {
    gold: { r: 212, g: 175, b: 55 },
    silver: { r: 168, g: 169, b: 173 },
    bronze: { r: 176, g: 141, b: 87 },
  };
  const color = TIER_COLORS[data.tier] ?? TIER_COLORS.bronze;

  // Border
  doc.setDrawColor(color.r, color.g, color.b);
  doc.setLineWidth(2);
  doc.rect(10, 10, width - 20, height - 20);

  // Title
  doc.setFontSize(28);
  doc.setTextColor(40, 40, 40);
  doc.text("Certificate of Achievement", width / 2, 45, { align: "center" });

  // ValueOS Academy
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text("ValueOS Academy", width / 2, 55, { align: "center" });

  // Recipient
  doc.setFontSize(22);
  doc.setTextColor(color.r, color.g, color.b);
  doc.text(data.userName, width / 2, 85, { align: "center" });

  // Description
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text(
    `Has successfully completed the ${data.pillarTitle} pillar`,
    width / 2,
    100,
    { align: "center" },
  );
  doc.text(
    `Role: ${data.vosRole}  |  Tier: ${data.tier.toUpperCase()}  |  Score: ${data.score}%`,
    width / 2,
    110,
    { align: "center" },
  );

  // Date & ID
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Awarded: ${data.awardedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    width / 2,
    130,
    { align: "center" },
  );
  doc.text(`Certificate ID: ${data.certificateId}`, width / 2, 138, {
    align: "center",
  });

  // Return base64-encoded PDF
  return doc.output("datauristring").split(",")[1];
}

/**
 * Main job processor
 */
async function processCertificateJob(job: Job<CertificateGenerationJobPayload>): Promise<{
  downloadUrl: string;
  certificateData: {
    userName: string;
    pillarTitle: string;
    vosRole: string;
    tier: 'bronze' | 'silver' | 'gold';
    score: number;
    awardedAt: Date;
    certificateId: string;
  };
}> {
  const { jobId, tenantId, organizationId, userId, certificationId, format, traceId } = job.data;

  logger.info("[CertificateWorker] Processing certificate generation", {
    jobId,
    certificationId,
    userId,
    traceId,
  });

  const supabase = createServerSupabaseClient();

  try {
    // Mark job as running
    await certJobRepo.updateStatus(jobId, 'running', undefined, undefined);

    // Get certification details
    const { data: certifications, error: certError } = await supabase
      .from('certifications')
      .select('*')
      .eq('id', certificationId)
      .eq('user_id', userId)
      .single();

    if (certError || !certifications) {
      throw new Error(`Certification not found: ${certError?.message || 'Unknown error'}`);
    }

    const cert = certifications;

    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new Error(`User not found: ${userError?.message || 'Unknown error'}`);
    }

    // Get pillar details
    const { data: pillar, error: pillarError } = await supabase
      .from('pillars')
      .select('*')
      .eq('id', cert.pillar_id)
      .single();

    if (pillarError || !pillar) {
      throw new Error(`Pillar not found: ${pillarError?.message || 'Unknown error'}`);
    }

    // Prepare certificate data
    const certificateData = {
      userName: user.name || "Valued Learner",
      pillarTitle: pillar.title || "VOS Pillar",
      vosRole: cert.vos_role,
      tier: determineCertificationTier(cert) as 'bronze' | 'silver' | 'gold',
      score: cert.score || 100,
      awardedAt: new Date(cert.awarded_at),
      certificateId: `VOS-${cert.id}-${cert.awarded_at}`,
    };

    // Generate PDF
    const certificateBlob = generateCertificatePDF(certificateData);

    // Store the certificate in Supabase storage
    const storagePath = `certificates/${userId}/${certificationId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(storagePath, Buffer.from(certificateBlob, 'base64'), {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to store certificate: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('certificates')
      .getPublicUrl(storagePath);

    // Mark job as completed
    await certJobRepo.updateStatus(jobId, 'completed', publicUrl, certificateBlob);

    logger.info("[CertificateWorker] Certificate generation completed", {
      jobId,
      certificationId,
      downloadUrl: publicUrl,
      traceId,
    });

    return {
      downloadUrl: publicUrl,
      certificateData,
    };
  } catch (error) {
    logger.error("[CertificateWorker] Certificate generation failed", {
      jobId,
      certificationId,
      error: error instanceof Error ? error.message : String(error),
      traceId,
    });

    // Mark job as failed
    await certJobRepo.updateStatus(
      jobId,
      'failed',
      undefined,
      undefined,
      error instanceof Error ? error.message : String(error)
    );

    throw error;
  }
}

/**
 * Determine certification tier based on score
 * Bronze: <80%, Silver: 80-94%, Gold: 95%+
 */
function determineCertificationTier(cert: { score?: number | null }): 'bronze' | 'silver' | 'gold' {
  const score = cert.score || 0;

  if (score >= 95) {
    return 'gold';
  } else if (score >= 80) {
    return 'silver';
  } else {
    return 'bronze';
  }
}

// ---------------------------------------------------------------------------
// Worker initialization
// ---------------------------------------------------------------------------

let _worker: Worker<CertificateGenerationJobPayload> | null = null;

export function getCertificateGenerationWorker(): Worker<CertificateGenerationJobPayload> {
  if (!_worker) {
    const config = getAgentMessageQueueConfig();
    const redisUrl = config.redis.url ?? "redis://localhost:6379";

    _worker = new Worker<CertificateGenerationJobPayload>(
      QUEUE_NAME,
      async (job: Job<CertificateGenerationJobPayload>) => {
        return await processCertificateJob(job);
      },
      {
        connection: { url: redisUrl },
        concurrency: config.queue.concurrency || 5,
        limiter: {
          max: config.queue.rateLimitMax || 50,
          duration: config.queue.rateLimitDuration || 1000,
        },
        settings: {
          ...(config.queue.stalledCheckInterval && {
            stalledInterval: config.queue.stalledCheckInterval,
          }),
          ...(config.queue.maxStalledCount && {
            maxStalledCount: config.queue.maxStalledCount,
          }),
        },
      }
    );

    _worker.on('completed', (job: Job) => {
      logger.info('Certificate generation job completed', {
        queue: QUEUE_NAME,
        jobId: job.id,
      });
    });

    _worker.on('failed', (job: Job | undefined, error: Error) => {
      logger.error('Certificate generation job failed', {
        queue: QUEUE_NAME,
        jobId: job?.id,
        error: error.message,
      });
    });

    _worker.on('stalled', (jobId: string) => {
      logger.warn('Certificate generation job stalled', {
        queue: QUEUE_NAME,
        jobId,
      });
    });

    attachQueueMetrics(_worker, QUEUE_NAME, {
      workerClass: 'certificate-generation-worker',
      concurrency: config.queue.concurrency || 5,
    });

    logger.info('CertificateGenerationWorker: started', { queue: QUEUE_NAME });
  }

  return _worker;
}

let _queue: Queue<CertificateGenerationJobPayload> | null = null;

export function getCertificateGenerationQueue(): Queue<CertificateGenerationJobPayload> {
  if (!_queue) {
    const config = getAgentMessageQueueConfig();
    const redisUrl = config.redis.url ?? "redis://localhost:6379";
    _queue = new Queue<CertificateGenerationJobPayload>(QUEUE_NAME, {
      connection: { url: redisUrl },
    });
  }

  return _queue;
}

// Start the worker if this file is executed directly
if (process.argv[1] === import.meta.url) {
  const worker = getCertificateGenerationWorker();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('CertificateGenerationWorker: received SIGTERM, shutting down');
    await worker.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('CertificateGenerationWorker: received SIGINT, shutting down');
    await worker.close();
    process.exit(0);
  });
}
