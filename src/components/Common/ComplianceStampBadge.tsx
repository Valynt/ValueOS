import React from 'react';
import { Shield, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import type { ManifestoComplianceReport } from '../../types/vos';

interface ComplianceStampBadgeProps {
  complianceMetadata?: ManifestoComplianceReport | null;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export const ComplianceStampBadge: React.FC<ComplianceStampBadgeProps> = ({
  complianceMetadata,
  size = 'md',
  showDetails = false
}) => {
  if (!complianceMetadata) {
    return (
      <div className="inline-flex items-center space-x-1.5 px-2 py-1 bg-gray-100 border border-gray-300 rounded text-gray-600">
        <Info className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'}`} />
        <span className={`${size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'} font-medium`}>
          Not Validated
        </span>
      </div>
    );
  }

  const { overall_compliance, passed_rules, total_rules, validated_at } = complianceMetadata;
  const complianceScore = (passed_rules / total_rules) * 100;

  const getStatusConfig = () => {
    if (overall_compliance) {
      return {
        icon: CheckCircle2,
        bgColor: 'bg-green-100',
        borderColor: 'border-green-300',
        textColor: 'text-green-700',
        iconColor: 'text-green-600',
        label: 'Compliant'
      };
    } else if (complianceScore >= 60) {
      return {
        icon: AlertTriangle,
        bgColor: 'bg-amber-100',
        borderColor: 'border-amber-300',
        textColor: 'text-amber-700',
        iconColor: 'text-amber-600',
        label: 'At Risk'
      };
    } else {
      return {
        icon: XCircle,
        bgColor: 'bg-red-100',
        borderColor: 'border-red-300',
        textColor: 'text-red-700',
        iconColor: 'text-red-600',
        label: 'Non-Compliant'
      };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const getTimestamp = () => {
    if (!validated_at) return 'Unknown';
    const date = new Date(validated_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="inline-block">
      <div className={`inline-flex items-center space-x-1.5 px-2 py-1 ${config.bgColor} border ${config.borderColor} rounded ${config.textColor}`}>
        <Shield className={`${iconSizes[size]} ${config.iconColor}`} />
        <Icon className={`${iconSizes[size]} ${config.iconColor}`} />
        <span className={`${sizeClasses[size]} font-medium`}>
          {config.label}
        </span>
        {showDetails && (
          <span className={`${sizeClasses[size]} opacity-75`}>
            {passed_rules}/{total_rules}
          </span>
        )}
      </div>

      {showDetails && (
        <div className={`mt-1 ${sizeClasses[size]} ${config.textColor} opacity-75`}>
          Validated {getTimestamp()}
        </div>
      )}
    </div>
  );
};
