import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { siteService, organisationService } from '../services/api.service';
import { Plus, Trash2, Globe, Building2 } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable/DataTable';
import { Button, HStack, Heading, Flex, Box, Stack, Dialog } from '@chakra-ui/react';
import { NativeSelect } from '@chakra-ui/react';
import { Input } from '@chakra-ui/react';

interface Site {
  id: string;
  name: string;
}

export const SiteListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newSite, setNewSite] = useState({ name: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: sites, isLoading, error } = useQuery({
    queryKey: ['sites'],
    queryFn: () => siteService.findAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => siteService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => siteService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setShowCreate(false);
      setNewSite({ name: '' });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSite.name) {
      createMutation.mutate(newSite);
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

  const columns: Column<Site>[] = [
    { key: 'id', header: 'ID', cellClassName: 'text-muted-foreground font-mono text-xs' },
    {
      key: 'name',
      header: 'Site',
      cellClassName: 'font-medium text-foreground',
      render: (site) => (
        <Link to={`/site/${site.id}`} className="hover:underline">
          <Flex align="center" gap={3}>
            <Box bg="colorPalette.muted" p={1.5} borderRadius="md" color="colorPalette.fg">
              <Globe className="h-4 w-4" />
            </Box>
            <span>{site.name}</span>
          </Flex>
        </Link>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (site) => (
        <HStack justify="flex-end">
          <Link to={`/site/${site.id}`}>
            <Button variant="ghost" size="sm">
              <Globe />
              View
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            colorPalette="red"
            onClick={() => handleDelete(site.id)}
          >
            <Trash2 />
            Delete
          </Button>
        </HStack>
      ),
    },
  ];

  if (isLoading) return <Box textAlign="center" py={10} color="fg.muted">Loading sites...</Box>;
  if (error) return <Box color="red.500" textAlign="center" py={10}>Error loading sites</Box>;

  return (
    <Stack gap={6}>
      <Flex justify="space-between" align="center">
        <Heading size="2xl" color="fg">Sites</Heading>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-5 w-5" />
          Add Site
        </Button>
      </Flex>

      {showCreate && (
        <Box bg="bg.panel" color="fg" p={6} borderRadius="lg" borderWidth="1px" shadow="sm" display="flex" flexDirection="column" gap={4}>
          <Heading size="lg" mb={4}>Create New Site</Heading>
          <Box as="form" onSubmit={handleCreate} display="grid" gridTemplateColumns={{ base: "1fr" }} gap={4}>
            <Stack gap={1}>
              <label className="block text-sm font-medium text-foreground">Site Name</label>
              <Input
                required
                value={newSite.name}
                onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                placeholder="My Awesome Site"
              />
            </Stack>
            <Flex justify="flex-end" gap={3} pt={2}>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Create Site
              </Button>
            </Flex>
          </Box>
        </Box>
      )}

      <DataTable
        data={sites?.data}
        columns={columns}
        keyExtractor={(site) => site.id}
        emptyMessage="No sites found."
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
              Are you sure you want to delete this site?
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
