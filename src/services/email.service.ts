/**
 * Brevo Email Service
 * Handles transactional emails via Brevo (formerly Sendinblue)
 */

import logger from '../logger';
import { email as emailConfig } from '../config/email';
import { passwordResetUrl } from '../config/app';

interface BrevoEmailParams {
  email: string;
  firstName: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

/**
 * Send email via Brevo
 */
export async function sendBrevoEmail(params: BrevoEmailParams): Promise<boolean> {
  const apiKey = emailConfig.brevo.apiKey;
  
  if (!apiKey) {
    logger.error('Brevo API key not configured');
    return false;
  }

  try {
    const response = await fetch(emailConfig.brevo.apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        sender: {
          name: emailConfig.brevo.sender.name,
          email: emailConfig.brevo.sender.email
        },
        to: [
          {
            email: params.email,
            name: params.firstName
          }
        ],
        subject: params.subject,
        htmlContent: params.htmlContent,
        textContent: params.textContent || params.htmlContent
      })
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Brevo API error:', {
        status: response.status,
        error
      });
      return false;
    }

    logger.info('Email sent via Brevo', {
      recipient: params.email,
      subject: params.subject
    });

    return true;
  } catch (error) {
    logger.error('Failed to send email via Brevo:', error);
    return false;
  }
}

/**
 * Send OTP email
 */
export async function sendOtpEmail(
  email: string,
  firstName: string,
  otpCode: string
): Promise<boolean> {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background-color: #0e1116; color: #e1e4e8; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; padding: 32px; background-color: #161b22; border: 1px solid #30363d; border-radius: 12px; }
          .header { text-align: center; margin-bottom: 32px; }
          .header h2 { color: #f0f6fc; font-weight: 600; margin-top: 0; }
          .header h1 { color: #f0f6fc; font-weight: 600; margin-top: 0; }
          p { line-height: 1.6; color: #c9d1d9; }
          .button { 
            display: inline-block; 
            background-color: #2f81f7; 
            color: #ffffff; 
            padding: 12px 24px; 
            border-radius: 6px; 
            text-decoration: none;
            font-weight: 600;
            margin: 24px 0;
            text-align: center;
          }
          .button:hover { background-color: #1f6feb; }
          .footer { font-size: 12px; color: #8b949e; margin-top: 48px; text-align: center; border-top: 1px solid #30363d; padding-top: 24px; }
          .otp-code { 
            font-size: 36px; 
            font-weight: 700; 
            color: #58a6ff; 
            letter-spacing: 8px;
            text-align: center;
            padding: 24px;
            background-color: #0d1117;
            border: 1px solid #30363d;
            border-radius: 8px;
            margin: 32px 0;
          }
</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Email Verification</h2>
            <p>Hi ${firstName},</p>
            <p>Thank you for signing up! To verify your email address, please use the code below:</p>
          </div>
          
          <div class="otp-code">${otpCode}</div>
          
          <p>This code will expire in 10 minutes.</p>
          <p><strong>Never share this code with anyone.</strong></p>
          
          <div class="footer">
            <p>If you didn't sign up for EasyStack, you can ignore this email.</p>
            <p>&copy; 2026 EasyStack. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendBrevoEmail({
    email,
    firstName,
    subject: 'Verify your EasyStack email',
    htmlContent
  });
}

/**
 * Send welcome email after verification
 */
export async function sendWelcomeEmail(
  email: string,
  firstName: string
): Promise<boolean> {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background-color: #0e1116; color: #e1e4e8; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; padding: 32px; background-color: #161b22; border: 1px solid #30363d; border-radius: 12px; }
          .header { text-align: center; margin-bottom: 32px; }
          .header h2 { color: #f0f6fc; font-weight: 600; margin-top: 0; }
          .header h1 { color: #f0f6fc; font-weight: 600; margin-top: 0; }
          p { line-height: 1.6; color: #c9d1d9; }
          .button { 
            display: inline-block; 
            background-color: #2f81f7; 
            color: #ffffff; 
            padding: 12px 24px; 
            border-radius: 6px; 
            text-decoration: none;
            font-weight: 600;
            margin: 24px 0;
            text-align: center;
          }
          .button:hover { background-color: #1f6feb; }
          .footer { font-size: 12px; color: #8b949e; margin-top: 48px; text-align: center; border-top: 1px solid #30363d; padding-top: 24px; }
          .otp-code { 
            font-size: 36px; 
            font-weight: 700; 
            color: #58a6ff; 
            letter-spacing: 8px;
            text-align: center;
            padding: 24px;
            background-color: #0d1117;
            border: 1px solid #30363d;
            border-radius: 8px;
            margin: 32px 0;
          }
</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to EasyStack! 🎉</h1>
          </div>
          
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>Your email has been verified successfully! You're all set to get started.</p>
            <p>
              <a href="https://app.easystack.io/dashboard" class="button">Go to Dashboard</a>
            </p>
            <p>Questions? We're here to help at support@easystack.io</p>
          </div>
          
          <div class="footer">
            <p>&copy; 2026 EasyStack. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendBrevoEmail({
    email,
    firstName,
    subject: 'Welcome to EasyStack!',
    htmlContent
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  token: string
): Promise<boolean> {
  const resetUrl = `${passwordResetUrl}?token=${encodeURIComponent(token)}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background-color: #0e1116; color: #e1e4e8; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; padding: 32px; background-color: #161b22; border: 1px solid #30363d; border-radius: 12px; }
          .header { text-align: center; margin-bottom: 32px; }
          .header h2 { color: #f0f6fc; font-weight: 600; margin-top: 0; }
          .header h1 { color: #f0f6fc; font-weight: 600; margin-top: 0; }
          p { line-height: 1.6; color: #c9d1d9; }
          .button { 
            display: inline-block; 
            background-color: #2f81f7; 
            color: #ffffff; 
            padding: 12px 24px; 
            border-radius: 6px; 
            text-decoration: none;
            font-weight: 600;
            margin: 24px 0;
            text-align: center;
          }
          .button:hover { background-color: #1f6feb; }
          .footer { font-size: 12px; color: #8b949e; margin-top: 48px; text-align: center; border-top: 1px solid #30363d; padding-top: 24px; }
          .otp-code { 
            font-size: 36px; 
            font-weight: 700; 
            color: #58a6ff; 
            letter-spacing: 8px;
            text-align: center;
            padding: 24px;
            background-color: #0d1117;
            border: 1px solid #30363d;
            border-radius: 8px;
            margin: 32px 0;
          }
</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Reset your EasyStack password</h2>
            <p>Hi ${firstName},</p>
            <p>We received a request to reset your password. Click the button below to choose a new password:</p>
          </div>
          <p>
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>If you did not request this, you can safely ignore this email.</p>
          <div class="footer">
            <p>This link will expire in 30 minutes for your security.</p>
            <p>&copy; 2026 EasyStack. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendBrevoEmail({
    email,
    firstName,
    subject: 'Reset your EasyStack password',
    htmlContent
  });
}

/**
 * Send workspace invitation email
 */
export async function sendWorkspaceInviteEmail(
  email: string,
  inviterName: string,
  workspaceName: string,
  token: string
): Promise<boolean> {
  // Assuming the frontend runs at a known URL or the same domain
  // We can configure this in config later, but for now:
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const inviteUrl = `${appUrl}/invites/accept?token=${encodeURIComponent(token)}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background-color: #0e1116; color: #e1e4e8; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; padding: 32px; background-color: #161b22; border: 1px solid #30363d; border-radius: 12px; }
          .header { text-align: center; margin-bottom: 32px; }
          .header h2 { color: #f0f6fc; font-weight: 600; margin-top: 0; }
          .header h1 { color: #f0f6fc; font-weight: 600; margin-top: 0; }
          p { line-height: 1.6; color: #c9d1d9; }
          .button { 
            display: inline-block; 
            background-color: #2f81f7; 
            color: #ffffff; 
            padding: 12px 24px; 
            border-radius: 6px; 
            text-decoration: none;
            font-weight: 600;
            margin: 24px 0;
            text-align: center;
          }
          .button:hover { background-color: #1f6feb; }
          .footer { font-size: 12px; color: #8b949e; margin-top: 48px; text-align: center; border-top: 1px solid #30363d; padding-top: 24px; }
          .otp-code { 
            font-size: 36px; 
            font-weight: 700; 
            color: #58a6ff; 
            letter-spacing: 8px;
            text-align: center;
            padding: 24px;
            background-color: #0d1117;
            border: 1px solid #30363d;
            border-radius: 8px;
            margin: 32px 0;
          }
</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>You've been invited!</h2>
            <p>Hi there,</p>
            <p><strong>${inviterName}</strong> has invited you to join the <strong>${workspaceName}</strong> workspace on EasyStack.</p>
          </div>
          <p>
            <a href="${inviteUrl}" class="button">Accept Invitation</a>
          </p>
          <p>If you don't have an account yet, you will be prompted to create one.</p>
          <div class="footer">
            <p>This invitation link will expire in 7 days.</p>
            <p>&copy; 2026 EasyStack. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendBrevoEmail({
    email,
    firstName: email.split('@')[0]!,
    subject: `You've been invited to join ${workspaceName}`,
    htmlContent
  });
}

export interface ReleaseNotificationEmailParams {
  email: string;
  recipientName: string;
  releaseName: string;
  version: string;
  targetEnvironment: string;
  action: 'SCHEDULED' | 'SCHEDULE_UPDATED' | 'SCHEDULE_CANCELLED' | 'DEPLOYED';
  scheduledAt?: string | undefined;
  actionBy?: string | undefined;
}

export async function sendReleaseNotificationEmail(params: ReleaseNotificationEmailParams): Promise<boolean> {
  const { email, recipientName, releaseName, version, targetEnvironment, action, scheduledAt, actionBy } = params;

  let title = '';
  let description = '';
  let badgeColor = '#2f81f7';

  switch (action) {
    case 'SCHEDULED':
      title = `Release Scheduled: ${releaseName} (${version})`;
      description = `A new release has been scheduled for target environment <strong>${targetEnvironment}</strong>${scheduledAt ? ` on <strong>${new Date(scheduledAt).toLocaleString()}</strong>` : ''}${actionBy ? ` by ${actionBy}` : ''}.`;
      badgeColor = '#388bfd';
      break;
    case 'SCHEDULE_UPDATED':
      title = `Release Rescheduled: ${releaseName} (${version})`;
      description = `The execution schedule for release <strong>${releaseName}</strong> has been updated to <strong>${scheduledAt ? new Date(scheduledAt).toLocaleString() : ''}</strong>${actionBy ? ` by ${actionBy}` : ''}.`;
      badgeColor = '#d29922';
      break;
    case 'SCHEDULE_CANCELLED':
      title = `Schedule Cancelled: ${releaseName} (${version})`;
      description = `The scheduled release <strong>${releaseName}</strong> targeting <strong>${targetEnvironment}</strong> was cancelled${actionBy ? ` by ${actionBy}` : ''}.`;
      badgeColor = '#f85149';
      break;
    case 'DEPLOYED':
      title = `Release Deployed: ${releaseName} (${version})`;
      description = `Release <strong>${releaseName}</strong> (${version}) has successfully deployed and is now live in <strong>${targetEnvironment}</strong>!`;
      badgeColor = '#3fb950';
      break;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0d1117; color: #c9d1d9; margin: 0; padding: 40px 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 40px; }
          .badge { display: inline-block; background-color: ${badgeColor}; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; }
          h2 { color: #f0f6fc; margin-top: 0; }
          p { line-height: 1.6; color: #c9d1d9; }
          .details { background-color: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 16px; margin: 20px 0; }
          .footer { font-size: 12px; color: #8b949e; margin-top: 32px; text-align: center; border-top: 1px solid #30363d; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <span class="badge">${action.replace('_', ' ')}</span>
          <h2>${title}</h2>
          <p>Hi ${recipientName || 'there'},</p>
          <p>${description}</p>
          <div class="details">
            <p style="margin: 4px 0;"><strong>Release:</strong> ${releaseName}</p>
            <p style="margin: 4px 0;"><strong>Version:</strong> ${version}</p>
            <p style="margin: 4px 0;"><strong>Target Environment:</strong> ${targetEnvironment}</p>
            ${scheduledAt ? `<p style="margin: 4px 0;"><strong>Scheduled Time:</strong> ${new Date(scheduledAt).toLocaleString()}</p>` : ''}
          </div>
          <div class="footer">
            <p>&copy; 2026 EasyStack. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendBrevoEmail({
    email,
    firstName: recipientName || email.split('@')[0]!,
    subject: `[EasyStack] ${title}`,
    htmlContent
  });
}

