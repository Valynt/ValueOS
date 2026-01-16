/**
 * Canvas Utility Functions
 *
 * Extracted utility functions for canvas-related functionality.
 */

import { ValueCase } from "./types";

// ============================================================================
// Case Utilities
// ============================================================================

/**
 * Format case status for display
 */
export const formatCaseStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    "in-progress": "In Progress",
    completed: "Completed",
    paused: "Paused",
    archived: "Archived",
  };

  return statusMap[status] || status;
};

/**
 * Get status color for UI
 */
export const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    "in-progress": "blue",
    completed: "green",
    paused: "yellow",
    archived: "gray",
  };

  return colorMap[status] || "gray";
};

/**
 * Sort cases by updated date
 */
export const sortCasesByDate = (cases: ValueCase[]): ValueCase[] => {
  return [...cases].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
};

/**
 * Filter cases by status
 */
export const filterCasesByStatus = (cases: ValueCase[], status: string): ValueCase[] => {
  return cases.filter((case_) => case_.status === status);
};

/**
 * Search cases by name or description
 */
export const searchCases = (cases: ValueCase[], query: string): ValueCase[] => {
  const lowercaseQuery = query.toLowerCase();

  return cases.filter(
    (case_) =>
      case_.name.toLowerCase().includes(lowercaseQuery) ||
      (case_.description && case_.description.toLowerCase().includes(lowercaseQuery))
  );
};

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Format date for display
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Get relative time string
 */
export const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else {
    return "Just now";
  }
};

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate case name
 */
export const validateCaseName = (name: string): string | null => {
  if (!name.trim()) {
    return "Case name is required";
  }

  if (name.length < 3) {
    return "Case name must be at least 3 characters";
  }

  if (name.length > 100) {
    return "Case name must be less than 100 characters";
  }

  return null;
};

/**
 * Validate case description
 */
export const validateCaseDescription = (description: string): string | null => {
  if (description && description.length > 1000) {
    return "Description must be less than 1000 characters";
  }

  return null;
};

/**
 * Validate company name
 */
export const validateCompanyName = (company: string): string | null => {
  if (!company.trim()) {
    return "Company name is required";
  }

  if (company.length < 2) {
    return "Company name must be at least 2 characters";
  }

  if (company.length > 100) {
    return "Company name must be less than 100 characters";
  }

  return null;
};

// ============================================================================
// File Utilities
// ============================================================================

/**
 * Get file extension from filename
 */
export const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf(".");
  return lastDot !== -1 ? filename.substring(lastDot + 1).toLowerCase() : "";
};

/**
 * Check if file type is supported
 */
export const isSupportedFileType = (filename: string): boolean => {
  const supportedTypes = ["pdf", "doc", "docx", "txt", "md", "csv", "xlsx", "xls"];
  const extension = getFileExtension(filename);
  return supportedTypes.includes(extension);
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Extract user-friendly error message
 */
export const extractErrorMessage = (error: unknown): string => {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "An unexpected error occurred";
};

/**
 * Check if error is network related
 */
export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("connection") ||
      error.message.includes("timeout")
    );
  }

  return false;
};

// ============================================================================
// URL Utilities
// ============================================================================

/**
 * Validate URL format
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Extract domain from URL
 */
export const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return "";
  }
};

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Generate random color
 */
export const generateRandomColor = (): string => {
  const colors = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
    "#14B8A6",
    "#F97316",
    "#06B6D4",
    "#84CC16",
  ];

  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Get contrasting text color
 */
export const getContrastColor = (backgroundColor: string): string => {
  // Simple luminance calculation
  const hex = backgroundColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? "#000000" : "#FFFFFF";
};
