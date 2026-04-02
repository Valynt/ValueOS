import type { Request } from "express";

export interface TokenExtractionResult {
  token: string | null;
  error:
    | "url_path_token_not_allowed"
    | "query_token_not_allowed"
    | "conflicting_tokens"
    | "missing_token"
    | null;
}

function getHeaderToken(req: Request): string | null {
  const direct = req.header("x-customer-access-token")?.trim();
  if (direct) {
    return direct;
  }

  const authorization = req.header("authorization")?.trim();
  if (!authorization) {
    return null;
  }

  const [scheme, credential] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !credential?.trim()) {
    return null;
  }

  return credential.trim();
}

function getBodyToken(req: Request): string | null {
  const token = req.body?.token;
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

export function extractCustomerAccessToken(req: Request): TokenExtractionResult {
  const pathToken = req.params?.token;
  if (typeof pathToken === "string" && pathToken.trim()) {
    return { token: null, error: "url_path_token_not_allowed" };
  }

  const queryToken = req.query?.token;
  if (typeof queryToken === "string" && queryToken.trim()) {
    return { token: null, error: "query_token_not_allowed" };
  }

  const headerToken = getHeaderToken(req);
  const bodyToken = getBodyToken(req);

  if (headerToken && bodyToken && headerToken !== bodyToken) {
    return { token: null, error: "conflicting_tokens" };
  }

  const token = headerToken ?? bodyToken;
  if (!token) {
    return { token: null, error: "missing_token" };
  }

  return { token, error: null };
}
