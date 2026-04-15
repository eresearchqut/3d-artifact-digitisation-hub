import { Test, TestingModule } from '@nestjs/testing';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { Team } from './team.model';

describe('TeamController', () => {
  let controller: TeamController;
  let service: TeamService;

  const mockTeamService = {
    create: jest.fn((team: Team) => {
      return { id: '1', ...team };
    }),
    findAll: jest.fn(() => {
      return [{ id: '1', name: 'Test Team' }];
    }),
    findOne: jest.fn((id: string) => {
      return { id, name: 'Test Team' };
    }),
    update: jest.fn((id: string, team: Team) => {
      return { id, ...team };
    }),
    remove: jest.fn(() => {
      return;
    }),
    addUser: jest.fn(() => {
      return;
    }),
    removeUser: jest.fn(() => {
      return;
    }),
    listUsers: jest.fn(() => {
      return [{ id: 'user-1', email: 'user1@example.com' }];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamController],
      providers: [
        {
          provide: TeamService,
          useValue: mockTeamService,
        },
      ],
    }).compile();

    controller = module.get<TeamController>(TeamController);
    service = module.get<TeamService>(TeamService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new team', async () => {
      const team: Team = {
        id: 'team-1',
        name: 'New Team',
        groupId: 'team-1',
      } as any;
      expect(await controller.create(team)).toEqual({ id: '1', ...team });
      expect(service.create).toHaveBeenCalledWith(team);
    });
  });

  describe('findAll', () => {
    it('should return an array of teams', async () => {
      const expectedResponse = [{ id: '1', name: 'Test Team' }];
      const mockReq = {
        user: {
          username: 'a@b.com',
          isAdmin: true,
          groups: ['administrators'],
          sub: 'sub1',
        },
      } as any;
      expect(await controller.findAll(mockReq)).toEqual(expectedResponse);
      expect(service.findAll).toHaveBeenCalledWith(mockReq.user);
    });
  });

  describe('findOne', () => {
    it('should return a single team', async () => {
      expect(await controller.findOne('1')).toEqual({
        id: '1',
        name: 'Test Team',
      });
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('update', () => {
    it('should update a team', async () => {
      const team: Team = { name: 'Updated Team' } as any;
      expect(await controller.update('1', team)).toEqual({ id: '1', ...team });
      expect(service.update).toHaveBeenCalledWith('1', team);
    });
  });

  describe('remove', () => {
    it('should remove a team', async () => {
      expect(await controller.remove('1')).toBeUndefined();
      expect(service.remove).toHaveBeenCalledWith('1');
    });
  });

  describe('addUser', () => {
    it('should add a user to a team', async () => {
      expect(await controller.addUser('team-1', 'user-1')).toBeUndefined();
      expect(service.addUser).toHaveBeenCalledWith('team-1', 'user-1');
    });
  });

  describe('removeUser', () => {
    it('should remove a user from a team', async () => {
      expect(await controller.removeUser('team-1', 'user-1')).toBeUndefined();
      expect(service.removeUser).toHaveBeenCalledWith('team-1', 'user-1');
    });
  });

  describe('listUsers', () => {
    it('should return an array of users in a team', async () => {
      const expectedResponse = [{ id: 'user-1', email: 'user1@example.com' }];
      expect(await controller.listUsers('team-1')).toEqual(expectedResponse);
      expect(service.listUsers).toHaveBeenCalledWith('team-1');
    });
  });
});
