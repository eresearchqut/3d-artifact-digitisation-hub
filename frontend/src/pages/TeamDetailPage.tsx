import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamService, userService } from '../services/api.service';
import { ArrowLeft, UserPlus, Trash2, Users } from 'lucide-react';
import { NativeSelect, Heading, Flex, Box, Stack, Button as ChakraButton } from '@chakra-ui/react';
import { Button } from '../components/Button/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card/Card';
import { DataTable, Column } from '../components/DataTable/DataTable';

export const TeamDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');

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
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => teamService.removeUser(id!, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teamUsers', id] });
    },
  });

  const userColumns: Column<any>[] = [
    { header: 'Email', key: 'email' },
    {
      header: '',
      key: 'actions',
      render: (user: any) => (
        <Flex justify="flex-end">
          <ChakraButton
            variant="ghost"
            colorPalette="red"
            size="sm"
            onClick={() => removeUserMutation.mutate(user.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove
          </ChakraButton>
        </Flex>
      ),
    },
  ];

  if (isTeamLoading) return <Box textAlign="center" py={10} color="fg.muted">Loading team...</Box>;

  return (
    <Stack gap={8}>
      <Link to="/team" className="inline-flex items-center text-primary hover:text-primary/80">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Teams
      </Link>

      <Flex align="center" gap={4}>
        <Box bg="colorPalette.muted" p={3} borderRadius="xl" color="colorPalette.fg">
          <Users className="h-8 w-8" />
        </Box>
        <Box>
          <Heading size="3xl" color="fg">{team?.name || 'Untitled Team'}</Heading>
          {team?.description && <p className="text-muted-foreground text-sm">{team.description}</p>}
        </Box>
      </Flex>

      <Card className="max-w-2xl">
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex items-center">
            <UserPlus className="mr-2 h-5 w-5" />
            Team Members
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          <form onSubmit={(e) => {
            e.preventDefault();
            if (selectedUserId) addUserMutation.mutate(selectedUserId);
          }}>
            <Flex gap={2}>
              <NativeSelect.Root size="md" className="flex-1">
                <NativeSelect.Field
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">Select a user to add to team...</option>
                  {allUsers?.data.filter(u => !teamUsers?.data.find(tu => tu.id === u.id)).map(user => (
                    <option key={user.id} value={user.id}>{user.email}</option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
              <Button type="submit" disabled={!selectedUserId || addUserMutation.isPending}>
                Add
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
        </CardContent>
      </Card>
    </Stack>
  );
};
