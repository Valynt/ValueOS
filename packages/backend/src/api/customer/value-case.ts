/**
 * Customer Portal API - Value Case Endpoint
 * GET /api/customer/value-case
 */

import { logger } from "@shared/lib/logger";
import { Request, Response } from "express";
import { z } from "zod";

import { httpRequestDuration } from "../../lib/metrics/httpMetrics";
import { customerValueCaseReadService } from "../../services/customer/CustomerValueCaseReadService";
import { extractCustomerAccessToken } from "./tokenTransport";

export type ValueCaseResponse = Awaited<
  ReturnType<typeof customerValueCaseReadService.readByCustomerToken>
> extends { status: "ok"; response: infer T }
  ? T
  : never;

export async function getCustomerValueCase(req: Request, res: Response): Promise<void> {
  try {
    const extracted = extractCustomerAccessToken(req);
    if (extracted.error === "url_path_token_not_allowed") {
      res.status(400).json({
        error: "Bad Request",
        message: "Token in URL path is not allowed. Provide token via header or request body.",
      });
      return;
    }
    if (extracted.error === "query_token_not_allowed") {
      res.status(400).json({
        error: "Bad Request",
        message: "Token in query string is not allowed. Provide token via header or request body.",
      });
      return;
    }
    if (extracted.error === "conflicting_tokens") {
      res.status(400).json({
        error: "Bad Request",
        message: "Conflicting token values in header and body.",
      });
      return;
    }
    if (extracted.error === "missing_token" || !extracted.token) {
      res.status(400).json({
        error: "Bad Request",
        message: "Missing token. Provide token via x-customer-access-token header or request body.",
      });
      return;
    }

    const token = extracted.token;
    logger.info("Customer value case request");
    const endTimer = httpRequestDuration.startTimer({
      method: req.method,
      route: "/api/customer/value-case",
    });
    res.on("finish", () => {
      endTimer({ status_code: String(res.statusCode) });
    });

    const result = await customerValueCaseReadService.readByCustomerToken(token);

    if (result.status === "unauthorized") {
      res.status(401).json({
        error: "Unauthorized",
        message: result.message,
      });
      return;
    }

    if (result.status === "not_found") {
      res.status(404).json({ error: "Value case not found" });
      return;
    }

    res.status(200).json(result.response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Bad Request",
        message: "Invalid request parameters",
        details: error.errors,
      });
      return;
    }
    logger.error("Error in getCustomerValueCase", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    });
  }
}
