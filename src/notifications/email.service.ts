import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import {
  getWelcomeEmailTemplate,
  getPasswordResetEmailTemplate,
} from "./templates/email-templates";

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    if (!process.env.SMTP_HOST) {
      this.logger.warn(
        "SMTP_HOST environment variable is required for email delivery.",
      );
      return;
      // throw new Error(
      //   "SMTP_HOST environment variable is required for email delivery.",
      // );
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendWelcomeEmail(
    to: string,
    generatedPassword: string,
    role: string,
  ): Promise<boolean> {
    try {
      const template = getWelcomeEmailTemplate(role, generatedPassword);
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"Optiq Sports" <noreply@optiqsports.com>',
        to,
        ...template,
      });

      this.logger.log(
        `Welcome email sent to ${to}. Message ID: ${info.messageId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${to}: ${error.message}`,
      );
      // Don't throw error to avoid breaking the user creation flow
      return false;
    }
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
    try {
      const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${token}`;
      const template = getPasswordResetEmailTemplate(resetUrl);
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"Optiq Sports" <noreply@optiqsports.com>',
        to,
        ...template,
      });

      this.logger.log(
        `Password reset email sent to ${to}. Message ID: ${info.messageId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${to}: ${error.message}`,
      );
      return false;
    }
  }
}
