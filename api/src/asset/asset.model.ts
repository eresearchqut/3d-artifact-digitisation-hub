import { ApiProperty } from '@nestjs/swagger';

export class Asset {
  @ApiProperty()
  id: string;
  @ApiProperty()
  key: string;
}
