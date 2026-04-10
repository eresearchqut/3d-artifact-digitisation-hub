import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamService } from '../services/api.service';
import { Plus, Trash2, Settings2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataTable, Column } from '../components/DataTable/DataTable';
import { Button, HStack, Heading, Flex, Box, Stack, Dialog, Input, Text } from '@chakra-ui/react';

interface Team {
  name: string;
  description?: string;
}

export const TeamListPage: React.FC = () => {
  const [deleteName, setDeleteName] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');

  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamService.findAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teamService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (d: { name: string; description?: string }) => teamService.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });

  const submitCreate = () => {
    if (createName) {
      createMutation.mutate({ name: createName, description: createDescription || undefined });
      setIsCreateOpen(false);
      setCreateName('');
      setCreateDescription('');
    }
  };

  const confirmDelete = () => {
    if (deleteName) {
      deleteMutation.mutate(deleteName);
      setDeleteName(null);
    }
  };

  const columns: Column<Team>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (team) => (
        <Flex align="center" gap={3}>
          <Box bg="colorPalette.muted" p={1.5} borderRadius="md" color="colorPalette.fg">
            <Users size={16} />
          </Box>
          <span>{team.name || 'Untitled Team'}</span>
        </Flex>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (team) => <Text color="fg.muted">{team.description || '-'}</Text>,
    },
    {
      key: 'actions',
      header: 'Actions',
      textAlign: 'right',
      render: (team) => (
        <HStack gap={2} justify="flex-end">
          <Button asChild variant="ghost" size="sm" colorPalette="blue">
            <Link to={`/team/${team.name}`}>
              <Settings2 />
              Manage
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            colorPalette="red"
            onClick={() => setDeleteName(team.name)}
          >
            <Trash2 />
            Delete
          </Button>
        </HStack>
      ),
    },
  ];

  if (isLoading) return <Box textAlign="center" py={10} color="fg.muted">Loading teams...</Box>;
  if (error) return <Box color="red.500" textAlign="center" py={10}>Error loading teams</Box>;

  return (
    <Stack gap={6}>
      <Flex justify="space-between" align="center">
        <Heading size="2xl" color="fg">Teams</Heading>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus size={20} />
          Add Team
        </Button>
      </Flex>

      <DataTable
        data={data?.data}
        columns={columns}
        keyExtractor={(team) => team.name}
        emptyMessage="No teams found. Create your first one!"
      />

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={!!deleteName} onOpenChange={(e: any) => !e.open && setDeleteName(null)}>
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
              Are you sure you want to delete <strong>{deleteName}</strong>?
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={() => setDeleteName(null)}>Cancel</Button>
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
              <Dialog.Title>Create Team</Dialog.Title>
            </Dialog.Header>
            <form onSubmit={(e) => { e.preventDefault(); submitCreate(); }}>
              <Dialog.Body>
                <Stack gap={4}>
                  <Stack gap={1}>
                    <Text fontSize="sm" fontWeight="medium">Name</Text>
                    <Input
                      placeholder="Enter team name"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      autoFocus
                    />
                  </Stack>
                  <Stack gap={1}>
                    <Text fontSize="sm" fontWeight="medium">Description</Text>
                    <Input
                      placeholder="Optional description"
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                    />
                  </Stack>
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" colorPalette="blue" disabled={!createName}>Create</Button>
              </Dialog.Footer>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

    </Stack>
  );
};
