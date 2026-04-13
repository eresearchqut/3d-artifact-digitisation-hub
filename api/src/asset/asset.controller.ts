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
  HttpCode,
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
import { AssetAccess } from './asset-access.model';
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
    return this.assetService.findAll(limit ? parseInt(limit, 10) : 10, cursor);
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

  // ─── User access ─────────────────────────────────────────────────────────

  @Get(':id/user')
  @ApiOperation({ summary: 'List users with access to an asset' })
  @ApiPaginatedResponse(AssetAccess)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  listUserAccess(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedResponse<AssetAccess>> {
    return this.assetService.listUserAccess(
      id,
      limit ? parseInt(limit, 10) : 10,
      cursor,
    );
  }

  @Post(':id/user/:email')
  @HttpCode(201)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Grant a user access to an asset' })
  @ApiResponse({ status: 201, description: 'Access granted' })
  addUserAccess(
    @Param('id') id: string,
    @Param('email') email: string,
    @Req() req: Request & { user: JwtPayload },
  ): Promise<void> {
    return this.assetService.addUserAccess(id, email, req.user.username);
  }

  @Delete(':id/user/:email')
  @ApiOperation({ summary: "Revoke a user's access to an asset" })
  @ApiResponse({ status: 200, description: 'Access revoked' })
  removeUserAccess(
    @Param('id') id: string,
    @Param('email') email: string,
  ): Promise<void> {
    return this.assetService.removeUserAccess(id, email);
  }

  // ─── Team access ─────────────────────────────────────────────────────────

  @Get(':id/team')
  @ApiOperation({ summary: 'List teams with access to an asset' })
  @ApiPaginatedResponse(AssetAccess)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  listTeamAccess(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedResponse<AssetAccess>> {
    return this.assetService.listTeamAccess(
      id,
      limit ? parseInt(limit, 10) : 10,
      cursor,
    );
  }

  @Post(':id/team/:teamName')
  @HttpCode(201)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Grant a team access to an asset' })
  @ApiResponse({ status: 201, description: 'Access granted' })
  addTeamAccess(
    @Param('id') id: string,
    @Param('teamName') teamName: string,
    @Req() req: Request & { user: JwtPayload },
  ): Promise<void> {
    return this.assetService.addTeamAccess(id, teamName, req.user.username);
  }

  @Delete(':id/team/:teamName')
  @ApiOperation({ summary: "Revoke a team's access to an asset" })
  @ApiResponse({ status: 200, description: 'Access revoked' })
  removeTeamAccess(
    @Param('id') id: string,
    @Param('teamName') teamName: string,
  ): Promise<void> {
    return this.assetService.removeTeamAccess(id, teamName);
  }
}
