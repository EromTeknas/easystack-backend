/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

/**
 * Validate password strength
 * Requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const isValidPassword = (password: string): boolean => {
  if (password.length < 12) {
    return false;
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  return hasUppercase && hasLowercase && hasNumber && hasSpecial;
};

/**
 * Get password strength feedback
 */
export const getPasswordFeedback = (password: string): string[] => {
  const feedback: string[] = [];

  if (password.length < 12) {
    feedback.push('Password must be at least 12 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    feedback.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    feedback.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    feedback.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    feedback.push('Password must contain at least one special character');
  }

  return feedback;
};

/**
 * Validate name format
 */
export const isValidName = (name: string): boolean => {
  return name.trim().length > 0 && name.length <= 100;
};

/**
 * Extract client IP address from request
 */
export const getClientIP = (req: any): string => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'Unknown'
  );
};

/**
 * Get device name from user agent
 */
export const getDeviceName = (userAgent: string): string => {
  if (!userAgent) return 'Unknown Device';

  // Basic device detection
  if (/mobile|android|iphone|ipod/i.test(userAgent)) {
    if (/iphone|ipod/i.test(userAgent)) return 'iPhone';
    if (/ipad/i.test(userAgent)) return 'iPad';
    if (/android/i.test(userAgent)) return 'Android';
    return 'Mobile Device';
  }

  if (/windows/i.test(userAgent)) {
    if (/chrome/i.test(userAgent)) return 'Chrome on Windows';
    if (/firefox/i.test(userAgent)) return 'Firefox on Windows';
    if (/safari/i.test(userAgent)) return 'Safari on Windows';
    return 'Windows';
  }

  if (/mac/i.test(userAgent)) {
    if (/chrome/i.test(userAgent)) return 'Chrome on macOS';
    if (/firefox/i.test(userAgent)) return 'Firefox on macOS';
    if (/safari/i.test(userAgent)) return 'Safari on macOS';
    return 'macOS';
  }

  if (/linux/i.test(userAgent)) return 'Linux';

  return 'Unknown Device';
};
