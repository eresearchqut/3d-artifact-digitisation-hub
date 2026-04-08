import { Test, TestingModule } from '@nestjs/testing';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';
import { StreamableFile } from '@nestjs/common';
import { Response } from 'express';

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
            getViewerFile: jest.fn(),
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
      const result = {
        data: [{ id: '1', key: 'assets/1.ply' }],
        pagination: { limit: 100, has_more: false, next_cursor: null },
      };
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
      jest
        .spyOn(service, 'generateUploadUrl')
        .mockResolvedValue({ uploadUrl: 'http://test.com', id: '1' });

      expect(
        await controller.generateUploadUrl({ metadata: { name: 'test.ply' } }),
      ).toEqual({ uploadUrl: 'http://test.com', id: '1' });
    });
  });

  describe('getViewerFile', () => {
    it('should stream index.html directly', async () => {
      const mockStream = new StreamableFile(
        Uint8Array.from(Buffer.from('<html/>')),
      );
      jest.spyOn(service, 'getViewerFile').mockResolvedValue({
        type: 'stream',
        file: mockStream,
        contentType: 'text/html',
      });
      const mockRes = {
        set: jest.fn(),
        redirect: jest.fn(),
      } as unknown as Response;

      const result = await controller.getViewerFile('1', 'index.html', mockRes);

      expect(service.getViewerFile).toHaveBeenCalledWith('1', 'index.html');
      expect(mockRes.set).toHaveBeenCalledWith({ 'Content-Type': 'text/html' });
      expect(result).toBe(mockStream);
    });

    it('should redirect non-html viewer files to presigned URL', async () => {
      jest.spyOn(service, 'getViewerFile').mockResolvedValue({
        type: 'redirect',
        url: 'https://s3.amazonaws.com/presigned',
      });
      const mockRes = {
        set: jest.fn(),
        redirect: jest.fn(),
      } as unknown as Response;

      const result = await controller.getViewerFile('1', 'index.sog', mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        302,
        'https://s3.amazonaws.com/presigned',
      );
      expect(result).toBeUndefined();
    });
  });
});
