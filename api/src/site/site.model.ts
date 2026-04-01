import { ApiProperty } from '@nestjs/swagger';

export class Site {
  @ApiProperty()
  id: string;
  @ApiProperty({ required: false })
  name?: string;
}
