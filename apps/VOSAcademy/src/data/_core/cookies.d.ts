export declare const COOKIE_NAME = "vosacademy_session";
export declare function getSessionCookieOptions(req?: any): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
};
