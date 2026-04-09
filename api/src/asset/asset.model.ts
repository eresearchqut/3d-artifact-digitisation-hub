import { ApiProperty } from '@nestjs/swagger';

export class Asset {
  @ApiProperty()
  id: string;
  @ApiProperty()
  key: string;
  @ApiProperty({ required: false })
  uploadedBy?: string;
  @ApiProperty({ required: false })
  metadata?: Record<string, string>;
}
