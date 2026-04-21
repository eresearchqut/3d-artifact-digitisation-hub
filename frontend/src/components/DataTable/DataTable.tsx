import React from 'react';
import { Table, Box, HStack, Text, Flex } from '@chakra-ui/react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
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
  /** Enable click-to-sort on this column */
  sortable?: boolean;
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
  /** Currently active sort column key */
  sortKey?: string;
  /** Currently active sort direction */
  sortDir?: 'asc' | 'desc';
  /** Called when the user clicks a sortable column header */
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
}

export function DataTable<T>({
  data,
  columns,
  emptyMessage = 'No data found.',
  keyExtractor,
  pagination,
  sortKey,
  sortDir,
  onSort,
}: DataTableProps<T>) {
  const totalPages =
    pagination?.total !== undefined && pagination.pageSize
      ? Math.ceil(pagination.total / pagination.pageSize)
      : undefined;

  const handleHeaderClick = (col: Column<T>) => {
    if (!col.sortable || !onSort) return;
    const key = String(col.key);
    if (sortKey === key) {
      onSort(key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(key, 'asc');
    }
  };

  const SortIcon = ({ col }: { col: Column<T> }) => {
    if (!col.sortable) return null;
    const key = String(col.key);
    if (sortKey !== key) return <ArrowUpDown size={14} style={{ opacity: 0.4 }} />;
    return sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

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
                  onClick={() => handleHeaderClick(col)}
                  cursor={col.sortable ? 'pointer' : undefined}
                  userSelect={col.sortable ? 'none' : undefined}
                  _hover={col.sortable ? { bg: 'bg.subtle' } : undefined}
                >
                  {col.sortable ? (
                    <HStack gap={1} display="inline-flex">
                      <span>{col.header}</span>
                      <SortIcon col={col} />
                    </HStack>
                  ) : (
                    col.header
                  )}
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
