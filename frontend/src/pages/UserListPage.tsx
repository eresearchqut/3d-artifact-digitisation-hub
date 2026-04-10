import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAuthSession } from 'aws-amplify/auth';
import { userService } from '../services/api.service';
import { Plus, Trash2, Mail, ShieldCheck, ShieldOff } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable/DataTable';
import { Badge, Button, HStack, Heading, Flex, Box, Stack, Dialog, Input } from '@chakra-ui/react';

interface User {
  id: string;
  sub?: string;
  email: string;
  isAdmin?: boolean;
}

export const UserListPage: React.FC = () => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [currentSub, setCurrentSub] = useState<string | null>(null);

  useEffect(() => {
    fetchAuthSession()
      .then((session) => {
        const sub = session.tokens?.idToken?.payload?.['sub'] as string | undefined;
        if (sub) setCurrentSub(sub);
      })
      .catch(() => {});
  }, []);

  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.findAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (email: string) => userService.create({ email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const setAdminMutation = useMutation({
    mutationFn: ({ id, isAdmin }: { id: string; isAdmin: boolean }) =>
      userService.setAdmin(id, isAdmin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const handleCreate = () => {
    setIsCreateOpen(true);
  };

  const submitCreate = () => {
    if (createEmail) {
      createMutation.mutate(createEmail);
      setIsCreateOpen(false);
      setCreateEmail('');
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

  const columns: Column<User>[] = [
    { key: 'id', header: 'ID', cellClassName: 'text-muted-foreground font-mono' },
    {
      key: 'email',
      header: 'Email',
      cellClassName: 'font-medium text-foreground',
      render: (user) => (
        <Flex align="center" gap={3}>
          <Box bg="colorPalette.muted" p={1.5} borderRadius="md" color="colorPalette.fg">
            <Mail className="h-4 w-4" />
          </Box>
          <span>{user.email}</span>
        </Flex>
      ),
    },
    {
      key: 'isAdmin',
      header: 'Role',
      render: (user) =>
        user.isAdmin ? (
          <Badge colorPalette="purple" variant="solid" size="sm">
            <ShieldCheck className="h-3 w-3" />
            Admin
          </Badge>
        ) : (
          <Badge colorPalette="gray" variant="outline" size="sm">
            User
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (user) => (
        <HStack justify="flex-end">
          {/* Hide the admin toggle entirely for the current user's own row */}
          {user.sub !== currentSub && (
            <Button
              variant="ghost"
              size="sm"
              colorPalette={user.isAdmin ? 'gray' : 'purple'}
              onClick={() => setAdminMutation.mutate({ id: user.id, isAdmin: !user.isAdmin })}
              title={user.isAdmin ? 'Remove admin role' : 'Grant admin role'}
            >
              {user.isAdmin ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            colorPalette="red"
            onClick={() => handleDelete(user.id)}
          >
            <Trash2 />
            Delete
          </Button>
        </HStack>
      ),
    },
  ];

  if (isLoading) return <Box textAlign="center" py={10} color="fg.muted">Loading users...</Box>;
  if (error) return <Box color="red.500" textAlign="center" py={10}>Error loading users</Box>;

  return (
    <Stack gap={6}>
      <Flex justify="space-between" align="center">
        <Heading size="2xl" color="fg">Users</Heading>
        <Button onClick={handleCreate}>
          <Plus className="h-5 w-5" />
          Add User
        </Button>
      </Flex>

      <DataTable
        data={data?.data}
        columns={columns}
        keyExtractor={(user) => user.id}
        emptyMessage="No users found."
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
              Are you sure you want to delete this user?
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
              <Dialog.Title>Create User</Dialog.Title>
            </Dialog.Header>
            <form onSubmit={(e) => { e.preventDefault(); submitCreate(); }}>
              <Dialog.Body>
                <Input
                  placeholder="Enter User Email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
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
