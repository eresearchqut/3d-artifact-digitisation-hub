import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organisationService, userService, teamService } from '../services/api.service';
import { ArrowLeft, UserPlus, Users, Trash2, Building2 } from 'lucide-react';
import { NativeSelect, Heading, Flex, Box, Stack, Button as ChakraButton } from '@chakra-ui/react';
import { Button } from '../components/Button/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card/Card';
import { DataTable, Column } from '../components/DataTable/DataTable';

export const OrganisationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const { data: organisation, isLoading: isOrgLoading } = useQuery({
    queryKey: ['organisation', id],
    queryFn: () => organisationService.findOne(id!),
    enabled: !!id,
  });

  const { data: orgUsers, isLoading: isUsersLoading } = useQuery({
    queryKey: ['organisationUsers', id],
    queryFn: () => organisationService.listUsers(id!),
    enabled: !!id,
  });

  const { data: orgTeams, isLoading: isTeamsLoading } = useQuery({
    queryKey: ['organisationTeams', id],
    queryFn: () => organisationService.listTeams(id!),
    enabled: !!id,
  });

  const { data: allUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.findAll(),
  });

  const { data: allTeams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamService.findAll(),
  });

  const addUserMutation = useMutation({
    mutationFn: (userId: string) => organisationService.addUser(id!, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organisationUsers', id] });
      setSelectedUserId('');
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => organisationService.removeUser(id!, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organisationUsers', id] });
    },
  });

  const addTeamMutation = useMutation({
    mutationFn: (teamId: string) => organisationService.addTeam(id!, teamId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organisationTeams', id] });
      setSelectedTeamId('');
    },
  });

  const removeTeamMutation = useMutation({
    mutationFn: (teamId: string) => organisationService.removeTeam(id!, teamId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organisationTeams', id] });
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

  const teamColumns: Column<any>[] = [
    { header: 'Name', key: 'name', render: (team: any) => team.name || 'Untitled Team' },
    {
      header: '',
      key: 'actions',
      render: (team: any) => (
        <Flex justify="flex-end">
          <ChakraButton
            variant="ghost"
            colorPalette="red"
            size="sm"
            onClick={() => removeTeamMutation.mutate(team.name)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove
          </ChakraButton>
        </Flex>
      ),
    },
  ];

  if (isOrgLoading || isTeamsLoading || isUsersLoading) return <Box textAlign="center" py={10} color="fg.muted">Loading organisation...</Box>;

  return (
    <Stack gap={8}>
      <Link to="/organisation" className="inline-flex items-center text-primary hover:text-primary/80">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Organisations
      </Link>

      <Flex align="center" gap={4}>
        <Box bg="colorPalette.muted" p={3} borderRadius="xl" color="colorPalette.fg">
          <Building2 className="h-8 w-8" />
        </Box>
        <Box>
          <Heading size="3xl" color="fg">{organisation?.name || 'Untitled'}</Heading>
          <p className="text-muted-foreground font-mono text-sm">{organisation?.id}</p>
        </Box>
      </Flex>

      <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "repeat(2, 1fr)" }} gap={8}>
        {/* Users Management */}
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center">
              <UserPlus className="mr-2 h-5 w-5" />
              Users
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
                    <option value="">Select a user to add...</option>
                    {allUsers?.data.filter(u => !orgUsers?.data.find(ou => ou.id === u.id)).map(user => (
                      <option key={user.id} value={user.id}>{user.email}</option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Button
                  type="submit"
                  disabled={!selectedUserId || addUserMutation.isPending}
                >
                  Add
                </Button>
              </Flex>
            </form>

            <Box mt={4}>
              <DataTable
                columns={userColumns}
                data={orgUsers?.data || []}
                emptyMessage="There are no users associated with this organisation"
                keyExtractor={(row: any) => row.id}
              />
            </Box>
          </CardContent>
        </Card>

        {/* Teams Management */}
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Teams
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            <form onSubmit={(e) => {
              e.preventDefault();
              if (selectedTeamId) addTeamMutation.mutate(selectedTeamId);
            }}>
              <Flex gap={2}>
                <NativeSelect.Root size="md" className="flex-1">
                  <NativeSelect.Field
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                  >
                    <option value="">Select a team to add...</option>
                    {allTeams?.data.filter(t => !orgTeams?.data.find(ot => ot.name === t.name)).map(team => (
                      <option key={team.name} value={team.name}>{team.name || 'Untitled Team'}</option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Button
                  type="submit"
                  disabled={!selectedTeamId || addTeamMutation.isPending}
                >
                  Add
                </Button>
              </Flex>
            </form>

            <Box mt={4}>
              <DataTable
                columns={teamColumns}
                data={orgTeams?.data || []}
                emptyMessage="There are no teams associated with this organisation"
                keyExtractor={(row: any) => row.name}
              />
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
};
