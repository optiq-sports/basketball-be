import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    // Note: Configure this with real SMTP credentials via env vars
    // For local testing without real credentials, you can use ethereal.email or a mock
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER || 'ethereal_user',
        pass: process.env.SMTP_PASS || 'ethereal_pass',
      },
    });
  }

  async sendWelcomeEmail(to: string, generatedPassword: string, role: string): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail({
        from: '"Optiq Sports" <noreply@optiqsports.com>',
        to,
        subject: 'Welcome to Optiq Sports! Your account has been created.',
        text: `Welcome! Your ${role} account has been provisioned. \n\nYour temporary password is: ${generatedPassword}\n\nPlease login and change your password immediately.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2>Welcome to Optiq Sports!</h2>
            <p>Your <strong>${role}</strong> account has been successfully provisioned by the administration team.</p>
            <p><strong>Your temporary password is:</strong></p>
            <div style="padding: 10px; background-color: #f4f4f4; border-radius: 4px; display: inline-block; font-size: 18px; letter-spacing: 2px;">
              ${generatedPassword}
            </div>
            <p><em>Note: You will be required to change this password on your first login.</em></p>
          </div>
        `,
      });

      this.logger.log(`Welcome email sent to ${to}. Message ID: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${to}: ${error.message}`);
      // Don't throw error to avoid breaking the user creation flow
      return false;
    }
  }
}
