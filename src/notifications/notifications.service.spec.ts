import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: {
            notification: {
              create: jest.fn().mockResolvedValue({ id: 'n1', userId: 'u1', type: 'TEST', isRead: false }),
              findMany: jest.fn().mockResolvedValue([{ id: 'n1' }]),
              count: jest.fn().mockResolvedValue(1),
              findFirst: jest.fn().mockResolvedValue({ id: 'n1', userId: 'u1' }),
              update: jest.fn().mockResolvedValue({ id: 'n1', isRead: true }),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create notification', async () => {
    const res = await service.createNotification('u1', 'T', 'M', 'TEST');
    expect(res.id).toEqual('n1');
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('should get unread count', async () => {
    const res = await service.getUnreadCount('u1');
    expect(res.count).toEqual(1);
    expect(prisma.notification.count).toHaveBeenCalled();
  });

  it('should mark as read', async () => {
    const res = await service.markAsRead('u1', 'n1');
    expect(res.isRead).toEqual(true);
    expect(prisma.notification.update).toHaveBeenCalled();
  });

  it('should mark all as read', async () => {
    const res = await service.markAllAsRead('u1');
    expect(res.success).toEqual(true);
    expect(prisma.notification.updateMany).toHaveBeenCalled();
  });
});
