import { Test, TestingModule } from '@nestjs/testing';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';

describe('AssetController', () => {
  let controller: AssetController;
  let service: AssetService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetController],
      providers: [
        {
          provide: AssetService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            generateUploadUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AssetController>(AssetController);
    service = module.get<AssetService>(AssetService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of assets', async () => {
      const result = { data: [{ id: '1', key: 'assets/1.ply' }], pagination: { limit: 100, has_more: false, next_cursor: null } };
      jest.spyOn(service, 'findAll').mockResolvedValue(result);

      expect(await controller.findAll()).toBe(result);
    });
  });

  describe('findOne', () => {
    it('should return a single asset', async () => {
      const result = { id: '1', key: 'assets/1.ply' };
      jest.spyOn(service, 'findOne').mockResolvedValue(result);

      expect(await controller.findOne('1')).toBe(result);
    });
  });

  describe('remove', () => {
    it('should remove the asset', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue(undefined);

      expect(await controller.remove('1')).toBeUndefined();
    });
  });
  
  describe('generateUploadUrl', () => {
    it('should return an upload url', async () => {
      jest.spyOn(service, 'generateUploadUrl').mockResolvedValue({ uploadUrl: 'http://test.com', id: '1' });

      expect(await controller.generateUploadUrl({ metadata: { name: 'test.ply' } })).toEqual({ uploadUrl: 'http://test.com', id: '1' });
    });
  });
});
