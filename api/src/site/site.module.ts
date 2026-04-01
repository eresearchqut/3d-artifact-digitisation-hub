import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SiteService } from './site.service';
import { SiteController } from './site.controller';
import { ClientModule } from '../client/client.module';

@Module({
  imports: [ConfigModule, ClientModule],
  controllers: [SiteController],
  providers: [SiteService],
})
export class SiteModule {}
