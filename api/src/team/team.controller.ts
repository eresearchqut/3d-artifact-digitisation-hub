import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { TeamService } from './team.service';
import { Team } from './team.model';
import { User } from '../user/user.model';
import { AuthGuard, AdminGuard } from '../auth/auth.guard';
import { JwtPayload } from '../auth/auth.constants';

@ApiTags('team')
@Controller('team')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Create team' })
  @ApiResponse({ status: 201, type: Team })
  create(@Body() team: Team) {
    return this.teamService.create(team);
  }

  @Get()
  @ApiOperation({ summary: 'Get all teams' })
  @ApiResponse({ status: 200, type: [Team] })
  findAll(@Req() req: Request & { user: JwtPayload }): Promise<Team[]> {
    return this.teamService.findAll(req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get team by id' })
  @ApiResponse({ status: 200, type: Team })
  @ApiResponse({ status: 404, description: 'Team not found' })
  findOne(@Param('id') id: string) {
    return this.teamService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Update team' })
  @ApiResponse({ status: 200, type: Team })
  @ApiResponse({ status: 404, description: 'Team not found' })
  update(@Param('id') id: string, @Body() team: Team) {
    return this.teamService.update(id, team);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
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
  @UseGuards(AdminGuard)
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
  @UseGuards(AdminGuard)
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
