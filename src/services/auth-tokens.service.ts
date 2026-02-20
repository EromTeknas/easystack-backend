import { verifyRefreshToken, generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { verifyTokenHash, hashToken } from '../utils/password';
import { UnauthorizedError } from '../errors';
import { prisma } from '../db';
import { auth } from '../config/auth';
import { getClientIP, getDeviceName } from '../utils/validation';

export const rotateRefreshToken = async (refreshToken: string, req: any) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (error: any) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const userId = Number(decoded.sub);

  const tokenRecord = await prisma.refreshToken.findFirst({
    where: {
      userId,
      revokedAt: null
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!tokenRecord) {
    throw new UnauthorizedError('Refresh token invalid');
  }

  const isTokenValid = await verifyTokenHash(refreshToken, tokenRecord.tokenHash);
  if (!isTokenValid) {
    throw new UnauthorizedError('Refresh token invalid');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      status: true,
      firstName: true,
      lastName: true
    }
  });

  if (!user || user.status.toUpperCase() !== 'ACTIVE') {
    throw new UnauthorizedError('User account is inactive');
  }

  const subject = userId.toString();
  const newAccessToken = generateAccessToken(subject, user.email, 'USER');
  const newRefreshToken = generateRefreshToken(subject);
  const newRefreshTokenHash = await hashToken(newRefreshToken);

  const expiresAt = new Date(Date.now() + auth.refreshTokenExpirySeconds * 1000);

  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { revokedAt: new Date() }
  });

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: newRefreshTokenHash,
      expiresAt,
      ipAddress: getClientIP(req),
      userAgent: (req.headers['user-agent'] as string) || 'Unknown',
      deviceName: getDeviceName((req.headers['user-agent'] as string) || '')
    }
  });

  return {
    user,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  };
};
