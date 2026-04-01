import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organisationService } from '../services/api.service';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataTable, Column } from '../components/DataTable/DataTable';
import { Button, HStack, Heading, Flex, Box, Stack, Dialog, Input } from '@chakra-ui/react';

interface Organisation {
  id: string;
  name?: string;
}

export const OrganisationListPage: React.FC = () => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');

  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => organisationService.findAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => organisationService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisations'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => organisationService.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisations'] });
    },
  });

  const handleCreate = () => {
    setIsCreateOpen(true);
  };

  const submitCreate = () => {
    if (createName) {
      createMutation.mutate(createName);
      setIsCreateOpen(false);
      setCreateName('');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const columns: Column<Organisation>[] = [
    { key: 'id', header: 'ID', cellClassName: 'text-muted-foreground font-mono' },
    { key: 'name', header: 'Name', cellClassName: 'font-medium text-foreground', render: (org) => org.name || 'Untitled' },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      cellClassName: 'text-right space-x-3',
      render: (org) => (
        <HStack gap={2} justify="flex-end">
          <Button asChild variant="ghost" size="sm" colorPalette="blue">
            <Link to={`/organisation/${org.id}`}>
              <ExternalLink />
              View
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            colorPalette="red"
            onClick={() => handleDelete(org.id)}
          >
            <Trash2 />
            Delete
          </Button>
        </HStack>
      ),
    },
  ];

  if (isLoading) return <Box textAlign="center" py={10}>Loading organisations...</Box>;
  if (error) return <Box color="red.500" textAlign="center" py={10}>Error loading organisations</Box>;

  return (
    <Stack gap={6}>
      <Flex justify="space-between" align="center">
        <Heading size="2xl" color="fg">Organisations</Heading>
        <Button onClick={handleCreate}>
          <Plus className="h-5 w-5" />
          Add Organisation
        </Button>
      </Flex>

      <DataTable
        data={data?.data}
        columns={columns}
        keyExtractor={(org) => org.id}
        emptyMessage="No organisations found. Create your first one!"
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
              Are you sure you want to delete this organisation?
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button colorPalette="red" onClick={confirmDelete}>Delete</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Create Dialog */}
      <Dialog.Root open={isCreateOpen} onOpenChange={(e: any) => !e.open && setIsCreateOpen(false)}>
        <Dialog.Backdrop />
        {/* @ts-ignore */}
        <Dialog.Positioner>
          {/* @ts-ignore */}
          <Dialog.Content>
            <Dialog.CloseTrigger />
            <Dialog.Header>
              {/* @ts-ignore */}
              <Dialog.Title>Create Organisation</Dialog.Title>
            </Dialog.Header>
            <form onSubmit={(e) => { e.preventDefault(); submitCreate(); }}>
              <Dialog.Body>
                <Input
                  placeholder="Enter Organisation Name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  autoFocus
                />
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" colorPalette="blue">Create</Button>
              </Dialog.Footer>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Stack>
  );
};
