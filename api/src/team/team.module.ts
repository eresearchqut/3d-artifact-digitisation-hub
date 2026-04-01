import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { ClientModule } from '../client/client.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [ConfigModule, ClientModule, UserModule],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
