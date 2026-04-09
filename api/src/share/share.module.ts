import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ShareService } from './share.service';
import { ShareController } from './share.controller';
import { ClientModule } from '../client/client.module';
import { AssetModule } from '../asset/asset.module';

@Module({
  imports: [ConfigModule, ClientModule, AssetModule],
  controllers: [ShareController],
  providers: [ShareService],
})
export class ShareModule {}
