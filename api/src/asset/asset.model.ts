import { ApiProperty } from '@nestjs/swagger';

export enum AssetStatus {
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  VIEWER_BUILDING = 'VIEWER_BUILDING',
  VIEWER_CONSTRUCTED = 'VIEWER_CONSTRUCTED',
}

export class Asset {
  @ApiProperty()
  id: string;
  @ApiProperty()
  key: string;
  @ApiProperty({ enum: AssetStatus, required: false })
  status?: AssetStatus;
  @ApiProperty({ required: false })
  uploadedBy?: string;
  @ApiProperty({ required: false })
  metadata?: Record<string, string>;
}
