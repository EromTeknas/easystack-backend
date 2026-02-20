import type { CookieOptions, Response } from 'express';
import { auth } from '../config/auth';
import { getTokenExpiryInSeconds } from './jwt';

const baseCookieOptions = (): CookieOptions => ({
  httpOnly: auth.cookies.httpOnly,
  secure: auth.cookies.secure,
  sameSite: auth.cookies.sameSite,
  ...(auth.cookies.domain ? { domain: auth.cookies.domain } : {}),
  ...(auth.cookies.path ? { path: auth.cookies.path } : {})
});

export const setAccessTokenCookie = (res: Response, accessToken: string) => {
  const maxAge = getTokenExpiryInSeconds(accessToken) * 1000;
  res.cookie(auth.cookies.accessTokenName, accessToken, {
    ...baseCookieOptions(),
    maxAge
  });
};

export const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
  res.cookie(auth.cookies.refreshTokenName, refreshToken, {
    ...baseCookieOptions(),
    maxAge: auth.cookies.maxAge
  });
};

export const clearAuthCookies = (res: Response) => {
  const options = baseCookieOptions();
  res.clearCookie(auth.cookies.accessTokenName, options);
  res.clearCookie(auth.cookies.refreshTokenName, options);
};
