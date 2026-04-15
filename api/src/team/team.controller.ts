import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TeamService } from './team.service';
import { Team } from './team.model';
import { User } from '../user/user.model';
import { AdminGuard } from '../auth/auth.guard';

@ApiTags('team')
@Controller('team')
@UseGuards(AdminGuard)
@ApiBearerAuth()
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  @ApiOperation({ summary: 'Create team' })
  @ApiResponse({ status: 201, type: Team })
  create(@Body() team: Team) {
    return this.teamService.create(team);
  }

  @Get()
  @ApiOperation({ summary: 'Get all teams' })
  @ApiResponse({ status: 200, type: [Team] })
  findAll(): Promise<Team[]> {
    return this.teamService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get team by id' })
  @ApiResponse({ status: 200, type: Team })
  @ApiResponse({ status: 404, description: 'Team not found' })
  findOne(@Param('id') id: string) {
    return this.teamService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update team' })
  @ApiResponse({ status: 200, type: Team })
  @ApiResponse({ status: 404, description: 'Team not found' })
  update(@Param('id') id: string, @Body() team: Team) {
    return this.teamService.update(id, team);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete team' })
  @ApiResponse({ status: 200, description: 'Team deleted' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  remove(@Param('id') id: string): Promise<void> {
    return this.teamService.remove(id);
  }

  @Get(':id/user')
  @ApiOperation({ summary: 'List users in team' })
  @ApiResponse({ status: 200, type: [User] })
  listUsers(@Param('id') id: string): Promise<User[]> {
    return this.teamService.listUsers(id);
  }

  @Post(':id/user/:userId')
  @ApiOperation({ summary: 'Add user to team' })
  @ApiResponse({ status: 201, description: 'User added to team' })
  @ApiResponse({ status: 404, description: 'Team or user not found' })
  addUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.teamService.addUser(id, userId);
  }

  @Delete(':id/user/:userId')
  @ApiOperation({ summary: 'Remove user from team' })
  @ApiResponse({ status: 200, description: 'User removed from team' })
  @ApiResponse({ status: 404, description: 'Team or user not found' })
  removeUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.teamService.removeUser(id, userId);
  }
}
