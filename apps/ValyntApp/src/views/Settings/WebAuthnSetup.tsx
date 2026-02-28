/**
 * WebAuthn Setup Component
 *
 * Allows users to register hardware security keys or biometric authenticators
 *
 * Supports:
 * - YubiKey, Titan Key (USB/NFC)
 * - TouchID, FaceID (macOS/iOS)
 * - Windows Hello (Windows)
 */

import { startRegistration } from "@simplewebauthn/browser";
import React, { useState } from "react";

import { logger } from "../../lib/logger";
import { webAuthnService } from "../../services/WebAuthnService";

import { AlertDialog, ConfirmDialog } from "@/components/ui";

interface WebAuthnSetupProps {
  userId: string;
  userEmail: string;
  userName: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function WebAuthnSetup({
  userId,
  userEmail,
  userName,
  onSuccess,
  onCancel,
}: WebAuthnSetupProps) {
  const [step, setStep] = useState<
    "intro" | "name" | "registering" | "success"
  >("intro");
  const [credentialName, setCredentialName] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleStartRegistration = async () => {
    if (!credentialName.trim()) {
      setError("Please enter a name for your security key");
      return;
    }

    setLoading(true);
    setError("");
    setStep("registering");

    try {
      // Get registration options from server
      const options = await webAuthnService.generateRegistrationOptions(
        userId,
        userEmail,
        userName
      );

      // Start browser WebAuthn flow
      logger.info("Starting WebAuthn registration...");
      const response = await startRegistration(options);

      // Verify and store credential
      await webAuthnService.verifyAndStoreCredential(
        userId,
        response,
        credentialName
      );

      setStep("success");
      setTimeout(() => onSuccess(), 2000);
    } catch (err: any) {
      logger.error("WebAuthn registration failed", err);

      let errorMessage = "Failed to register security key";
      if (err.name === "NotAllowedError") {
        errorMessage = "Registration cancelled or timed out";
      } else if (err.name === "InvalidStateError") {
        errorMessage = "This security key is already registered";
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setStep("name");
    } finally {
      setLoading(false);
    }
  };

  if (step === "intro") {
    return (
      <div className="webauthn-setup-intro">
        <h2>Add Security Key</h2>
        <div className="info-box">
          <p>
            <strong>Hardware Security Keys</strong> provide the strongest
            protection against phishing and account takeover.
          </p>
          <p>Compatible with:</p>
          <ul>
            <li>🔑 YubiKey, Titan Key, FIDO2 keys</li>
            <li>👆 TouchID, FaceID (macOS/iOS)</li>
            <li>🪟 Windows Hello (biometrics/PIN)</li>
          </ul>
        </div>
        <div className="button-group">
          <button onClick={() => setStep("name")} className="btn btn-primary">
            Add Security Key
          </button>
          {onCancel && (
            <button onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === "name") {
    return (
      <div className="webauthn-setup-name">
        <h2>Name Your Security Key</h2>
        <p>
          Give your security key a memorable name (e.g., "Work YubiKey",
          "MacBook TouchID")
        </p>

        <input
          type="text"
          value={credentialName}
          onChange={(e) => setCredentialName(e.target.value)}
          placeholder="My Security Key"
          maxLength={50}
          className="input-text"
          autoFocus
        />

        {error && <div className="alert alert-error">{error}</div>}

        <div className="button-group">
          <button
            onClick={handleStartRegistration}
            disabled={!credentialName.trim() || loading}
            className="btn btn-primary"
          >
            {loading ? "Registering..." : "Continue"}
          </button>
          <button
            onClick={() => setStep("intro")}
            className="btn btn-secondary"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (step === "registering") {
    return (
      <div className="webauthn-setup-registering">
        <div className="spinner" />
        <h2>Follow Your Browser's Instructions</h2>
        <div className="instructions">
          <p>
            <strong>USB Key:</strong> Insert your YubiKey and touch the gold
            sensor
          </p>
          <p>
            <strong>TouchID:</strong> Touch the sensor on your device
          </p>
          <p>
            <strong>Windows Hello:</strong> Complete biometric or PIN
            authentication
          </p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="webauthn-setup-success">
        <div className="success-icon">✓</div>
        <h2>Security Key Registered!</h2>
        <p>
          You can now use <strong>{credentialName}</strong> to sign in.
        </p>
      </div>
    );
  }

  return null;
}

/**
 * WebAuthn Credential List Component
 */
interface WebAuthnCredentialListProps {
  userId: string;
  onAddKey: () => void;
}

export function WebAuthnCredentialList({
  userId,
  onAddKey,
}: WebAuthnCredentialListProps) {
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCredentials = async () => {
    try {
      const creds = await webAuthnService.getCredentials(userId);
      setCredentials(creds);
    } catch (error) {
      logger.error("Failed to load WebAuthn credentials", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadCredentials();
  }, [userId]);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const handleDelete = (credentialId: string) => {
    setConfirmDeleteId(credentialId);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await webAuthnService.deleteCredential(userId, confirmDeleteId);
      setCredentials(credentials.filter((c) => c.id !== confirmDeleteId));
    } catch (error) {
      logger.error("Failed to delete credential", error);
      setAlertError("Failed to remove security key");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  if (loading) {
    return <div>Loading security keys...</div>;
  }

  return (
    <>
      <div className="webauthn-credential-list">
        <h3>Registered Security Keys</h3>

        {credentials.length === 0 ? (
          <div className="empty-state">
            <p>No security keys registered yet.</p>
            <button onClick={onAddKey} className="btn btn-primary">
              Add Your First Security Key
            </button>
          </div>
        ) : (
          <>
            <div className="credential-items">
              {credentials.map((cred) => (
                <div key={cred.id} className="credential-item">
                  <div className="credential-icon">
                    {cred.device_type === "platform" ? "👆" : "🔑"}
                  </div>
                  <div className="credential-info">
                    <strong>{cred.name}</strong>
                    <span className="credential-meta">
                      {cred.device_type === "platform" ? "Built-in" : "External"}{" "}
                      • Added {new Date(cred.created_at).toLocaleDateString()}
                      {cred.last_used_at && (
                        <>
                          {" "}
                          • Last used{" "}
                          {new Date(cred.last_used_at).toLocaleDateString()}
                        </>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(cred.id)}
                    className="btn btn-danger btn-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button onClick={onAddKey} className="btn btn-secondary mt-3">
              Add Another Key
            </button>
          </>
        )}
      </div>
      {confirmDeleteId && (
        <ConfirmDialog
          open={!!confirmDeleteId}
          onOpenChange={(open) => !open && setConfirmDeleteId(null)}
          title="Remove Security Key"
          description="Remove this security key? You will no longer be able to use it to sign in."
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={handleConfirmDelete}
        />
      )}
      {alertError && (
        <AlertDialog
          open={!!alertError}
          onOpenChange={() => setAlertError(null)}
          title="Error"
          description={alertError}
          actionLabel="OK"
          variant="destructive"
        />
      )}
    </>
  );
}
