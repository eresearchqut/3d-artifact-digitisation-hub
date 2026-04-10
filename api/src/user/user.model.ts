import { ApiProperty } from '@nestjs/swagger';

export class User {
  @ApiProperty()
  id: string;
  @ApiProperty({ required: false })
  sub?: string;
  @ApiProperty()
  email: string;
  @ApiProperty({ required: false })
  isAdmin?: boolean;
}
