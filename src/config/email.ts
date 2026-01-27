/**
 * Email Configuration
 * Centralized email service settings
 */

export const email = {
  // Brevo API settings
  brevo: {
    apiKey: process.env.BREVO_API_KEY,
    apiUrl: 'https://api.brevo.com/v3/smtp/email',
    sender: {
      email: process.env.BREVO_SENDER_EMAIL || 'team@eromstudio.in',
      name: process.env.BREVO_SENDER_NAME || 'EasyStack by Erom Studio'
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
