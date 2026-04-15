import React, { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAuthSession } from 'aws-amplify/auth';
import { userService } from '../services/api.service';
import { Plus, Trash2, Mail, ShieldCheck, ShieldOff, KeyRound, RefreshCw } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable/DataTable';
import { Badge, Button, HStack, Heading, Flex, Box, Stack, Dialog, Input, Checkbox, Text } from '@chakra-ui/react';
import { toaster } from '../components/ui/toaster';
import { usePageTour } from '../hooks/usePageTour';
import { USER_LIST_TOUR_STEPS } from '../constants/tourSteps';
import { useClientPagination } from '../hooks/useClientPagination';

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
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [requireReset, setRequireReset] = useState(true);

  const steps = useMemo(() => USER_LIST_TOUR_STEPS, []);
  usePageTour(steps);

  useEffect(() => {
    fetchAuthSession()
      .then((session) => {
        const sub = session.tokens?.idToken?.payload?.['sub'] as string | undefined;
        if (sub) setCurrentSub(sub);
      })
      .catch(() => {});
  }, []);

  const queryClient = useQueryClient();
  const { data: allUsers, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.findAll(),
  });
  const { page, pageNumber, pageSize, total, hasPrev, hasMore, goNext, goPrev, changePageSize } =
    useClientPagination(allUsers, 10);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toaster.create({ type: 'success', title: 'User deleted' });
    },
    onError: (err: Error) => {
      toaster.create({ type: 'error', title: 'Failed to delete user', description: err.message });
    },
  });

  const createMutation = useMutation({
    mutationFn: (email: string) => userService.create({ email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toaster.create({ type: 'success', title: 'User created' });
    },
    onError: (err: Error) => {
      toaster.create({ type: 'error', title: 'Failed to create user', description: err.message });
    },
  });

  const setAdminMutation = useMutation({
    mutationFn: ({ id, isAdmin }: { id: string; isAdmin: boolean }) =>
      userService.setAdmin(id, isAdmin),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toaster.create({ type: 'success', title: variables.isAdmin ? 'Admin role granted' : 'Admin role removed' });
    },
    onError: (err: Error) => {
      toaster.create({ type: 'error', title: 'Failed to update role', description: err.message });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password, requireReset: req }: { id: string; password: string; requireReset: boolean }) =>
      userService.resetPassword(id, password, req),
    onSuccess: () => {
      setResetPasswordUserId(null);
      setNewPassword('');
      setRequireReset(true);
      toaster.create({ type: 'success', title: 'Password reset successfully' });
    },
    onError: (err: Error) => {
      toaster.create({ type: 'error', title: 'Failed to reset password', description: err.message });
    },
  });

  const generatePassword = () => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const special = '!@#$%^&*()-_=+[]{}';
    const all = upper + lower + digits + special;
    const rand = (set: string) => set[Math.floor(Math.random() * set.length)];
    // Guarantee at least one of each required class then pad to 16 chars
    const required = [rand(upper), rand(lower), rand(digits), rand(special)];
    const rest = Array.from({ length: 12 }, () => rand(all));
    const password = [...required, ...rest].sort(() => Math.random() - 0.5).join('');
    setNewPassword(password);
  };

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
    { key: 'id', header: 'ID', render: (user) => <Text color="fg.muted" fontFamily="mono">{user.id}</Text> },
    {
      key: 'email',
      header: 'Email',
      render: (user) => (
        <Flex align="center" gap={3}>
          <Box bg="colorPalette.muted" p={1.5} borderRadius="md" color="colorPalette.fg">
            <Mail size={16} />
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
            <ShieldCheck size={12} />
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
      textAlign: 'right',
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
              {user.isAdmin ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
              {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            colorPalette="blue"
            onClick={() => { setResetPasswordUserId(user.id); setNewPassword(''); setRequireReset(true); }}
            title="Reset password"
          >
            <KeyRound size={16} />
            Reset Password
          </Button>
          {user.sub !== currentSub && (
            <Button
              variant="ghost"
              size="sm"
              colorPalette="red"
              onClick={() => handleDelete(user.id)}
            >
              <Trash2 />
              Delete
            </Button>
          )}
        </HStack>
      ),
    },
  ];

  if (isLoading) return <Box textAlign="center" py={10} color="fg.muted">Loading users...</Box>;
  if (error) return <Box color="red.500" textAlign="center" py={10}>Error loading users</Box>;

  return (
    <Stack gap={6}>
      <Flex justify="space-between" align="center" id="user-list-heading">
        <Heading size="2xl" color="fg">Users</Heading>
        <Button id="user-create-btn" onClick={handleCreate}>
          <Plus size={20} />
          Add User
        </Button>
      </Flex>

      <Box id="user-table">
        <DataTable
          data={page}
          columns={columns}
          keyExtractor={(user) => user.id}
          emptyMessage="No users found."
          pagination={{
            hasPrev,
            hasMore,
            onPrev: goPrev,
            onNext: goNext,
            count: page.length,
            total,
            pageNumber,
            pageSize,
            pageSizeOptions: [10, 25, 50, 100],
            onPageSizeChange: changePageSize,
            isLoading,
          }}
        />
      </Box>

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
      {/* Reset Password Dialog */}
      <Dialog.Root open={!!resetPasswordUserId} onOpenChange={(e: any) => !e.open && setResetPasswordUserId(null)}>
        <Dialog.Backdrop />
        {/* @ts-ignore */}
        <Dialog.Positioner>
          {/* @ts-ignore */}
          <Dialog.Content>
            <Dialog.CloseTrigger />
            <Dialog.Header>
              {/* @ts-ignore */}
              <Dialog.Title>Reset Password</Dialog.Title>
            </Dialog.Header>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (resetPasswordUserId && newPassword) {
                resetPasswordMutation.mutate({ id: resetPasswordUserId, password: newPassword, requireReset });
              }
            }}>
              <Dialog.Body>
                <Stack gap={4}>
                  <HStack gap={2}>
                    <Input
                      flex="1"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoFocus
                      required
                    />
                    <Button type="button" variant="outline" size="sm" onClick={generatePassword} title="Generate strong password">
                      <RefreshCw size={16} />
                      Generate
                    </Button>
                  </HStack>
                  <Checkbox.Root
                    checked={requireReset}
                    onCheckedChange={(details: { checked: boolean | 'indeterminate' }) => setRequireReset(!!details.checked)}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    {/* @ts-ignore */}
                    <Checkbox.Label>Require password reset on next login</Checkbox.Label>
                  </Checkbox.Root>
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" type="button" onClick={() => setResetPasswordUserId(null)}>Cancel</Button>
                <Button
                  type="submit"
                  colorPalette="blue"
                  loading={resetPasswordMutation.isPending}
                  disabled={!newPassword}
                >
                  Reset Password
                </Button>
              </Dialog.Footer>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Stack>
  );
};
