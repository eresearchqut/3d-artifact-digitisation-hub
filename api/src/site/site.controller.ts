import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SiteService } from './site.service';
import { Site } from './site.model';
import {
  ApiPaginatedResponse,
  PaginatedResponse,
} from '../utils/pagination.model';

@ApiTags('site')
@Controller('site')
export class SiteController {
  constructor(private readonly siteService: SiteService) {}

  @Post()
  @ApiOperation({ summary: 'Create site' })
  @ApiResponse({ status: 201, type: Site })
  create(@Body() site: Site) {
    return this.siteService.create(site);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sites' })
  @ApiPaginatedResponse(Site)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  findAll(
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedResponse<Site>> {
    return this.siteService.findAll(limit ? parseInt(limit, 10) : 100, cursor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get site by id' })
  @ApiResponse({ status: 200, type: Site })
  @ApiResponse({ status: 404, description: 'Site not found' })
  findOne(@Param('id') id: string) {
    return this.siteService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update site' })
  @ApiResponse({ status: 200, type: Site })
  @ApiResponse({ status: 404, description: 'Site not found' })
  update(@Param('id') id: string, @Body() site: Site) {
    return this.siteService.update(id, site);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete site' })
  @ApiResponse({ status: 200, description: 'Site deleted' })
  @ApiResponse({ status: 404, description: 'Site not found' })
  remove(@Param('id') id: string) {
    return this.siteService.remove(id);
  }

  @Get(':id/upload')
  @ApiOperation({ summary: 'Get presigned upload URL for site' })
  @ApiQuery({ name: 'extension', required: true, type: String, description: 'File extension (e.g., .ply, .mp3)' })
  @ApiResponse({ status: 200, description: 'Presigned URL generated' })
  @ApiResponse({ status: 404, description: 'Site not found' })
  generateUploadUrl(@Param('id') id: string, @Query('extension') extension: string) {
    return this.siteService.generateUploadUrl(id, extension);
  }
}
