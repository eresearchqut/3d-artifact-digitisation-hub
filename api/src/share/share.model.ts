import { ApiProperty } from '@nestjs/swagger';

export type DurationUnit =
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year';

export class Share {
  @ApiProperty()
  id: string;
  @ApiProperty()
  assetId: string;
  @ApiProperty()
  createdAt: string;
  @ApiProperty({ required: false })
  createdBy?: string;
  @ApiProperty({ required: false, minimum: 1, maximum: 60 })
  durationValue?: number;
  @ApiProperty({
    required: false,
    enum: ['minute', 'hour', 'day', 'week', 'month', 'year'],
  })
  durationUnit?: DurationUnit;
  @ApiProperty({
    required: false,
    description: 'ISO timestamp when share expires (omitted = never)',
  })
  expiresAt?: string;
  @ApiProperty({ required: false, default: false })
  isPublic?: boolean;
}

export class ShareAccess {
  @ApiProperty({ description: 'User email or team name' })
  id: string;
  @ApiProperty({ enum: ['user', 'team'] })
  type: 'user' | 'team';
  @ApiProperty({ required: false })
  grantedAt?: string;
  @ApiProperty({ required: false })
  grantedBy?: string;
}

export class CreateShareDto {
  durationValue?: number;
  durationUnit?: DurationUnit;
  isPublic?: boolean;
}
