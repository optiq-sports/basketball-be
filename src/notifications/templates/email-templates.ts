export const getWelcomeEmailTemplate = (
  role: string,
  generatedPassword: string,
) => ({
  subject: "Welcome to Optiq Sports! Your account has been created.",
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

export const getPasswordResetEmailTemplate = (resetUrl: string) => ({
  subject: "Optiq Sports Password Reset Request",
  text: `You requested a password reset. Please click this link to reset your password: ${resetUrl}`,
  html: `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your Optiq Sports account.</p>
      <p>Please click the link below to set a new password:</p>
      <a href="${resetUrl}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
      <p><em>If you did not request this, please ignore this email.</em></p>
    </div>
  `,
});
