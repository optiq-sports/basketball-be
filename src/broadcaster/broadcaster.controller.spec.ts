import { Test, TestingModule } from "@nestjs/testing";
import { BroadcasterController } from "./broadcaster.controller";
import { BroadcasterService } from "./broadcaster.service";
import { UPLOAD_PROVIDER } from "../upload/upload.constants";
import { Role, UserStatus } from "@prisma/client";
import { AuthenticatedUser } from "../common/interfaces/user.interface";

describe("BroadcasterController", () => {
  let controller: BroadcasterController;
  let service: BroadcasterService;

  const mockBroadcasterService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updatePhoto: jest.fn(),
    remove: jest.fn(),
  };

  const mockUploadProvider = {
    uploadFile: jest
      .fn()
      .mockResolvedValue({ url: "https://cdn.example.com/photo.jpg" }),
  };

  const mockUser: AuthenticatedUser = {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin User",
    role: Role.ADMIN,
    clientIds: ["client-1"],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BroadcasterController],
      providers: [
        { provide: BroadcasterService, useValue: mockBroadcasterService },
        { provide: UPLOAD_PROVIDER, useValue: mockUploadProvider },
      ],
    }).compile();

    controller = module.get<BroadcasterController>(BroadcasterController);
    service = module.get<BroadcasterService>(BroadcasterService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("create", () => {
    it("should call broadcasterService.create", async () => {
      const dto = { email: "b@example.com", name: "One Sport" };
      mockBroadcasterService.create.mockResolvedValueOnce({
        id: "b-1",
        ...dto,
        role: Role.BROADCASTER,
        emailSent: true,
      });

      const result = await controller.create(dto, mockUser);
      expect(service.create).toHaveBeenCalledWith(dto, mockUser);
      expect(result.id).toBe("b-1");
    });
  });

  describe("findAll", () => {
    it("should call broadcasterService.findAll", async () => {
      mockBroadcasterService.findAll.mockResolvedValueOnce({
        data: [],
        meta: { page: 1, limit: 10, itemCount: 0 },
      });

      const result = await controller.findAll({}, mockUser);
      expect(service.findAll).toHaveBeenCalledWith({}, mockUser);
      expect(result.data).toEqual([]);
    });
  });

  describe("findOne", () => {
    it("should call broadcasterService.findOne", async () => {
      mockBroadcasterService.findOne.mockResolvedValueOnce({
        id: "b-1",
        email: "b@example.com",
      });

      const result = await controller.findOne("b-1", mockUser);
      expect(service.findOne).toHaveBeenCalledWith("b-1", mockUser);
      expect(result.id).toBe("b-1");
    });
  });

  describe("update", () => {
    it("should call broadcasterService.update", async () => {
      const dto = { name: "Updated Broadcaster" };
      mockBroadcasterService.update.mockResolvedValueOnce({
        id: "b-1",
        name: "Updated Broadcaster",
      });

      const result = await controller.update("b-1", dto, mockUser);
      expect(service.update).toHaveBeenCalledWith("b-1", dto, mockUser);
      expect(result.name).toBe("Updated Broadcaster");
    });
  });

  describe("uploadPhoto", () => {
    it("should upload file and call broadcasterService.updatePhoto", async () => {
      const file = {
        buffer: Buffer.from("test"),
        originalname: "photo.jpg",
        mimetype: "image/jpeg",
      } as Express.Multer.File;

      mockBroadcasterService.updatePhoto.mockResolvedValueOnce({
        id: "b-1",
        profile: { photos: ["https://cdn.example.com/photo.jpg"] },
      });

      const result = await controller.uploadPhoto("b-1", file, mockUser);
      expect(mockUploadProvider.uploadFile).toHaveBeenCalledWith(file);
      expect(service.updatePhoto).toHaveBeenCalledWith(
        "b-1",
        "https://cdn.example.com/photo.jpg",
        mockUser,
      );
      expect(result.id).toBe("b-1");
    });
  });

  describe("remove", () => {
    it("should call broadcasterService.remove", async () => {
      mockBroadcasterService.remove.mockResolvedValueOnce({
        id: "b-1",
        status: UserStatus.INACTIVE,
      });

      const result = await controller.remove("b-1", mockUser);
      expect(service.remove).toHaveBeenCalledWith("b-1", mockUser);
      expect(result.status).toBe(UserStatus.INACTIVE);
    });
  });
});
