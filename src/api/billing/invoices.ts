/**
 * Invoices API
 * Endpoints for invoice management
 */

import express, { Request, Response } from 'express';
import InvoiceService from '../../services/billing/InvoiceService';
import { createLogger } from '../../lib/logger';

const router = express.Router();
const logger = createLogger({ component: 'InvoicesAPI' });

const withRequestContext = (req: Request, res: Response, meta?: Record<string, unknown>) => ({
  requestId: (req as any).requestId || res.locals.requestId,
  ...meta,
});

/**
 * GET /api/billing/invoices
 * List invoices for tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const invoices = await InvoiceService.getInvoices(tenantId, limit, offset);
    
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
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const upcomingInvoice = await InvoiceService.getUpcomingInvoice(tenantId);
    
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
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const invoiceId = req.params.id;
    
    const invoice = await InvoiceService.getInvoiceById(invoiceId);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
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
router.get('/:id/pdf', async (req: Request, res: Response) => {
  try {
    const invoiceId = req.params.id;
    
    const pdfUrl = await InvoiceService.downloadInvoicePDF(invoiceId);
    
    res.json({ pdfUrl });
  } catch (error) {
    logger.error('Error fetching invoice PDF', error as Error, withRequestContext(req, res));
    res.status(500).json({ error: 'Failed to fetch invoice PDF' });
  }
});

export default router;
