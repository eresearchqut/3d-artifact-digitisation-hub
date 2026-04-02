import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AssetService } from './asset.service';
import { Asset } from './asset.model';
import {
  ApiPaginatedResponse,
  PaginatedResponse,
} from '../utils/pagination.model';

@ApiTags('asset')
@Controller('asset')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get()
  @ApiOperation({ summary: 'Get all assets' })
  @ApiPaginatedResponse(Asset)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  findAll(
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedResponse<Asset>> {
    return this.assetService.findAll(limit ? parseInt(limit, 10) : 100, cursor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset by id' })
  @ApiResponse({ status: 200, type: Asset })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  findOne(@Param('id') id: string) {
    return this.assetService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete asset' })
  @ApiResponse({ status: 200, description: 'Asset deleted' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  remove(@Param('id') id: string) {
    return this.assetService.remove(id);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Get presigned upload URL for asset' })
  @ApiQuery({
    name: 'extension',
    required: true,
    type: String,
    description: 'File extension (e.g., .ply, .spz, .splat, .sog)',
  })
  @ApiResponse({ status: 200, description: 'Presigned URL generated' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  generateUploadUrl(@Body() body?: { metadata?: Record<string, string> }) {
    return this.assetService.generateUploadUrl(body?.metadata);
  }
}
