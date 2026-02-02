-- Create invitations table to store pending invites and tokens
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS invitations_tenant_id_idx ON public.invitations (tenant_id);
CREATE INDEX IF NOT EXISTS invitations_token_idx ON public.invitations (token);

-- Note: RLS policies should be added as appropriate in production.
