import { EmailService } from "./email.service";

describe("EmailService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should fail at startup when REQUIRE_SMTP is true and SMTP_HOST is not configured", () => {
    delete process.env.SMTP_HOST;
    process.env.REQUIRE_SMTP = "true";

    expect(() => new EmailService()).toThrow(
      "SMTP_HOST environment variable is required for email delivery.",
    );
  });

  it("should warn but not throw in production when REQUIRE_SMTP is not true and SMTP_HOST is unset", () => {
    delete process.env.SMTP_HOST;
    delete process.env.REQUIRE_SMTP;
    process.env.NODE_ENV = "production";

    expect(() => new EmailService()).not.toThrow();
  });

  it("should return false gracefully if sendWelcomeEmail is called without transporter", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.REQUIRE_SMTP;
    process.env.NODE_ENV = "test";

    const service = new EmailService();
    const result = await service.sendWelcomeEmail(
      "test@example.com",
      "password123",
      "ADMIN",
    );
    expect(result).toBe(false);
  });

  it("should return false gracefully if sendPasswordResetEmail is called without transporter", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.REQUIRE_SMTP;
    process.env.NODE_ENV = "test";

    const service = new EmailService();
    const result = await service.sendPasswordResetEmail(
      "test@example.com",
      "reset-token",
      "CLIENT",
    );
    expect(result).toBe(false);
  });

  describe("getFrontendBaseUrl role routing", () => {
    it("routes reset email correctly for each role", () => {
      process.env.ADMIN_URL = "https://inhouse.optiqsports.com";
      process.env.PORTAL_URL = "https://portal.optiqsports.com";
      process.env.BROADCAST_URL = "https://broadcast.optiqsports.com";
      process.env.STATDASH_URL = "https://inhouse.optiqsports.com";

      const service = new EmailService();
      const getBaseUrl = (
        service as unknown as { getFrontendBaseUrl: (role?: string) => string }
      ).getFrontendBaseUrl.bind(service);

      expect(getBaseUrl("CLIENT")).toBe("https://portal.optiqsports.com");
      expect(getBaseUrl("BROADCASTER")).toBe(
        "https://broadcast.optiqsports.com",
      );
      expect(getBaseUrl("STATISTICIAN")).toBe(
        "https://inhouse.optiqsports.com",
      );
      expect(getBaseUrl("ADMIN")).toBe("https://inhouse.optiqsports.com");
      expect(getBaseUrl("SUPER_ADMIN")).toBe("https://inhouse.optiqsports.com");
    });
  });
});
