import { ApiProperty } from '@nestjs/swagger';

export class Share {
  @ApiProperty()
  id: string;
  @ApiProperty()
  assetId: string;
  @ApiProperty()
  createdAt: string;
  @ApiProperty({ required: false })
  createdBy?: string;
  @ApiProperty({
    required: false,
    description: 'Cron expression describing expiry schedule',
  })
  duration?: string;
  @ApiProperty({
    required: false,
    description: 'ISO timestamp when share expires (null = never)',
  })
  expiresAt?: string;
}

export class ShareAccess {
  @ApiProperty({ description: 'User email or team name' })
  id: string;
  @ApiProperty({ enum: ['user', 'team'] })
  type: 'user' | 'team';
  @ApiProperty({ required: false })
  grantedAt?: string;
}

export class CreateShareDto {
  duration?: string;
  expiresAt?: string;
}
