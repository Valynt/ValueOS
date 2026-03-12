export const publicRoutePaths = [
  "/login",
  "/signup",
  "/reset-password",
  "/auth/callback",
];

export const protectedRoutePaths: string[] = [];
export const adminRoutePaths: string[] = [];

export const redirectRoutes = [
  { path: "/", to: "/dashboard" },
  { path: "/home", to: "/dashboard" },
];
