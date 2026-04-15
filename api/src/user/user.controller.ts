import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { User } from './user.model';
import { AdminGuard } from '../auth/auth.guard';

@ApiTags('user')
@Controller('user')
@UseGuards(AdminGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Create user' })
  @ApiResponse({ status: 201, type: User })
  create(@Body() user: User) {
    return this.userService.create(user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, type: [User] })
  findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  @ApiResponse({ status: 200, type: User })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, type: User })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(@Param('id') id: string, @Body() user: User) {
    return this.userService.update(id, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 403, description: 'Cannot delete your own account' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(
    @Param('id') id: string,
    @Req() req: Request & { user: { sub: string } },
  ) {
    return this.userService.remove(id, req.user.sub);
  }

  @Put(':id/admin')
  @ApiOperation({
    summary: 'Grant or revoke the administrator role for a user',
  })
  @ApiResponse({ status: 200, description: 'Admin role updated' })
  @ApiResponse({
    status: 403,
    description: 'Cannot remove your own admin role',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  setAdmin(
    @Param('id') id: string,
    @Body() body: { isAdmin: boolean },
    @Req() req: Request & { user: { sub: string } },
  ): Promise<void> {
    return this.userService.setAdmin(id, body.isAdmin, req.user.sub);
  }

  @Put(':id/password')
  @ApiOperation({ summary: 'Reset a user password (admin only)' })
  @ApiResponse({ status: 200, description: 'Password reset' })
  @ApiResponse({ status: 404, description: 'User not found' })
  resetPassword(
    @Param('id') id: string,
    @Body() body: { password: string; requireReset: boolean },
  ): Promise<void> {
    return this.userService.resetPassword(id, body.password, body.requireReset);
  }
}
