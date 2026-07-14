export interface AuthenticationNotifier {
  sendVerificationOtp(input: {
    email: string;
    firstName: string;
    otpCode: string;
  }): Promise<void>;

  sendPasswordReset(input: {
    email: string;
    firstName: string;
    token: string;
  }): Promise<void>;

  sendWelcome(input: {
    email: string;
    firstName: string;
  }): Promise<void>;
}
