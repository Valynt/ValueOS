/**
 * Invoices API
 * Endpoints for invoice management
 */

import { createLogger } from '@shared/lib/logger';
import express, { Request, Response } from 'express';

import { auditDataExport } from '../../middleware/auditHooks.js'
import { InvoiceService } from "../../services/billing/InvoiceService.js";

const router = express.Router();
const logger = createLogger({ component: 'InvoicesAPI' });

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: req.requestId || res.locals.requestId,
  ...meta,
});

/**
 * GET /api/billing/invoices
 * List invoices for tenant
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!tenantId || !req.supabase) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const service = new InvoiceService(req.supabase);
    const invoices = await service.getInvoices(tenantId, limit, offset);

    res.json({ invoices, limit, offset });
  } catch (error) {
    logger.error('Error fetching invoices', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * GET /api/billing/invoices/upcoming
 * Get upcoming invoice preview
 */
router.get('/upcoming', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId || !req.supabase) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const service = new InvoiceService(req.supabase);
    const upcomingInvoice = await service.getUpcomingInvoice(tenantId);

    res.json(upcomingInvoice);
  } catch (error) {
    logger.error('Error fetching upcoming invoice', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to fetch upcoming invoice' });
  }
});

/**
 * GET /api/billing/invoices/:id
 * Get invoice by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const invoiceId = req.params.id ?? '';

    if (!req.supabase) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const service = new InvoiceService(req.supabase);
    const invoice = await service.getInvoiceById(invoiceId);

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    res.json(invoice);
  } catch (error) {
    logger.error('Error fetching invoice', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

/**
 * GET /api/billing/invoices/:id/pdf
 * Get invoice PDF URL
 */
router.get('/:id/pdf', auditDataExport('invoice_pdf'), async (req: Request, res: Response) => {
  try {
    const invoiceId = req.params.id;

    if (!req.supabase) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const service = new InvoiceService(req.supabase);
    const pdfUrl = await service.downloadInvoicePDF(invoiceId ?? '');

    res.json({ pdfUrl });
  } catch (error) {
    logger.error('Error fetching invoice PDF', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to fetch invoice PDF' });
  }
});

export default router;
