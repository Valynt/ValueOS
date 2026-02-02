-- Add optimistic concurrency control for invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Enforce tenant-level uniqueness for invoice numbers when present
CREATE UNIQUE INDEX IF NOT EXISTS invoices_tenant_invoice_number_unique
  ON public.invoices (tenant_id, invoice_number)
  WHERE invoice_number IS NOT NULL;

-- Atomic invoice update with optimistic concurrency control
CREATE OR REPLACE FUNCTION public.update_invoice_and_customer_status(
  p_stripe_invoice_id text,
  p_invoice_number text,
  p_invoice_pdf_url text,
  p_hosted_invoice_url text,
  p_amount_due numeric,
  p_amount_paid numeric,
  p_amount_remaining numeric,
  p_subtotal numeric,
  p_tax numeric,
  p_total numeric,
  p_status text,
  p_paid_at timestamptz,
  p_line_items jsonb,
  p_expected_version integer,
  p_customer_status text,
  p_stripe_customer_id text
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices;
BEGIN
  PERFORM set_config('transaction_isolation', 'repeatable read', true);

  UPDATE public.invoices
  SET
    invoice_number = p_invoice_number,
    invoice_pdf_url = p_invoice_pdf_url,
    hosted_invoice_url = p_hosted_invoice_url,
    amount_due = p_amount_due,
    amount_paid = p_amount_paid,
    amount_remaining = p_amount_remaining,
    subtotal = p_subtotal,
    tax = p_tax,
    total = p_total,
    status = p_status,
    paid_at = p_paid_at,
    line_items = COALESCE(p_line_items, '[]'::jsonb),
    updated_at = now(),
    version = version + 1
  WHERE stripe_invoice_id = p_stripe_invoice_id
    AND version = p_expected_version
  RETURNING * INTO v_invoice;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice update conflict for %', p_stripe_invoice_id
      USING ERRCODE = '40001';
  END IF;

  IF p_customer_status IS NOT NULL THEN
    UPDATE public.billing_customers
    SET status = p_customer_status,
        updated_at = now()
    WHERE stripe_customer_id = p_stripe_customer_id;
  END IF;

  RETURN v_invoice;
END;
$$;
