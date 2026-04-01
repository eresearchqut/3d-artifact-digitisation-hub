import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrganisationModule } from './organisation/organisation.module';
import { TeamModule } from './team/team.module';
import { UserModule } from './user/user.module';
import { SiteModule } from './site/site.module';
import { ClientModule } from './client/client.module';
import { AppConfigModule } from './config/config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ClientModule,
    OrganisationModule,
    TeamModule,
    UserModule,
    SiteModule,
    AppConfigModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
