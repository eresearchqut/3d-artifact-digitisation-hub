import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './user.model';

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  const mockUserService = {
    create: jest.fn((user: User) => {
      return { id: '1', ...user };
    }),
    findAll: jest.fn((limit?: number) => {
      return {
        data: [{ id: '1', email: 'test@example.com' }],
        pagination: {
          limit: limit || 100,
          has_more: false,
        },
      };
    }),
    findOne: jest.fn((id: string) => {
      return { id, email: 'test@example.com' };
    }),
    update: jest.fn((id: string, user: User) => {
      return { id, ...user };
    }),
    remove: jest.fn(() => {
      return;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const user: User = { id: 'user-123', email: 'test@example.com' };
      expect(await controller.create(user)).toEqual({ id: '1', ...user });
      expect(service.create).toHaveBeenCalledWith(user);
    });
  });

  describe('findAll', () => {
    it('should return a paginated response of users', async () => {
      const expectedResponse = {
        data: [{ id: '1', email: 'test@example.com' }],
        pagination: {
          limit: 10,
          has_more: false,
        },
      };
      expect(await controller.findAll()).toEqual(expectedResponse);
      expect(service.findAll).toHaveBeenCalledWith(10, undefined);
    });

    it('should pass limit and cursor to service', async () => {
      await controller.findAll('50', 'some-cursor');
      expect(service.findAll).toHaveBeenCalledWith(50, 'some-cursor');
    });
  });

  describe('findOne', () => {
    it('should return a single user', async () => {
      expect(await controller.findOne('1')).toEqual({
        id: '1',
        email: 'test@example.com',
      });
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const user: User = { email: 'updated@example.com' } as any;
      expect(await controller.update('1', user)).toEqual({ id: '1', ...user });
      expect(service.update).toHaveBeenCalledWith('1', user);
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      expect(
        await controller.remove('1', { user: { sub: 'caller-sub' } } as any),
      ).toBeUndefined();
      expect(service.remove).toHaveBeenCalledWith('1', 'caller-sub');
    });
  });
});
