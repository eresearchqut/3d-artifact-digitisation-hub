import React from 'react';
import { Table, Box } from '@chakra-ui/react';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<T> {
  data: T[] | undefined;
  columns: Column<T>[];
  emptyMessage?: string;
  keyExtractor: (row: T) => string | number;
}

export function DataTable<T>({
  data,
  columns,
  emptyMessage = 'No data found.',
  keyExtractor,
}: DataTableProps<T>) {
  return (
    <Box>
      <Table.Root>
        <Table.Header>
          <Table.Row>
            {columns.map((col, idx) => (
              <Table.ColumnHeader key={String(col.key) + idx}>
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
                  <Table.Cell key={String(col.key) + idx}>
                    {col.render ? col.render(row) : String(row[col.key as keyof T] ?? '')}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}
