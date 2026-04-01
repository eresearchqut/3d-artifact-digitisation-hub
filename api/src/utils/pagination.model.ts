import {
  ApiProperty,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { applyDecorators, Type } from '@nestjs/common';

export class Pagination {
  @ApiProperty()
  limit: number;
  @ApiProperty()
  has_more: boolean;
  @ApiProperty({ required: false })
  next_cursor?: string;
  @ApiProperty({ required: false })
  prev_cursor?: string;
}

export class PaginatedResponse<T> {
  data: T[];
  @ApiProperty()
  pagination: Pagination;
}

export const ApiPaginatedResponse = <TModel extends Type<any>>(
  model: TModel,
) => {
  return applyDecorators(
    ApiExtraModels(PaginatedResponse, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponse) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
            },
          },
        ],
      },
    }),
  );
};
