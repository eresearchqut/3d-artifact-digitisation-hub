import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  Req,
  UseGuards,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import type { Response } from 'express';
import { ShareService } from './share.service';
import { Share, ShareAccess, CreateShareDto } from './share.model';
import {
  ApiPaginatedResponse,
  PaginatedResponse,
} from '../utils/pagination.model';
import { AuthGuard, OptionalAuthGuard } from '../auth/auth.guard';
import { JwtPayload } from '../auth/auth.constants';

@ApiTags('share')
@Controller('asset/:assetId/share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a share for an asset' })
  @ApiResponse({ status: 201, type: Share })
  create(
    @Param('assetId') assetId: string,
    @Body() dto: CreateShareDto,
    @Req() req: Request & { user: JwtPayload },
  ): Promise<Share> {
    return this.shareService.create(assetId, dto, req.user.username);
  }

  @Get()
  @ApiOperation({ summary: 'List shares for an asset' })
  @ApiPaginatedResponse(Share)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  findAll(
    @Param('assetId') assetId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedResponse<Share>> {
    return this.shareService.findAll(
      assetId,
      limit ? parseInt(limit, 10) : 100,
      cursor,
    );
  }

  @Get(':shareId')
  @ApiOperation({ summary: 'Get a share by ID' })
  @ApiResponse({ status: 200, type: Share })
  @ApiResponse({ status: 404, description: 'Share not found' })
  findOne(
    @Param('assetId') assetId: string,
    @Param('shareId') shareId: string,
  ): Promise<Share> {
    return this.shareService.findOne(assetId, shareId);
  }

  @Delete(':shareId')
  @ApiOperation({ summary: 'Revoke a share' })
  @ApiResponse({ status: 200, description: 'Share revoked' })
  remove(
    @Param('assetId') assetId: string,
    @Param('shareId') shareId: string,
  ): Promise<void> {
    return this.shareService.remove(assetId, shareId);
  }

  // ─── Share user access ───────────────────────────────────────────────────

  @Get(':shareId/user')
  @ApiOperation({ summary: 'List users with access to a share' })
  @ApiPaginatedResponse(ShareAccess)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  listShareUserAccess(
    @Param('assetId') assetId: string,
    @Param('shareId') shareId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedResponse<ShareAccess>> {
    return this.shareService.listShareUserAccess(
      assetId,
      shareId,
      limit ? parseInt(limit, 10) : 100,
      cursor,
    );
  }

  @Post(':shareId/user/:email')
  @HttpCode(201)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Grant a user access to a share' })
  @ApiResponse({ status: 201, description: 'Access granted' })
  addShareUserAccess(
    @Param('assetId') assetId: string,
    @Param('shareId') shareId: string,
    @Param('email') email: string,
    @Req() req: Request & { user: JwtPayload },
  ): Promise<void> {
    return this.shareService.addShareUserAccess(
      assetId,
      shareId,
      email,
      req.user.username,
    );
  }

  @Delete(':shareId/user/:email')
  @ApiOperation({ summary: "Revoke a user's access to a share" })
  @ApiResponse({ status: 200, description: 'Access revoked' })
  removeShareUserAccess(
    @Param('assetId') assetId: string,
    @Param('shareId') shareId: string,
    @Param('email') email: string,
  ): Promise<void> {
    return this.shareService.removeShareUserAccess(assetId, shareId, email);
  }

  // ─── Share team access ───────────────────────────────────────────────────

  @Get(':shareId/team')
  @ApiOperation({ summary: 'List teams with access to a share' })
  @ApiPaginatedResponse(ShareAccess)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  listShareTeamAccess(
    @Param('assetId') assetId: string,
    @Param('shareId') shareId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedResponse<ShareAccess>> {
    return this.shareService.listShareTeamAccess(
      assetId,
      shareId,
      limit ? parseInt(limit, 10) : 100,
      cursor,
    );
  }

  @Post(':shareId/team/:teamName')
  @HttpCode(201)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Grant a team access to a share' })
  @ApiResponse({ status: 201, description: 'Access granted' })
  addShareTeamAccess(
    @Param('assetId') assetId: string,
    @Param('shareId') shareId: string,
    @Param('teamName') teamName: string,
    @Req() req: Request & { user: JwtPayload },
  ): Promise<void> {
    return this.shareService.addShareTeamAccess(
      assetId,
      shareId,
      teamName,
      req.user.username,
    );
  }

  @Delete(':shareId/team/:teamName')
  @ApiOperation({ summary: "Revoke a team's access to a share" })
  @ApiResponse({ status: 200, description: 'Access revoked' })
  removeShareTeamAccess(
    @Param('assetId') assetId: string,
    @Param('shareId') shareId: string,
    @Param('teamName') teamName: string,
  ): Promise<void> {
    return this.shareService.removeShareTeamAccess(assetId, shareId, teamName);
  }
}

@ApiTags('share')
@Controller('share')
export class ShareViewerController {
  constructor(private readonly shareService: ShareService) {}

  @Get(':shareId/:file')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Access a viewer file via a share link' })
  @ApiParam({ name: 'shareId', description: 'Share UUID' })
  @ApiParam({
    name: 'file',
    description: 'Viewer filename',
    enum: ['index.html', 'index.css', 'index.js', 'index.sog', 'settings.json'],
  })
  @ApiResponse({
    status: 200,
    description: 'Viewer file (index.html streamed directly)',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to presigned S3 URL (all other files)',
  })
  @ApiResponse({ status: 403, description: 'Share expired or access denied' })
  @ApiResponse({ status: 404, description: 'Share or file not found' })
  async getViewerFile(
    @Param('shareId') shareId: string,
    @Param('file') file: string,
    @Req() req: Request & { user?: JwtPayload },
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | undefined> {
    const result = await this.shareService.getShareViewerFile(
      shareId,
      file,
      req.user?.username,
    );
    if (result.type === 'redirect') {
      res.redirect(302, result.url);
      return;
    }
    res.set({ 'Content-Type': result.contentType });
    return result.file;
  }
}
