import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { assetService, organisationService } from '../services/api.service';
import { Plus, Trash2, Globe, Building2 } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable/DataTable';
import { Button, HStack, Heading, Flex, Box, Stack, Dialog } from '@chakra-ui/react';
import { NativeSelect } from '@chakra-ui/react';
import { Input } from '@chakra-ui/react';

interface Asset {
  id: string;
  key: string;
}

export const AssetListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: assets, isLoading, error } = useQuery({
    queryKey: ['assets'],
    queryFn: () => assetService.findAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assetService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });


  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const columns: Column<Asset>[] = [
    { key: 'id', header: 'ID', cellClassName: 'text-muted-foreground font-mono text-xs' },
    {
      key: 'key',
      header: 'Asset',
      cellClassName: 'font-medium text-foreground',
      render: (asset) => (
        <Link to={`/asset/${asset.id}`} className="hover:underline">
          <Flex align="center" gap={3}>
            <Box bg="colorPalette.muted" p={1.5} borderRadius="md" color="colorPalette.fg">
              <Globe className="h-4 w-4" />
            </Box>
            <span>{asset.key}</span>
          </Flex>
        </Link>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (asset) => (
        <HStack justify="flex-end">
          <Link to={`/asset/${asset.id}`}>
            <Button variant="ghost" size="sm">
              <Globe />
              View
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            colorPalette="red"
            onClick={() => handleDelete(asset.id)}
          >
            <Trash2 />
            Delete
          </Button>
        </HStack>
      ),
    },
  ];

  if (isLoading) return <Box textAlign="center" py={10} color="fg.muted">Loading assets...</Box>;
  if (error) return <Box color="red.500" textAlign="center" py={10}>Error loading assets</Box>;

  return (
    <Stack gap={6}>
      <Flex justify="space-between" align="center">
        <Heading size="2xl" color="fg">Assets</Heading>
      </Flex>


      <DataTable
        data={assets?.data}
        columns={columns}
        keyExtractor={(asset) => asset.id}
        emptyMessage="No assets found."
      />

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={!!deleteId} onOpenChange={(e: any) => !e.open && setDeleteId(null)}>
        <Dialog.Backdrop />
        {/* @ts-ignore */}
        <Dialog.Positioner>
          {/* @ts-ignore */}
          <Dialog.Content>
            <Dialog.CloseTrigger />
            <Dialog.Header>
              {/* @ts-ignore */}
              <Dialog.Title>Confirm Deletion</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              Are you sure you want to delete this asset?
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button colorPalette="red" onClick={confirmDelete}>Delete</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Stack>
  );
};
