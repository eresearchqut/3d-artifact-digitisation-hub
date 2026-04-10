import { ApiProperty } from '@nestjs/swagger';

export class AssetAccess {
  @ApiProperty({ description: 'User email or team name' })
  id: string;
  @ApiProperty({ enum: ['user', 'team'] })
  type: 'user' | 'team';
  @ApiProperty({ required: false })
  grantedAt?: string;
  @ApiProperty({ required: false })
  grantedBy?: string;
}
