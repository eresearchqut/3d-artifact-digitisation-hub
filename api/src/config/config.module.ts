import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [ConfigController],
})
export class AppConfigModule {}
