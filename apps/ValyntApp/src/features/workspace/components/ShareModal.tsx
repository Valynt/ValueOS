/**
 * ShareModal
 * 
 * Modal for generating and managing guest access links.
 */

import React, { useState, useCallback } from 'react';
import {
  X,
  Link2,
  Copy,
  Check,
  Mail,
  Clock,
  Eye,
  Edit3,
  MessageSquare,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  caseTitle: string;
  companyName: string;
}

type PermissionLevel = 'view' | 'comment' | 'edit';
type ExpirationOption = '24h' | '7d' | '30d' | 'never';

export function ShareModal({
  isOpen,
  onClose,
  caseId,
  caseTitle,
  companyName,
}: ShareModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>('view');
  const [expiration, setExpiration] = useState<ExpirationOption>('7d');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateLink = useCallback(async () => {
    if (!email || !name) return;

    setIsGenerating(true);

    // Simulate API call to generate guest access token
    await new Promise(resolve => setTimeout(resolve, 800));

    // Generate mock token (in production, this would call GuestAccessService)
    const token = btoa(JSON.stringify({
      caseId,
      email,
      name,
      permissions: permissionLevel,
      exp: getExpirationDate(expiration),
    })).replace(/=/g, '');

    const link = `${window.location.origin}/guest/access?token=${token}`;
    setGeneratedLink(link);
    setIsGenerating(false);
  }, [email, name, permissionLevel, expiration, caseId]);

  const handleCopyLink = useCallback(() => {
    if (!generatedLink) return;
    
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedLink]);

  const handleSendEmail = useCallback(() => {
    if (!generatedLink || !email) return;

    const subject = encodeURIComponent(`${caseTitle} - Value Calculator Access`);
    const body = encodeURIComponent(
      `Hi ${name},\n\n` +
      `You've been invited to view the value analysis for ${companyName}.\n\n` +
      `Click here to access the interactive value calculator:\n${generatedLink}\n\n` +
      `This link will expire ${getExpirationLabel(expiration)}.\n\n` +
      `Best regards`
    );

    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
  }, [generatedLink, email, name, caseTitle, companyName, expiration]);

  const handleReset = useCallback(() => {
    setGeneratedLink(null);
    setEmail('');
    setName('');
    setPermissionLevel('view');
    setExpiration('7d');
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Share Value Case</h2>
              <p className="text-sm text-slate-500">{caseTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!generatedLink ? (
            <>
              {/* Guest Details */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Guest Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Smith"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Guest Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@company.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              {/* Permission Level */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Permission Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <PermissionButton
                    icon={Eye}
                    label="View Only"
                    description="Can view and export"
                    selected={permissionLevel === 'view'}
                    onClick={() => setPermissionLevel('view')}
                  />
                  <PermissionButton
                    icon={MessageSquare}
                    label="Comment"
                    description="Can add comments"
                    selected={permissionLevel === 'comment'}
                    onClick={() => setPermissionLevel('comment')}
                  />
                  <PermissionButton
                    icon={Edit3}
                    label="Edit"
                    description="Can adjust values"
                    selected={permissionLevel === 'edit'}
                    onClick={() => setPermissionLevel('edit')}
                  />
                </div>
              </div>

              {/* Expiration */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Link Expiration
                </label>
                <div className="flex gap-2">
                  {(['24h', '7d', '30d', 'never'] as ExpirationOption[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => setExpiration(option)}
                      className={cn(
                        "flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
                        expiration === option
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      )}
                    >
                      {option === '24h' && '24 Hours'}
                      {option === '7d' && '7 Days'}
                      {option === '30d' && '30 Days'}
                      {option === 'never' && 'Never'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateLink}
                disabled={!email || !name || isGenerating}
                className="w-full py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Link2 size={18} />
                    Generate Share Link
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Generated Link */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-700">Link generated successfully!</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Link2 size={14} className="text-slate-400" />
                    <span className="text-xs text-slate-500">Share Link</span>
                  </div>
                  <div className="text-sm text-slate-700 break-all font-mono">
                    {generatedLink}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                  <Clock size={12} />
                  <span>Expires {getExpirationLabel(expiration)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check size={16} className="text-emerald-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copy Link
                    </>
                  )}
                </button>
                <button
                  onClick={handleSendEmail}
                  className="flex-1 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Mail size={16} />
                  Send Email
                </button>
              </div>

              {/* Create Another */}
              <button
                onClick={handleReset}
                className="w-full mt-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Create another link
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Permission Button Component
interface PermissionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

function PermissionButton({ icon: Icon, label, description, selected, onClick }: PermissionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border text-left transition-all",
        selected
          ? "bg-primary/5 border-primary ring-1 ring-primary"
          : "bg-white border-slate-200 hover:border-slate-300"
      )}
    >
      <Icon className={cn("w-5 h-5 mb-2", selected ? "text-primary" : "text-slate-400")} />
      <div className={cn("text-sm font-medium", selected ? "text-primary" : "text-slate-700")}>
        {label}
      </div>
      <div className="text-xs text-slate-500">{description}</div>
    </button>
  );
}

// Helpers
function getExpirationDate(option: ExpirationOption): string {
  const now = new Date();
  switch (option) {
    case '24h':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case '7d':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    case 'never':
      return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
  }
}

function getExpirationLabel(option: ExpirationOption): string {
  switch (option) {
    case '24h':
      return 'in 24 hours';
    case '7d':
      return 'in 7 days';
    case '30d':
      return 'in 30 days';
    case 'never':
      return 'never';
  }
}

export default ShareModal;
