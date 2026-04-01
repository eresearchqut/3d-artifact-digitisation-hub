import { ApiProperty } from '@nestjs/swagger';

export class Organisation {
  @ApiProperty()
  id: string;
  @ApiProperty({ required: false })
  name?: string;
}
