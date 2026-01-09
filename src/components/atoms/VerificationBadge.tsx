/**
 * VerificationBadge Component
 * Shows Truth Engine verification status with confidence score
 */

import React from "react";
import { AlertTriangle, Clock, Shield } from "lucide-react";

export type VerificationStatus = "verified" | "pending" | "failed";

export interface VerificationBadgeProps {
  status: VerificationStatus;
  confidence?: number; // 0-100
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  status,
  confidence,
  showLabel = true,
  size = "sm",
  className = "",
}) => {
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const configs: Record<
    VerificationStatus,
    {
      icon: React.ReactNode;
      label: string;
      colorClass: string;
      bgClass: string;
    }
  > = {
    verified: {
      icon: <Shield className={iconSizes[size]} />,
      label: "Verified",
      colorClass: "text-green-600 dark:text-green-400",
      bgClass:
        "bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800",
    },
    pending: {
      icon: <Clock className={iconSizes[size]} />,
      label: "Pending",
      colorClass: "text-amber-600 dark:text-amber-400",
      bgClass:
        "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800",
    },
    failed: {
      icon: <AlertTriangle className={iconSizes[size]} />,
      label: "Unverified",
      colorClass: "text-red-600 dark:text-red-400",
      bgClass:
        "bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800",
    },
  };

  const config = configs[status];

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-full border
        ${config.bgClass} ${config.colorClass} ${sizeClasses[size]}
        ${className}
      `}
      title={
        confidence !== undefined
          ? `${config.label} (${confidence}% confidence)`
          : config.label
      }
    >
      {config.icon}

      {showLabel && (
        <span className="font-medium">
          {config.label}
          {confidence !== undefined && ` ${confidence}%`}
        </span>
      )}

      {!showLabel && confidence !== undefined && (
        <span className="font-medium">{confidence}%</span>
      )}
    </div>
  );
};

export default VerificationBadge;
