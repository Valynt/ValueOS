/**
 * MFA Setup Component
 *
 * Allows users to enroll in MFA using TOTP (Google Authenticator, Authy, etc.)
 *
 * AUTH-001: MFA enrollment flow for privileged roles
 */

import { useState } from "react";
import { mfaService } from "../../services/MFAService";
import { logger } from "../../lib/logger";

interface MFASetupProps {
  userId: string;
  userEmail: string;
  userRole: string;
  onComplete: () => void;
  onCancel?: () => void;
}

export function MFASetup({
  userId,
  userEmail,
  userRole,
  onComplete,
  onCancel,
}: MFASetupProps) {
  const [step, setStep] = useState<
    "intro" | "qrcode" | "verify" | "backup" | "complete"
  >("intro");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [manualKey, setManualKey] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const mfaRequired = ["super_admin", "admin", "manager"].includes(userRole);

  const handleSetup = async () => {
    setLoading(true);
    setError("");

    try {
      const setup = await mfaService.setupMFA(userId, userEmail);
      setQrCodeUrl(setup.qrCodeUrl);
      setManualKey(setup.manualEntryKey);
      setBackupCodes(setup.backupCodes);
      setStep("qrcode");
    } catch (err) {
      logger.error("MFA setup failed", err);
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await mfaService.verifyAndEnableMFA(userId, verificationCode);
      setStep("backup");
    } catch (err) {
      logger.error("MFA verification failed", err);
      setError("Invalid code. Please try again.");
      setVerificationCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    setStep("complete");
    setTimeout(() => onComplete(), 2000);
  };

  if (step === "intro") {
    return (
      <div className="mfa-setup-intro">
        <h2>Set Up Two-Factor Authentication</h2>
        {mfaRequired && (
          <div className="alert alert-warning">
            <strong>Required:</strong> Your role ({userRole}) requires MFA for
            enhanced security.
          </div>
        )}
        <p>
          Two-factor authentication adds an extra layer of security to your
          account. You'll need an authenticator app like Google Authenticator or
          Authy.
        </p>
        <div className="button-group">
          <button
            onClick={handleSetup}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? "Setting up..." : "Begin Setup"}
          </button>
          {!mfaRequired && onCancel && (
            <button onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
          )}
        </div>
        {error && <div className="alert alert-error">{error}</div>}
      </div>
    );
  }

  if (step === "qrcode") {
    return (
      <div className="mfa-setup-qrcode">
        <h2>Scan QR Code</h2>
        <p>Scan this QR code with your authenticator app:</p>
        {qrCodeUrl && (
          <div className="qr-code-container">
            <img src={qrCodeUrl} alt="MFA QR Code" />
          </div>
        )}
        <details className="manual-entry">
          <summary>Can't scan? Enter key manually</summary>
          <div className="manual-key">
            <code>{manualKey}</code>
            <button
              onClick={() => navigator.clipboard.writeText(manualKey)}
              className="btn btn-small"
            >
              Copy
            </button>
          </div>
        </details>
        <button onClick={() => setStep("verify")} className="btn btn-primary">
          Next
        </button>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="mfa-setup-verify">
        <h2>Verify Setup</h2>
        <p>Enter the 6-digit code from your authenticator app:</p>
        <input
          type="text"
          value={verificationCode}
          onChange={(e) =>
            setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="000000"
          maxLength={6}
          className="mfa-code-input"
          autoFocus
        />
        {error && <div className="alert alert-error">{error}</div>}
        <div className="button-group">
          <button
            onClick={handleVerify}
            disabled={loading || verificationCode.length !== 6}
            className="btn btn-primary"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
          <button
            onClick={() => setStep("qrcode")}
            className="btn btn-secondary"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (step === "backup") {
    return (
      <div className="mfa-setup-backup">
        <h2>Save Backup Codes</h2>
        <div className="alert alert-warning">
          <strong>Important:</strong> Save these backup codes in a secure
          location. You can use them to access your account if you lose your
          authenticator device.
        </div>
        <div className="backup-codes-grid">
          {backupCodes.map((code, index) => (
            <div key={index} className="backup-code">
              <code>{code}</code>
            </div>
          ))}
        </div>
        <div className="button-group">
          <button
            onClick={() => {
              const codesText = backupCodes.join("\n");
              navigator.clipboard.writeText(codesText);
            }}
            className="btn btn-secondary"
          >
            Copy All Codes
          </button>
          <button onClick={handleComplete} className="btn btn-primary">
            I've Saved My Codes
          </button>
        </div>
      </div>
    );
  }

  if (step === "complete") {
    return (
      <div className="mfa-setup-complete">
        <div className="success-icon">✓</div>
        <h2>MFA Enabled Successfully!</h2>
        <p>Your account is now protected with two-factor authentication.</p>
      </div>
    );
  }

  return null;
}
