export const COOKIE_NAME = "vosacademy_session";

export function getSessionCookieOptions(_req?: { headers?: Record<string, string> }) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}
