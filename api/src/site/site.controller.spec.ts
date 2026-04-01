import { Test, TestingModule } from '@nestjs/testing';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';
import { Site } from './site.model';

describe('SiteController', () => {
  let controller: SiteController;
  let service: SiteService;

  const mockSiteService = {
    create: jest.fn((site: Site) => {
      return { id: '1', ...site };
    }),
    findAll: jest.fn((limit?: number) => {
      return {
        data: [{ id: '1', name: 'Test Site' }],
        pagination: {
          limit: limit || 100,
          has_more: false,
        },
      };
    }),
    findOne: jest.fn((id: string) => {
      return { id, name: 'Test Site' };
    }),
    update: jest.fn((id: string, site: Site) => {
      return { id, ...site };
    }),
    remove: jest.fn(() => {
      return;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SiteController],
      providers: [
        {
          provide: SiteService,
          useValue: mockSiteService,
        },
      ],
    }).compile();

    controller = module.get<SiteController>(SiteController);
    service = module.get<SiteService>(SiteService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new site', async () => {
      const site: Site = {
        name: 'New Site',
        clientId: 'client-123',
        organisationId: 'organisation-123',
      } as any;
      expect(await controller.create(site)).toEqual({ id: '1', ...site });
      expect(service.create).toHaveBeenCalledWith(site);
    });
  });

  describe('findAll', () => {
    it('should return a paginated response of site', async () => {
      const expectedResponse = {
        data: [{ id: '1', name: 'Test Site' }],
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
    it('should return a single site', async () => {
      expect(await controller.findOne('1')).toEqual({
        id: '1',
        name: 'Test Site',
      });
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('update', () => {
    it('should update a site', async () => {
      const site: Site = {
        name: 'Updated Site',
        clientId: 'client-456',
        organisationId: 'organisation-123',
      } as any;
      expect(await controller.update('1', site)).toEqual({ id: '1', ...site });
      expect(service.update).toHaveBeenCalledWith('1', site);
    });
  });

  describe('remove', () => {
    it('should remove a site', async () => {
      expect(await controller.remove('1')).toBeUndefined();
      expect(service.remove).toHaveBeenCalledWith('1');
    });
  });
});
