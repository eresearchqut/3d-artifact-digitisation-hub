import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamService, userService } from '../services/api.service';
import { ArrowLeft, UserPlus, Trash2, Users, Plus } from 'lucide-react';
import { Heading, Flex, Box, Stack, Button, Text, HStack, Card } from '@chakra-ui/react';
import { toaster } from '../components/ui/toaster';
import { DataTable, Column } from '../components/DataTable/DataTable';
import { usePageTour } from '../hooks/usePageTour';
import { TEAM_DETAIL_TOUR_STEPS } from '../constants/tourSteps';

export const TeamDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');

  const steps = useMemo(() => TEAM_DETAIL_TOUR_STEPS, []);
  usePageTour(steps);

  const { data: team, isLoading: isTeamLoading } = useQuery({
    queryKey: ['team', id],
    queryFn: () => teamService.findOne(id!),
    enabled: !!id,
  });

  const { data: teamUsers } = useQuery({
    queryKey: ['teamUsers', id],
    queryFn: () => teamService.listUsers(id!),
    enabled: !!id,
  });

  const { data: allUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.findAll(),
  });

  const addUserMutation = useMutation({
    mutationFn: (userId: string) => teamService.addUser(id!, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teamUsers', id] });
      setSelectedUserId('');
      toaster.create({ type: 'success', title: 'User added to team' });
    },
    onError: (err: Error) => {
      toaster.create({ type: 'error', title: 'Failed to add user', description: err.message });
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => teamService.removeUser(id!, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teamUsers', id] });
      toaster.create({ type: 'success', title: 'User removed from team' });
    },
    onError: (err: Error) => {
      toaster.create({ type: 'error', title: 'Failed to remove user', description: err.message });
    },
  });

  const userColumns: Column<any>[] = [
    { header: 'Email', key: 'email' },
    {
      header: '',
      key: 'actions',
      render: (user: any) => (
        <Flex justify="flex-end">
          <Button
            variant="ghost"
            colorPalette="red"
            size="sm"
            onClick={() => removeUserMutation.mutate(user.id)}
          >
            <Trash2 size={16} />
            Remove
          </Button>
        </Flex>
      ),
    },
  ];

  if (isTeamLoading) return <Box textAlign="center" py={10} color="fg.muted">Loading team...</Box>;

  return (
    <Stack gap={8}>
      <Button asChild variant="ghost" size="sm">
        <Link to="/team">
          <ArrowLeft size={16} />
          Back to Teams
        </Link>
      </Button>

      <Flex align="center" gap={4} id="team-detail-heading">
        <Box bg="colorPalette.muted" p={3} borderRadius="xl" color="colorPalette.fg">
          <Users size={32} />
        </Box>
        <Box>
          <Heading size="3xl" color="fg">{team?.name || 'Untitled Team'}</Heading>
          {team?.description && <Text color="fg.muted" fontSize="sm">{team.description}</Text>}
        </Box>
      </Flex>

      <Card.Root maxW="2xl" id="team-members-card">
        <Card.Header borderBottomWidth="1px" pb={4}>
          <HStack>
            <UserPlus size={20} />
            <Card.Title>Team Members</Card.Title>
          </HStack>
        </Card.Header>

        <Card.Body pt={6}>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (selectedUserId) addUserMutation.mutate(selectedUserId);
          }}>
            <Flex gap={2}>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={{ flex: 1, fontSize: '0.875rem', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--chakra-colors-border)', background: 'var(--chakra-colors-bg)', color: 'var(--chakra-colors-fg)' }}
              >
                <option value="">Select a user to add to team...</option>
                {allUsers?.data.filter(u => !teamUsers?.data.find(tu => tu.id === u.id)).map(user => (
                  <option key={user.id} value={user.id}>{user.email}</option>
                ))}
              </select>
              <Button type="submit" colorPalette="blue" size="md" disabled={!selectedUserId || addUserMutation.isPending}>
                <Plus /> Add
              </Button>
            </Flex>
          </form>

          <Box mt={4}>
            <DataTable
              columns={userColumns}
              data={teamUsers?.data || []}
              emptyMessage="There are no users associated with this team"
              keyExtractor={(row: any) => row.id}
            />
          </Box>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
};
