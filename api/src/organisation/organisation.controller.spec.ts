import { Test, TestingModule } from '@nestjs/testing';
import { OrganisationController } from './organisation.controller';
import { OrganisationService } from './organisation.service';
import { Organisation } from './organisation.model';

describe('OrganisationController', () => {
  let controller: OrganisationController;
  let service: OrganisationService;

  const mockOrganisationService = {
    create: jest.fn((org: Organisation) => {
      return { id: '1', ...org };
    }),
    findAll: jest.fn((limit?: number) => {
      return {
        data: [{ id: '1', name: 'Test Org' }],
        pagination: {
          limit: limit || 100,
          has_more: false,
        },
      };
    }),
    findOne: jest.fn((id: string) => {
      return { id, name: 'Test Org' };
    }),
    update: jest.fn((id: string, org: Organisation) => {
      return { id, ...org };
    }),
    remove: jest.fn(() => {
      return;
    }),
    listUsers: jest.fn(() => {
      return {
        data: [{ id: 'u1', email: 'test@example.com' }],
        pagination: { limit: 100, has_more: false },
      };
    }),
    addUser: jest.fn(() => Promise.resolve()),
    removeUser: jest.fn(() => Promise.resolve()),
    listTeams: jest.fn(() => {
      return {
        data: [{ id: 't1', name: 'Team Alpha' }],
        pagination: { limit: 100, has_more: false },
      };
    }),
    addTeam: jest.fn(() => Promise.resolve()),
    removeTeam: jest.fn(() => Promise.resolve()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganisationController],
      providers: [
        {
          provide: OrganisationService,
          useValue: mockOrganisationService,
        },
      ],
    }).compile();

    controller = module.get<OrganisationController>(OrganisationController);
    service = module.get<OrganisationService>(OrganisationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new organisation', async () => {
      const org: Organisation = { name: 'New Org' } as any;
      expect(await controller.create(org)).toEqual({ id: '1', ...org });
      expect(service.create).toHaveBeenCalledWith(org);
    });
  });

  describe('findAll', () => {
    it('should return a paginated response of organisation', async () => {
      const expectedResponse = {
        data: [{ id: '1', name: 'Test Org' }],
        pagination: {
          limit: 100,
          has_more: false,
        },
      };
      expect(await controller.findAll()).toEqual(expectedResponse);
      expect(service.findAll).toHaveBeenCalledWith(100, undefined);
    });

    it('should pass limit and cursor to service', async () => {
      await controller.findAll('50', 'some-cursor');
      expect(service.findAll).toHaveBeenCalledWith(50, 'some-cursor');
    });
  });

  describe('findOne', () => {
    it('should return a single organisation', async () => {
      expect(await controller.findOne('1')).toEqual({
        id: '1',
        name: 'Test Org',
      });
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('update', () => {
    it('should update an organisation', async () => {
      const org: Organisation = { name: 'Updated Org' } as any;
      expect(await controller.update('1', org)).toEqual({ id: '1', ...org });
      expect(service.update).toHaveBeenCalledWith('1', org);
    });
  });

  describe('remove', () => {
    it('should remove an organisation', async () => {
      expect(await controller.remove('1')).toBeUndefined();
      expect(service.remove).toHaveBeenCalledWith('1');
    });
  });

  describe('organisation-user associations', () => {
    it('should list users', async () => {
      const result = await controller.listUsers('1');
      expect(result.data).toHaveLength(1);
      expect(service.listUsers).toHaveBeenCalledWith('1', 100, undefined);
    });

    it('should add user', async () => {
      await controller.addUser('1', 'u1');
      expect(service.addUser).toHaveBeenCalledWith('1', 'u1');
    });

    it('should remove user', async () => {
      await controller.removeUser('1', 'u1');
      expect(service.removeUser).toHaveBeenCalledWith('1', 'u1');
    });
  });

  describe('organisation-team associations', () => {
    it('should list teams', async () => {
      const result = await controller.listTeams('1');
      expect(result.data).toHaveLength(1);
      expect(service.listTeams).toHaveBeenCalledWith('1', 100, undefined);
    });

    it('should add team', async () => {
      await controller.addTeam('1', 't1');
      expect(service.addTeam).toHaveBeenCalledWith('1', 't1');
    });

    it('should remove team', async () => {
      await controller.removeTeam('1', 't1');
      expect(service.removeTeam).toHaveBeenCalledWith('1', 't1');
    });
  });
});
