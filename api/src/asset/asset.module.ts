import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssetService } from './asset.service';
import { AssetController } from './asset.controller';
import { ClientModule } from '../client/client.module';

@Module({
  imports: [ConfigModule, ClientModule],
  controllers: [AssetController],
  providers: [AssetService],
})
export class AssetModule {}
