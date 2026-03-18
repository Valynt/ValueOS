/**
 * File Upload Security Middleware
 * Implements OWASP file upload security recommendations
 */

import { createLogger } from "@shared/lib/logger";
import { NextFunction, Request, Response } from "express";

const logger = createLogger({ component: "FileUploadSecurity" });

export interface FileUploadConfig {
  maxFileSize: number; // in bytes
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  maxFilesPerRequest: number;
  quarantinePath?: string;
  scanForMalware?: boolean;
}

const DEFAULT_CONFIG: FileUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/json",
    "application/xml",
    "text/xml",
  ],
  allowedExtensions: [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".pdf",
    ".txt",
    ".csv",
    ".json",
    ".xml",
  ],
  maxFilesPerRequest: 5,
  scanForMalware: false,
};

/**
 * Validate file upload against security constraints
 */
export function validateFileUpload(
  file: Express.Multer.File,
  config: Partial<FileUploadConfig> = {}
): { valid: boolean; error?: string } {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Check file size
  if (file.size > mergedConfig.maxFileSize) {
    return {
      valid: false,
      error: `File size ${file.size} exceeds maximum allowed size ${mergedConfig.maxFileSize}`,
    };
  }

  // Check MIME type
  if (!mergedConfig.allowedMimeTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: `MIME type ${file.mimetype} is not allowed`,
    };
  }

  // Check file extension
  const extension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf("."));
  if (!mergedConfig.allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File extension ${extension} is not allowed`,
    };
  }

  // Check for null bytes in filename (path traversal attempt)
  if (file.originalname.includes("\0")) {
    return {
      valid: false,
      error: "Filename contains null bytes",
    };
  }

  // Check for path traversal patterns
  if (
    file.originalname.includes("..") ||
    file.originalname.includes("/") ||
    file.originalname.includes("\\")
  ) {
    return {
      valid: false,
      error: "Filename contains path traversal patterns",
    };
  }

  return { valid: true };
}

/**
 * File upload security middleware
 */
export function fileUploadSecurityMiddleware(config: Partial<FileUploadConfig> = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.files && !req.file) {
      return next();
    }

    const files = req.files as Express.Multer.File[] | undefined;
    const singleFile = req.file as Express.Multer.File | undefined;

    const allFiles = files ? files : singleFile ? [singleFile] : [];

    // Check number of files
    if (allFiles.length > mergedConfig.maxFilesPerRequest) {
      logger.warn("File upload rejected: too many files", {
        count: allFiles.length,
        maxAllowed: mergedConfig.maxFilesPerRequest,
      });
      return void res.status(400).json({
        error: "Too many files uploaded",
        maxAllowed: mergedConfig.maxFilesPerRequest,
      });
    }

    // Validate each file
    for (const file of allFiles) {
      const validation = validateFileUpload(file, mergedConfig);
      if (!validation.valid) {
        logger.warn("File upload rejected: validation failed", {
          filename: file.originalname,
          error: validation.error,
        });
        return void res.status(400).json({
          error: "File validation failed",
          details: validation.error,
        });
      }
    }

    // Log successful validation
    logger.info("File upload validation passed", {
      fileCount: allFiles.length,
      totalSize: allFiles.reduce((sum, f) => sum + f.size, 0),
    });

    next();
  };
}

/**
 * Content-Type validation middleware for file uploads
 */
export function contentTypeValidationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const contentType = req.headers["content-type"];

  if (!contentType) {
    return void res.status(400).json({ error: "Content-Type header required" });
  }

  // Only allow multipart/form-data for file uploads
  if (!contentType.startsWith("multipart/form-data")) {
    return void res.status(400).json({
      error: "Invalid Content-Type for file upload",
      allowed: "multipart/form-data",
    });
  }

  next();
}
