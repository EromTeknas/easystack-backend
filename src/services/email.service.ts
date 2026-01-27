/**
 * Brevo Email Service
 * Handles transactional emails via Brevo (formerly Sendinblue)
 */

import logger from '../logger';
import { email as emailConfig } from '../config/email';

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
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; }
          .otp-code { 
            font-size: 32px; 
            font-weight: bold; 
            color: #0066cc; 
            letter-spacing: 5px;
            text-align: center;
            padding: 20px;
            background-color: #f0f7ff;
            border-radius: 8px;
            margin: 20px 0;
          }
          .footer { font-size: 12px; color: #666; margin-top: 20px; }
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
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0066cc 0%, #004499 100%); color: white; padding: 30px; border-radius: 8px; }
          .content { padding: 20px; }
          .button { 
            display: inline-block; 
            background-color: #0066cc; 
            color: white; 
            padding: 12px 30px; 
            border-radius: 6px; 
            text-decoration: none;
            margin: 20px 0;
          }
          .footer { font-size: 12px; color: #666; margin-top: 20px; }
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
