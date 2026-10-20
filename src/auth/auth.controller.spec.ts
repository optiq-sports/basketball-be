import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { Role } from "@prisma/client";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { UserProfileDto } from "./dto/user-profile.dto";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthResponse: AuthResponseDto = {
    access_token: "mock-access-token",
    expires_in: 86400,
    token_type: "Bearer",
    refresh_token: "mock-refresh-token",
    refresh_token_expires_in: 604800,
    user: {
      id: "user-123",
      email: "admin@gmail.com",
      name: "Admin User",
      role: Role.ADMIN,
      profile: null,
      clientIds: ["cmuv056p50000c9proo4a12nu"],
      forcePasswordChange: false,
    },
  };

  const mockUserProfile: UserProfileDto = {
    id: "user-123",
    email: "admin@gmail.com",
    name: "Admin User",
    role: Role.ADMIN,
    profile: undefined,
    clientIds: ["cmuv056p50000c9proo4a12nu"],
    forcePasswordChange: false,
  };

  const mockAuthService = {
    login: jest.fn(),
    register: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    changePassword: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("login and getProfile consistency", () => {
    it("POST /auth/login and GET /auth/profile return the same user keys including forcePasswordChange and clientIds", async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const loginResult = await controller.login({
        email: "admin@gmail.com",
        password: "password123",
      });

      const profileResult = controller.getProfile({
        user: mockUserProfile,
      });

      expect(loginResult.user).toHaveProperty("forcePasswordChange", false);
      expect(loginResult.user).toHaveProperty("clientIds", [
        "cmuv056p50000c9proo4a12nu",
      ]);

      const loginUserKeys = Object.keys(loginResult.user).sort();
      const profileUserKeys = Object.keys(profileResult).sort();

      expect(loginUserKeys).toEqual(profileUserKeys);
      expect(loginUserKeys).toEqual([
        "clientIds",
        "email",
        "forcePasswordChange",
        "id",
        "name",
        "profile",
        "role",
      ]);
    });

    it("should return the profile attached to req.user on getProfile", () => {
      const result = controller.getProfile({
        user: mockUserProfile,
      });

      expect(result).toEqual(mockUserProfile);
    });
  });

  describe("httpOnly cookies for auth tokens", () => {
    it("should set access_token and refresh_token cookies on login", async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);
      const mockRes = {
        cookie: jest.fn(),
      } as any;

      const result = await controller.login(
        { email: "admin@gmail.com", password: "password123" },
        mockRes,
      );

      expect(result).toEqual(mockAuthResponse);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        "access_token",
        "mock-access-token",
        expect.objectContaining({ httpOnly: true, path: "/", sameSite: "lax" }),
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        "refresh_token",
        "mock-refresh-token",
        expect.objectContaining({
          httpOnly: true,
          path: "/api/auth",
          sameSite: "lax",
        }),
      );
    });

    it("should set access_token and refresh_token cookies on refresh", async () => {
      mockAuthService.refresh.mockResolvedValue(mockAuthResponse);
      const mockRes = { cookie: jest.fn() } as any;
      const mockReq = { headers: {} } as any;

      const result = await controller.refresh(
        { refresh_token: "existing-refresh-token" },
        mockReq,
        mockRes,
      );

      expect(result).toEqual(mockAuthResponse);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        "access_token",
        "mock-access-token",
        expect.anything(),
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        "refresh_token",
        "mock-refresh-token",
        expect.anything(),
      );
    });

    it("should read refresh token from cookie when not in body on refresh", async () => {
      mockAuthService.refresh.mockResolvedValue(mockAuthResponse);
      const mockRes = { cookie: jest.fn() } as any;
      const mockReq = {
        headers: { cookie: "refresh_token=cookie-refresh-tok" },
      } as any;

      const result = await controller.refresh({} as any, mockReq, mockRes);

      expect(mockAuthService.refresh).toHaveBeenCalledWith(
        "cookie-refresh-tok",
      );
      expect(result).toEqual(mockAuthResponse);
    });

    it("should clear access_token and refresh_token cookies on logout", async () => {
      mockAuthService.logout.mockResolvedValue({ success: true });
      const mockRes = { clearCookie: jest.fn() } as any;
      const mockReq = {
        headers: { cookie: "refresh_token=cookie-refresh-tok" },
      } as any;

      const result = await controller.logout({} as any, mockReq, mockRes);

      expect(result).toEqual({ success: true });
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        "access_token",
        expect.objectContaining({ path: "/" }),
      );
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        "refresh_token",
        expect.objectContaining({ path: "/api/auth" }),
      );
    });
  });
});
