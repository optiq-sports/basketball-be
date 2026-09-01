import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuthService } from "./auth.service";
import { LoginDto, LogOutDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { Roles } from "./decorators/roles.decorator";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { UserProfileDto } from "./dto/user-profile.dto";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Post("register")
  @ApiOperation({ summary: "Register a new admin user" })
  @ApiBody({
    type: RegisterDto,
    description:
      "Payload structure required to spin up a new platform entity profile.",
    examples: {
      default: {
        value: {
          email: "user@gmail.com",
          password: "password",
          role: "SUPER_ADMIN",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "User created successfully",
    type: AuthResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/api/auth/register",
    "Validation failed",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/auth/register",
    "Super admin token missing or invalid",
  )
  @AppErrorResponse(
    403,
    "Forbidden",
    "POST",
    "/api/auth/register",
    "Requires super admin role",
  )
  @AppErrorResponse(
    409,
    "Conflict",
    "POST",
    "/api/auth/register",
    "User with this email already exists",
  )
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post("login")
  @ApiOperation({ summary: "Login user" })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/api/auth/login",
    "Validation failed",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/auth/login",
    "Invalid credentials",
  )
  @ApiBody({
    type: LoginDto,
    description:
      "Payload structure required to spin up a new platform entity profile.",
    examples: {
      default: {
        value: {
          email: "user@gmail.com",
          password: "password",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "User logged in successfully",
    type: AuthResponseDto,
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post("refresh")
  @ApiOperation({ summary: "Refresh access token" })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/api/auth/refresh",
    "Validation failed",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/auth/refresh",
    "Invalid or expired refresh token",
  )
  @ApiBody({
    type: RefreshTokenDto,
    description: "Payload structure required to refresh the token.",
    examples: {
      default: {
        value: {
          refresh_token:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NDFkMGE4N2M1NDQ1NTQ0M2Y0MjE4ZDciLCJ1c2VybmFtZSI6ImNoYW5kcmFAZ21haWwuY29tIiwiaWF0IjoxNzExMzcyNzQxLCJleHAiOjE3MTE0NTkxNDF9.50R37545_8e-967l-R8H56W-0y9W228443W_47733334",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Token refreshed successfully",
    type: AuthResponseDto,
  })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    return this.authService.refresh(refreshTokenDto.refresh_token);
  }

  @Post("logout")
  @ApiOperation({ summary: "Logout user" })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/api/auth/logout",
    "Validation failed",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/auth/logout",
    "Invalid token",
  )
  @ApiBody({
    type: RefreshTokenDto,
    description: "Payload structure required to logout the user.",
    examples: {
      default: {
        value: {
          refresh_token:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NDFkMGE4N2M1NDQ1NTQ0M2Y0MjE4ZDciLCJ1c2VybmFtZSI6ImNoYW5kcmFAZ21haWwuY29tIiwiaWF0IjoxNzExMzcyNzQxLCJleHAiOjE3MTE0NTkxNDF9.50R37545_8e-967l-R8H56W-0y9W228443W_47733334",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "User logged out successfully",
    type: LogOutDto,
  })
  async logout(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<{ success: boolean }> {
    return this.authService.logout(refreshTokenDto.refresh_token);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get("profile")
  @ApiOperation({ summary: "Get user profile" })
  @AppErrorResponse(
    401,
    "Unauthorized",
    "GET",
    "/api/auth/profile",
    "Invalid or missing access token",
  )
  @ApiResponse({
    status: 200,
    description: "User profile fetched successfully",
    type: UserProfileDto,
  })
  getProfile(@Request() req) {
    return req.user;
  }
}
