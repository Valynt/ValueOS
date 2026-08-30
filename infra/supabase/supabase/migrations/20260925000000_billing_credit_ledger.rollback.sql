-- Rollback: billing_credit_ledger
--
-- Removes the credit ledger, balance view, and consume RPC introduced in
-- 20260925000000_billing_credit_ledger.sql.
--
-- WARNING: This destroys all ledger data. Run only after confirming that
-- no production credits have been issued via the new ledger.

SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.consume_invoice_credits(uuid, uuid, bigint) FROM service_role;
REVOKE ALL ON public.billing_credit_balances FROM service_role;
REVOKE ALL ON public.billing_credit_balances FROM authenticated;
REVOKE ALL ON public.billing_credit_ledger FROM service_role;
REVOKE ALL ON public.billing_credit_ledger FROM authenticated;

DROP FUNCTION IF EXISTS public.consume_invoice_credits(uuid, uuid, bigint);
DROP VIEW  IF EXISTS public.billing_credit_balances;
DROP TABLE IF EXISTS public.billing_credit_ledger;
