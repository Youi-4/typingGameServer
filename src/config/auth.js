const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const AUTH_COOKIE_NAME = "token";

export function getJwtSecret() {
  if (!process.env.SECRET_KEY) {
    throw new Error("SECRET_KEY is required");
  }

  return process.env.SECRET_KEY;
}

export function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: ONE_WEEK_MS,
  };
}

export function getClearAuthCookieOptions() {
  const { httpOnly, secure, sameSite } = getAuthCookieOptions();

  return {
    httpOnly,
    secure,
    sameSite,
  };
}
