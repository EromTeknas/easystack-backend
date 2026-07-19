import { env } from "./env";

/**
 * Email Configuration
 * Centralized email service settings
 */

export const email = {
  // Brevo API settings
  brevo: {
    apiKey: env.BREVO_API_KEY,
    apiUrl: 'https://api.brevo.com/v3/smtp/email',
    sender: {
      email: env.BREVO_SENDER_EMAIL,
      name: env.BREVO_SENDER_NAME
    }
  },
  
  // Email templates
  templates: {
    otp: {
      subject: 'Your OTP Code - EasyStack',
      sender: 'team@eromstudio.in'
    },
    welcome: {
      subject: 'Welcome to EasyStack',
      sender: 'team@eromstudio.in'
    }
  }
};

export default email;
