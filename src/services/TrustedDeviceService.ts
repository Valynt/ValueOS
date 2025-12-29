/**
 * Trusted Device Service
 *
 * Manages trusted devices for MFA bypass
 *
 * Features:
 * - Device fingerprinting (privacy-preserving)
 * - 30-day trust period
 * - Device revocation
 * - Security monitoring
 */

import { logger } from "../lib/logger";
import { BaseService } from "./BaseService";

export interface TrustedDevice {
  id: string;
  userId: string;
  deviceFingerprint: string;
  deviceName: string;
  ipAddress?: string;
  userAgent?: string;
  lastUsedAt: string;
  expiresAt: string;
  createdAt: string;
}

const TRUST_PERIOD_DAYS = 30;

export class TrustedDeviceService extends BaseService {
  constructor() {
    super("TrustedDeviceService");
  }

  /**
   * Generate device fingerprint from browser characteristics
   *
   * Uses: User-Agent, Screen Resolution, Timezone, Canvas hash
   * Privacy: No PII, fingerprint is hashed
   */
  generateDeviceFingerprint(): string {
    const components = [
      navigator.userAgent,
      screen.width + "x" + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.language,
      navigator.platform,
    ];

    // Create canvas fingerprint (detects rendering differences)
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillText("ValueOS", 2, 2);
      components.push(canvas.toDataURL());
    }

    // Hash components
    const combined = components.join("|");
    return this.hashString(combined);
  }

  /**
   * Check if device is trusted
   */
  async isTrusted(userId: string, deviceFingerprint: string): Promise<boolean> {
    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from("trusted_devices")
          .select("*")
          .eq("user_id", userId)
          .eq("device_fingerprint", deviceFingerprint)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();

        if (error) {
          logger.error("Error checking trusted device", error);
          return false;
        }

        if (data) {
          // Update last used timestamp
          await this.supabase
            .from("trusted_devices")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", data.id);

          return true;
        }

        return false;
      },
      { skipCache: true }
    );
  }

  /**
   * Trust a device
   */
  async trustDevice(
    userId: string,
    deviceFingerprint: string,
    deviceName: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<TrustedDevice> {
    this.log("info", "Trusting device", { userId, deviceName });

    return this.executeRequest(
      async () => {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + TRUST_PERIOD_DAYS);

        const { data, error } = await this.supabase
          .from("trusted_devices")
          .upsert({
            user_id: userId,
            device_fingerprint: deviceFingerprint,
            device_name: deviceName,
            ip_address: ipAddress,
            user_agent: userAgent,
            expires_at: expiresAt.toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        logger.info("Device trusted", {
          userId,
          deviceName,
          expiresAt: expiresAt.toISOString(),
        });

        return data;
      },
      { skipCache: true }
    );
  }

  /**
   * Get user's trusted devices
   */
  async getTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from("trusted_devices")
          .select("*")
          .eq("user_id", userId)
          .gt("expires_at", new Date().toISOString())
          .order("last_used_at", { ascending: false });

        if (error) throw error;
        return data || [];
      },
      { deduplicationKey: `trusted-devices-${userId}` }
    );
  }

  /**
   * Revoke trusted device
   */
  async revokeDevice(userId: string, deviceId: string): Promise<void> {
    this.log("info", "Revoking trusted device", { userId, deviceId });

    return this.executeRequest(
      async () => {
        const { error } = await this.supabase
          .from("trusted_devices")
          .delete()
          .eq("user_id", userId)
          .eq("id", deviceId);

        if (error) throw error;

        this.clearCache(`trusted-devices-${userId}`);
      },
      { skipCache: true }
    );
  }

  /**
   * Revoke all trusted devices (e.g., on password change)
   */
  async revokeAllDevices(userId: string): Promise<void> {
    this.log("info", "Revoking all trusted devices", { userId });

    return this.executeRequest(
      async () => {
        const { error } = await this.supabase
          .from("trusted_devices")
          .delete()
          .eq("user_id", userId);

        if (error) throw error;

        this.clearCache(`trusted-devices-${userId}`);
      },
      { skipCache: true }
    );
  }

  /**
   * Get device name from user agent
   */
  getDeviceName(userAgent?: string): string {
    const ua = userAgent || navigator.userAgent;

    let browser = "Unknown Browser";
    let os = "Unknown OS";

    // Detect browser
    if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Safari") && !ua.includes("Chrome"))
      browser = "Safari";
    else if (ua.includes("Edg")) browser = "Edge";

    // Detect OS
    if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Mac")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad"))
      os = "iOS";

    return `${browser} on ${os}`;
  }

  /**
   * Hash string using SHA-256
   */
  private async hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}

export const trustedDeviceService = new TrustedDeviceService();
