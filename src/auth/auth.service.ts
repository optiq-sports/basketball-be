import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import ms, { StringValue } from "ms";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { Role } from "@prisma/client";
import { EmailService } from "../notifications/email.service";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true, clientUsers: true },
    });

    if (!user || !user.password || user.status !== "ACTIVE") {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    const { password: _, ...result } = user;
    return result;
  }

  private async generateAuthResponse(
    user: any,
    oldSessionId?: string,
  ): Promise<AuthResponseDto> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const refreshExpiresIn =
      this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") || "7d";
    const expiresInStr =
      this.configService.get<string>("JWT_EXPIRES_IN") || "24h";

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: expiresInStr as StringValue,
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: refreshExpiresIn as StringValue,
    });

    const sessionData = {
      userId: user.id,
      access_token: accessToken,
      refreshToken: refreshToken,
      expires: new Date(Date.now() + ms(refreshExpiresIn as StringValue)),
    };

    if (oldSessionId) {
      await this.prisma.$transaction([
        this.prisma.session.delete({ where: { id: oldSessionId } }),
        this.prisma.session.create({ data: sessionData }),
      ]);
    } else {
      await this.prisma.session.create({ data: sessionData });
    }

    return {
      access_token: accessToken,
      expires_in: ms(expiresInStr as StringValue),
      refresh_token: refreshToken,
      refresh_token_expires_in: ms(refreshExpiresIn as StringValue),
      token_type: "Bearer",
      user: {
        id: user.id,
        email: user.email,
        name: user.profile?.fullName || user.name || null,
        role: user.role,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.generateAuthResponse(user);
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        role: registerDto.role || Role.STATISTICIAN,
      },
      include: { profile: true },
    });

    return this.generateAuthResponse(user);
  }

  async validateToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch {
      return null;
    }
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const session = await this.prisma.session.findFirst({
      where: { refreshToken },
      include: {
        user: {
          include: { profile: true },
        },
      },
    });

    if (!session || !session.user || session.user.status !== "ACTIVE") {
      throw new UnauthorizedException("Invalid refresh token or inactive user");
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      // If token expired or invalid, delete session
      await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException(
        "Refresh token has expired or is invalid",
      );
    }

    if (payload.sub !== session.user.id) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return this.generateAuthResponse(session.user, session.id);
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    const session = await this.prisma.session.findFirst({
      where: { refreshToken },
    });

    if (session) {
      await this.prisma.session.delete({ where: { id: session.id } });
    }

    return { success: true };
  }

  async changePassword(
    userId: string,
    changePasswordDto: any,
  ): Promise<{ success: boolean }> {
    const { oldPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("User not found");

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid)
      throw new UnauthorizedException("Invalid old password");

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
        forcePasswordChange: false,
      },
    });

    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // We still return true to avoid leaking which emails exist
    if (!user) return { success: true };

    const token = crypto.randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hour expiry

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
    });

    await this.emailService.sendPasswordResetEmail(user.email, token);
    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { passwordResetToken: dto.token },
    });

    if (
      !user ||
      !user.passwordResetExpires ||
      user.passwordResetExpires < new Date()
    ) {
      throw new UnauthorizedException(
        "Invalid or expired password reset token",
      );
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return { success: true };
  }
}
