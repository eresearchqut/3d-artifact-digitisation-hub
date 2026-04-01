import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrganisationService } from './organisation.service';
import { OrganisationController } from './organisation.controller';
import { ClientModule } from '../client/client.module';
import { UserModule } from '../user/user.module';
import { TeamModule } from '../team/team.module';

@Module({
  imports: [ConfigModule, ClientModule, UserModule, TeamModule],
  controllers: [OrganisationController],
  providers: [OrganisationService],
  exports: [OrganisationService],
})
export class OrganisationModule {}
