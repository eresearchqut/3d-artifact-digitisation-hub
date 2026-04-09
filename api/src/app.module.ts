import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TeamModule } from './team/team.module';
import { UserModule } from './user/user.module';
import { AssetModule } from './asset/asset.module';
import { ClientModule } from './client/client.module';
import { AppConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ClientModule,
    TeamModule,
    UserModule,
    AssetModule,
    AppConfigModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
