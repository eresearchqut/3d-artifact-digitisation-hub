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
import { OrganisationService } from './organisation.service';
import { Organisation } from './organisation.model';
import { User } from '../user/user.model';
import { Team } from '../team/team.model';
import {
  ApiPaginatedResponse,
  PaginatedResponse,
} from '../utils/pagination.model';

@ApiTags('organisation')
@Controller('organisation')
export class OrganisationController {
  constructor(private readonly organisationService: OrganisationService) {}

  @Post()
  @ApiOperation({ summary: 'Create organisation' })
  @ApiResponse({ status: 201, type: Organisation })
  create(@Body() organisation: Organisation) {
    return this.organisationService.create(organisation);
  }

  @Get()
  @ApiOperation({ summary: 'Get all organisations' })
  @ApiPaginatedResponse(Organisation)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  findAll(
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedResponse<Organisation>> {
    return this.organisationService.findAll(
      limit ? parseInt(limit, 10) : 100,
      cursor,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organisation by id' })
  @ApiResponse({ status: 200, type: Organisation })
  @ApiResponse({ status: 404, description: 'Organisation not found' })
  findOne(@Param('id') id: string) {
    return this.organisationService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update organisation' })
  @ApiResponse({ status: 200, type: Organisation })
  @ApiResponse({ status: 404, description: 'Organisation not found' })
  update(@Param('id') id: string, @Body() organisation: Organisation) {
    return this.organisationService.update(id, organisation);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete organisation' })
  @ApiResponse({ status: 200, description: 'Organisation deleted' })
  @ApiResponse({ status: 404, description: 'Organisation not found' })
  remove(@Param('id') id: string): Promise<void> {
    return this.organisationService.remove(id);
  }

  @Get(':id/user')
  @ApiOperation({ summary: 'List users in organisation' })
  @ApiPaginatedResponse(User)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  listUsers(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedResponse<User>> {
    return this.organisationService.listUsers(
      id,
      limit ? parseInt(limit, 10) : 100,
      cursor,
    );
  }

  @Post(':id/user/:userId')
  @ApiOperation({ summary: 'Add user to organisation' })
  @ApiResponse({ status: 201, description: 'User added to organisation' })
  @ApiResponse({ status: 404, description: 'Organisation or user not found' })
  addUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.organisationService.addUser(id, userId);
  }

  @Delete(':id/user/:userId')
  @ApiOperation({ summary: 'Remove user from organisation' })
  @ApiResponse({ status: 200, description: 'User removed from organisation' })
  @ApiResponse({ status: 404, description: 'Organisation or user not found' })
  removeUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.organisationService.removeUser(id, userId);
  }

  @Get(':id/team')
  @ApiOperation({ summary: 'List teams in organisation' })
  @ApiPaginatedResponse(Team)
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  listTeams(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedResponse<Team>> {
    return this.organisationService.listTeams(
      id,
      limit ? parseInt(limit, 10) : 100,
      cursor,
    );
  }

  @Post(':id/team/:teamId')
  @ApiOperation({ summary: 'Add team to organisation' })
  @ApiResponse({ status: 201, description: 'Team added to organisation' })
  @ApiResponse({ status: 404, description: 'Organisation or team not found' })
  addTeam(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
  ): Promise<void> {
    return this.organisationService.addTeam(id, teamId);
  }

  @Delete(':id/team/:teamId')
  @ApiOperation({ summary: 'Remove team from organisation' })
  @ApiResponse({ status: 200, description: 'Team removed from organisation' })
  @ApiResponse({ status: 404, description: 'Organisation or team not found' })
  removeTeam(
    @Param('id') id: string,
    @Param('teamId') teamId: string,
  ): Promise<void> {
    return this.organisationService.removeTeam(id, teamId);
  }
}
