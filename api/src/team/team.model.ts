import { ApiProperty } from '@nestjs/swagger';

export class Team {
  @ApiProperty({ required: true })
  name: string;

  @ApiProperty({ required: false })
  description?: string;
}
