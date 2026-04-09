import type { Response } from 'express';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AssetService } from './asset.service';
import { Asset } from './asset.model';
import {
  ApiPaginatedResponse,
  PaginatedResponse,
} from '../utils/pagination.model';
import { AuthGuard } from '../auth/auth.guard';
import { JwtPayload } from '../auth/auth.constants';
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
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get presigned upload URL for asset' })
  @ApiQuery({
    name: 'extension',
    required: true,
    type: String,
    description: 'File extension (e.g., .ply, .spz, .splat, .sog)',
  })
  @ApiResponse({ status: 200, description: 'Presigned URL generated' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  generateUploadUrl(
    @Req() req: Request & { user: JwtPayload },
    @Body() body?: { metadata?: Record<string, string> },
  ) {
    return this.assetService.generateUploadUrl(
      req.user.username,
      body?.metadata,
    );
  }

  @Get(':id/viewer/:file')
  @ApiOperation({ summary: 'Proxy a viewer file for an asset' })
  @ApiParam({ name: 'id', description: 'Asset ID' })
  @ApiParam({
    name: 'file',
    description: 'Viewer filename',
    enum: ['index.html', 'index.css', 'index.js', 'index.sog', 'settings.json'],
  })
  @ApiResponse({
    status: 200,
    description: 'Viewer file content (index.html streamed directly)',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to presigned S3 URL (all other files)',
  })
  @ApiResponse({ status: 400, description: 'Invalid filename' })
  @ApiResponse({ status: 404, description: 'Viewer file not found' })
  async getViewerFile(
    @Param('id') id: string,
    @Param('file') file: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | undefined> {
    const result = await this.assetService.getViewerFile(id, file);
    if (result.type === 'redirect') {
      res.redirect(302, result.url);
      return;
    }
    res.set({ 'Content-Type': result.contentType });
    return result.file;
  }
}
