import { EmailService } from "./email.service";

describe("EmailService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should fail at startup in production when SMTP_HOST is not configured", () => {
    delete process.env.SMTP_HOST;
    process.env.NODE_ENV = "production";

    expect(() => new EmailService()).toThrow(
      "SMTP_HOST environment variable is required for email delivery.",
    );
  });

  it("should warn but not throw in test mode when SMTP_HOST is unset", () => {
    delete process.env.SMTP_HOST;
    process.env.NODE_ENV = "test";

    expect(() => new EmailService()).not.toThrow();
  });

  it("should return false gracefully if sendWelcomeEmail is called without transporter", async () => {
    delete process.env.SMTP_HOST;
    process.env.NODE_ENV = "test";

    const service = new EmailService();
    const result = await service.sendWelcomeEmail(
      "test@example.com",
      "password123",
      "ADMIN",
    );
    expect(result).toBe(false);
  });
});
