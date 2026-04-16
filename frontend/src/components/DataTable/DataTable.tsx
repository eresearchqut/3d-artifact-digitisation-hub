import React from 'react';
import { Table, Box, HStack, Text, Flex } from '@chakra-ui/react';
import { Button } from '../Button/Button';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  textAlign?: 'left' | 'right' | 'center';
  cellStyle?: React.CSSProperties;
  headerStyle?: React.CSSProperties;
  /** Hide this column on screens narrower than this breakpoint */
  hideBelow?: 'sm' | 'md' | 'lg';
}

export interface DataTablePaginationProps {
  hasPrev: boolean;
  hasMore: boolean;
  onPrev: () => void;
  onNext: () => void;
  count: number;
  total?: number;
  pageNumber?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  isLoading?: boolean;
}

export interface DataTableProps<T> {
  data: T[] | undefined;
  columns: Column<T>[];
  emptyMessage?: string;
  keyExtractor: (row: T) => string | number;
  pagination?: DataTablePaginationProps;
}

export function DataTable<T>({
  data,
  columns,
  emptyMessage = 'No data found.',
  keyExtractor,
  pagination,
}: DataTableProps<T>) {
  const totalPages =
    pagination?.total !== undefined && pagination.pageSize
      ? Math.ceil(pagination.total / pagination.pageSize)
      : undefined;

  return (
    <Box>
      <Box overflowX="auto">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              {columns.map((col, idx) => (
                <Table.ColumnHeader
                  key={String(col.key) + idx}
                  textAlign={col.textAlign}
                  style={col.headerStyle}
                  display={col.hideBelow ? { base: 'none', [col.hideBelow]: 'table-cell' } : undefined}
                >
                  {col.header}
                </Table.ColumnHeader>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(!data || data.length === 0) ? (
              <Table.Row>
                <Table.Cell colSpan={columns.length}>
                  {emptyMessage}
                </Table.Cell>
              </Table.Row>
            ) : (
              data.map((row) => (
                <Table.Row key={keyExtractor(row)}>
                  {columns.map((col, idx) => (
                    <Table.Cell
                      key={String(col.key) + idx}
                      textAlign={col.textAlign}
                      style={col.cellStyle}
                      display={col.hideBelow ? { base: 'none', [col.hideBelow]: 'table-cell' } : undefined}
                    >
                      {col.render ? col.render(row) : String(row[col.key as keyof T] ?? '')}
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table.Root>
      </Box>

      {pagination && (
        <Flex justify="space-between" align="center" mt={4} px={1} flexWrap="wrap" gap={2}>
          <HStack gap={3}>
            {pagination.total !== undefined && (
              <Text fontSize="sm" color="fg.muted">
                {pagination.total} total
              </Text>
            )}
            {pagination.pageNumber !== undefined && totalPages !== undefined && (
              <Text fontSize="sm" color="fg.muted">
                Page {pagination.pageNumber} of {totalPages || 1}
              </Text>
            )}
          </HStack>

          <HStack gap={2}>
            {pagination.pageSizeOptions && pagination.onPageSizeChange && (
              <select
                value={pagination.pageSize}
                onChange={(e) => pagination.onPageSizeChange!(Number(e.target.value))}
                style={{
                  fontSize: '0.875rem',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--chakra-colors-border)',
                  background: 'var(--chakra-colors-bg)',
                  color: 'var(--chakra-colors-fg)',
                  cursor: 'pointer',
                }}
              >
                {pagination.pageSizeOptions.map((size) => (
                  <option key={size} value={size}>{size} per page</option>
                ))}
              </select>
            )}
            <Button
              variant="outline"
              onClick={pagination.onPrev}
              disabled={!pagination.hasPrev || pagination.isLoading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={pagination.onNext}
              disabled={!pagination.hasMore || pagination.isLoading}
            >
              Next
            </Button>
          </HStack>
        </Flex>
      )}
    </Box>
  );
}
