export var COOKIE_NAME = "vosacademy_session";
export function getSessionCookieOptions(req) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
    };
}
