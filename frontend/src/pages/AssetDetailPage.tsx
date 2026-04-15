import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetService, shareService, userService, teamService } from '../services/api.service';
import { Share, ShareAccess, AssetAccess, AssetStatus } from '../services/types';
import { useIsAdmin } from '../hooks/useIsAdmin';
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Stack,
  Text,
  Badge,
  Input,
  Separator,
  Tabs,
  Dialog,
} from '@chakra-ui/react';
import { Switch } from '../components/ui/switch';
import { toaster } from '../components/ui/toaster';
import { ArrowLeft, Plus, Trash2, Link, Users, Shield, Copy } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable/DataTable';
import { usePageTour } from '../hooks/usePageTour';
import { ASSET_DETAIL_TOUR_STEPS } from '../constants/tourSteps';

// ─── Duration helpers ─────────────────────────────────────────────────────────

type DurationUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

const DURATION_UNITS: { label: string; value: DurationUnit }[] = [
  { label: 'Minute(s)', value: 'minute' },
  { label: 'Hour(s)', value: 'hour' },
  { label: 'Day(s)', value: 'day' },
  { label: 'Week(s)', value: 'week' },
  { label: 'Month(s)', value: 'month' },
  { label: 'Year(s)', value: 'year' },
];

// ─── Reusable access sub-section ─────────────────────────────────────────────

function AccessSection({
  title,
  icon,
  placeholder,
  accessData,
  isLoading,
  options,
  onAdd,
  onRemove,
  isAdmin,
}: {
  title: string;
  icon: React.ReactNode;
  placeholder: string;
  accessData: AssetAccess[] | ShareAccess[];
  isLoading: boolean;
  options: { label: string; value: string }[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  isAdmin: boolean;
}) {
  const [selected, setSelected] = useState('');

  const columns: Column<AssetAccess>[] = [
    { key: 'id', header: title },
    {
      key: 'grantedAt',
      header: 'Granted At',
      render: (row) => <span>{row.grantedAt ? new Date(row.grantedAt).toLocaleString() : '—'}</span>,
    },
    {
      key: 'grantedBy',
      header: 'Granted By',
      render: (row) => <span>{(row as AssetAccess).grantedBy ?? '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      textAlign: 'right',
      render: (row) => (
        <Button variant="ghost" size="sm" colorPalette="red" onClick={() => onRemove(row.id)}>
          <Trash2 /> Remove
        </Button>
      ),
    },
  ];

  return (
    <Stack gap={3}>
      <HStack>
        {icon}
        <Text fontWeight="semibold">{title}</Text>
      </HStack>
      {isAdmin && (
        <HStack>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={options.length === 0}
            style={{ flex: 1, fontSize: '0.875rem', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--chakra-colors-border)', background: 'var(--chakra-colors-bg)', color: 'var(--chakra-colors-fg)' }}
          >
            <option value="">{options.length === 0 ? `No ${placeholder} available` : `Select ${placeholder}…`}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <Button
            size="sm"
            colorPalette="blue"
            disabled={!selected}
            onClick={() => { onAdd(selected); setSelected(''); }}
          >
            <Plus /> Add
          </Button>
        </HStack>
      )}
      <DataTable
        data={accessData as AssetAccess[]}
        columns={columns}
        keyExtractor={(row) => row.id}
        emptyMessage={isLoading ? 'Loading…' : 'No access granted.'}
      />
    </Stack>
  );
}

// ─── Share row with expandable access ────────────────────────────────────────

function ShareRow({
  assetId,
  share,
  allUsers,
  allTeams,
  onRevoke,
  isAdmin,
}: {
  assetId: string;
  share: Share;
  allUsers: { label: string; value: string }[];
  allTeams: { label: string; value: string }[];
  onRevoke: (id: string) => void;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: userAccess } = useQuery({
    queryKey: ['share-users', share.id],
    queryFn: () => shareService.listUserAccess(assetId, share.id),
    enabled: expanded,
  });
  const { data: teamAccess } = useQuery({
    queryKey: ['share-teams', share.id],
    queryFn: () => shareService.listTeamAccess(assetId, share.id),
    enabled: expanded,
  });

  const addUserMutation = useMutation({
    mutationFn: (email: string) => shareService.addUserAccess(assetId, share.id, email),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['share-users', share.id] }); toaster.create({ type: 'success', title: 'User access granted' }); },
    onError: (err: Error) => { console.error('[share] addUser failed', err); toaster.create({ type: 'error', title: 'Failed to add user', description: err.message }); },
  });
  const removeUserMutation = useMutation({
    mutationFn: (email: string) => shareService.removeUserAccess(assetId, share.id, email),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['share-users', share.id] }); toaster.create({ type: 'success', title: 'User access removed' }); },
    onError: (err: Error) => { console.error('[share] removeUser failed', err); toaster.create({ type: 'error', title: 'Failed to remove user', description: err.message }); },
  });
  const addTeamMutation = useMutation({
    mutationFn: (name: string) => shareService.addTeamAccess(assetId, share.id, name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['share-teams', share.id] }); toaster.create({ type: 'success', title: 'Team access granted' }); },
    onError: (err: Error) => { console.error('[share] addTeam failed', err); toaster.create({ type: 'error', title: 'Failed to add team', description: err.message }); },
  });
  const removeTeamMutation = useMutation({
    mutationFn: (name: string) => shareService.removeTeamAccess(assetId, share.id, name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['share-teams', share.id] }); toaster.create({ type: 'success', title: 'Team access removed' }); },
    onError: (err: Error) => { console.error('[share] removeTeam failed', err); toaster.create({ type: 'error', title: 'Failed to remove team', description: err.message }); },
  });

  const isExpired = share.expiresAt && new Date(share.expiresAt) < new Date();
  const durationLabel = share.durationValue && share.durationUnit
    ? `${share.durationValue} ${share.durationUnit}(s)`
    : null;
  const shareUrl = `${window.location.origin}/share/${share.id}`;

  return (
    <Box borderWidth="1px" borderRadius="md" p={4} bg="bg.subtle">
      <Flex justify="space-between" align="flex-start" mb={expanded ? 4 : 0}>
        <Stack gap={1}>
          <HStack>
            <Text fontFamily="mono" fontSize="sm">{share.id}</Text>
            {share.isPublic && <Badge colorPalette="purple">Public</Badge>}
            {share.expiresAt ? (
              <Badge colorPalette={isExpired ? 'red' : 'green'}>
                {isExpired ? 'Expired' : `Expires ${new Date(share.expiresAt).toLocaleDateString()}`}
              </Badge>
            ) : (
              <Badge colorPalette="blue">Never expires</Badge>
            )}
          </HStack>
          <Text fontSize="xs" color="fg.muted">
            Created {new Date(share.createdAt).toLocaleString()}
            {share.createdBy ? ` by ${share.createdBy}` : ''}
            {durationLabel ? ` · Duration: ${durationLabel}` : ''}
          </Text>
          <HStack gap={1}>
            <Text fontFamily="mono" fontSize="xs" color="fg.muted" truncate maxW="420px">{shareUrl}</Text>
            <Button variant="ghost" size="xs" onClick={() => navigator.clipboard.writeText(shareUrl)} aria-label="Copy share URL">
              <Copy size={12} />
            </Button>
          </HStack>
        </Stack>
        <HStack>
          {!share.isPublic && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
              <Users /> {expanded ? 'Hide Access' : 'Manage Access'}
            </Button>
          )}
          <Button variant="ghost" size="sm" colorPalette="red" onClick={() => onRevoke(share.id)}>
            <Trash2 /> Revoke
          </Button>
        </HStack>
      </Flex>
      {expanded && !share.isPublic && (
        <Stack gap={4} pt={2}>
          <Separator />
          <AccessSection
            title="Users"
            icon={<Users size={14} />}
            placeholder="user"
            accessData={userAccess?.data ?? []}
            isLoading={false}
            options={allUsers.filter((u) => !(userAccess?.data ?? []).some((a) => a.id === u.value))}
            onAdd={(email) => addUserMutation.mutate(email)}
            onRemove={(email) => removeUserMutation.mutate(email)}
            isAdmin={isAdmin}
          />
          <AccessSection
            title="Teams"
            icon={<Shield size={14} />}
            placeholder="team"
            accessData={teamAccess?.data ?? []}
            isLoading={false}
            options={allTeams.filter((t) => !(teamAccess?.data ?? []).some((a) => a.id === t.value))}
            onAdd={(name) => addTeamMutation.mutate(name)}
            onRemove={(name) => removeTeamMutation.mutate(name)}
            isAdmin={isAdmin}
          />
        </Stack>
      )}
    </Box>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export const AssetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();

  const [isCreateShareOpen, setIsCreateShareOpen] = useState(false);
  const [durationValue, setDurationValue] = useState<string>('');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('day');
  const [isPublic, setIsPublic] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<string[]>([]);
  const [pendingTeams, setPendingTeams] = useState<string[]>([]);
  const [pendingUserSelect, setPendingUserSelect] = useState('');
  const [pendingTeamSelect, setPendingTeamSelect] = useState('');

  const steps = useMemo(() => ASSET_DETAIL_TOUR_STEPS, []);
  usePageTour(steps);

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetService.findOne(id!),
    enabled: !!id,
  });

  const { data: userAccess } = useQuery({
    queryKey: ['asset-users', id],
    queryFn: () => assetService.listUserAccess(id!),
    enabled: !!id,
  });

  const { data: teamAccess } = useQuery({
    queryKey: ['asset-teams', id],
    queryFn: () => assetService.listTeamAccess(id!),
    enabled: !!id,
  });

  const { data: shares } = useQuery({
    queryKey: ['asset-shares', id],
    queryFn: () => shareService.findAll(id!),
    enabled: !!id,
  });

  const addUserMutation = useMutation({
    mutationFn: (email: string) => assetService.addUserAccess(id!, email),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['asset-users', id] }); toaster.create({ type: 'success', title: 'User access granted' }); },
    onError: (err: Error) => { console.error('[asset] addUser failed', err); toaster.create({ type: 'error', title: 'Failed to add user', description: err.message }); },
  });
  const removeUserMutation = useMutation({
    mutationFn: (email: string) => assetService.removeUserAccess(id!, email),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['asset-users', id] }); toaster.create({ type: 'success', title: 'User access removed' }); },
    onError: (err: Error) => { console.error('[asset] removeUser failed', err); toaster.create({ type: 'error', title: 'Failed to remove user', description: err.message }); },
  });
  const addTeamMutation = useMutation({
    mutationFn: (name: string) => assetService.addTeamAccess(id!, name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['asset-teams', id] }); toaster.create({ type: 'success', title: 'Team access granted' }); },
    onError: (err: Error) => { console.error('[asset] addTeam failed', err); toaster.create({ type: 'error', title: 'Failed to add team', description: err.message }); },
  });
  const removeTeamMutation = useMutation({
    mutationFn: (name: string) => assetService.removeTeamAccess(id!, name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['asset-teams', id] }); toaster.create({ type: 'success', title: 'Team access removed' }); },
    onError: (err: Error) => { console.error('[asset] removeTeam failed', err); toaster.create({ type: 'error', title: 'Failed to remove team', description: err.message }); },
  });

  const { data: allUsersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.findAll(100),
    enabled: isAdmin,
  });

  const { data: allTeamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamService.findAll(100),
    enabled: isAdmin,
  });

  const allUserOptions = (allUsersData?.data ?? []).map((u) => ({ label: u.email, value: u.email }));
  const allTeamOptions = (allTeamsData?.data ?? []).map((t) => ({ label: t.name, value: t.name }));

  const availableUserOptions = allUserOptions.filter(
    (u) => !(userAccess?.data ?? []).some((a) => a.id === u.value),
  );
  const availableTeamOptions = allTeamOptions.filter(
    (t) => !(teamAccess?.data ?? []).some((a) => a.id === t.value),
  );

  const createShareMutation = useMutation({
    mutationFn: async () => {
      const parsed = parseInt(durationValue, 10);
      const share = await shareService.create(id!, {
        ...(durationValue && !isNaN(parsed) ? { durationValue: parsed, durationUnit } : {}),
        isPublic,
      });
      console.log('[createShare] created share:', share, 'pendingUsers:', pendingUsers, 'pendingTeams:', pendingTeams, 'isPublic:', isPublic);
      if (!isPublic && (pendingUsers.length > 0 || pendingTeams.length > 0)) {
        console.log('[createShare] adding access, share.id:', share.id);
        await Promise.all([
          ...pendingUsers.map((email) => {
            console.log('[createShare] addUserAccess', id, share.id, email);
            return shareService.addUserAccess(id!, share.id, email);
          }),
          ...pendingTeams.map((name) => {
            console.log('[createShare] addTeamAccess', id, share.id, name);
            return shareService.addTeamAccess(id!, share.id, name);
          }),
        ]);
        console.log('[createShare] access grants complete');
      }
      return share;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-shares', id] });
      setIsCreateShareOpen(false);
      setDurationValue('');
      setDurationUnit('day');
      setIsPublic(false);
      setPendingUsers([]);
      setPendingTeams([]);
      setPendingUserSelect('');
      setPendingTeamSelect('');
      toaster.create({ type: 'success', title: 'Share created' });
    },
    onError: (err: Error) => {
      console.error('[createShare] failed:', err);
      toaster.create({ type: 'error', title: 'Failed to create share', description: err.message });
    },
  });

  const revokeShareMutation = useMutation({
    mutationFn: (shareId: string) => shareService.remove(id!, shareId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['asset-shares', id] }); toaster.create({ type: 'success', title: 'Share revoked' }); },
    onError: (err: Error) => { console.error('[revokeShare] failed:', err); toaster.create({ type: 'error', title: 'Failed to revoke share', description: err.message }); },
  });

  if (isLoading) return <Box py={10} textAlign="center" color="fg.muted">Loading…</Box>;
  if (!asset) return <Box py={10} textAlign="center" color="red.500">Asset not found</Box>;

  const filename = (asset as any).metadata?.name ?? asset.id;

  return (
    <Stack gap={6}>
      {/* Header */}
      <Flex align="center" gap={3}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/asset')}>
          <ArrowLeft /> Assets
        </Button>
        <Separator orientation="vertical" h="4" />
        <Heading size="xl">{filename}</Heading>
      </Flex>

      {/* Asset info */}
      <Box borderWidth="1px" borderRadius="md" p={4} bg="bg.subtle" id="asset-detail-info">
        <Stack gap={1}>
          <HStack>
            <Text fontSize="sm" color="fg.muted" w="120px">ID</Text>
            <Text fontFamily="mono" fontSize="sm">{asset.id}</Text>
          </HStack>
          <HStack>
            <Text fontSize="sm" color="fg.muted" w="120px">Uploaded by</Text>
            <Text fontSize="sm">{asset.uploadedBy ?? '—'}</Text>
          </HStack>
          <HStack>
            <Text fontSize="sm" color="fg.muted" w="120px">Uploaded at</Text>
            <Text fontSize="sm">{asset.uploadedAt ? new Date(asset.uploadedAt).toLocaleString() : '—'}</Text>
          </HStack>
          <HStack>
            <Text fontSize="sm" color="fg.muted" w="120px">Status</Text>
            {asset.status ? (
              <Badge
                colorPalette={
                  asset.status === AssetStatus.VIEWER_CONSTRUCTED ? 'green'
                  : asset.status === AssetStatus.VIEWER_BUILDING ? 'orange'
                  : asset.status === AssetStatus.UPLOADED ? 'cyan'
                  : 'blue'
                }
                variant="subtle"
                size="sm"
              >
                {asset.status.replace(/_/g, ' ')}
              </Badge>
            ) : (
              <Text fontSize="sm">—</Text>
            )}
          </HStack>
        </Stack>
      </Box>

      {/* Tabs: Access + Shares */}
      <Tabs.Root defaultValue="shares" id="asset-detail-tabs">
        {/* @ts-ignore */}
        <Tabs.List>
          {/* @ts-ignore */}
          <Tabs.Trigger value="shares" id="asset-shares-tab"><Link size={14} /> Shares</Tabs.Trigger>
          {/* @ts-ignore */}
          <Tabs.Trigger value="access" id="asset-access-tab"><Shield size={14} /> Access</Tabs.Trigger>
        </Tabs.List>

        {/* Access tab */}
        {/* @ts-ignore */}
        <Tabs.Content value="access">
          <Stack gap={6} pt={4}>
            <AccessSection
              title="Users"
              icon={<Users size={16} />}
              placeholder="user"
              accessData={userAccess?.data ?? []}
              isLoading={false}
              options={availableUserOptions}
              onAdd={(email) => addUserMutation.mutate(email)}
              onRemove={(email) => removeUserMutation.mutate(email)}
              isAdmin={isAdmin}
            />
            <Separator />
            <AccessSection
              title="Teams"
              icon={<Shield size={16} />}
              placeholder="team"
              accessData={teamAccess?.data ?? []}
              isLoading={false}
              options={availableTeamOptions}
              onAdd={(name) => addTeamMutation.mutate(name)}
              onRemove={(name) => removeTeamMutation.mutate(name)}
              isAdmin={isAdmin}
            />
          </Stack>
        </Tabs.Content>

        {/* Shares tab */}
        {/* @ts-ignore */}
        <Tabs.Content value="shares">
          <Stack gap={4} pt={4}>
            <Flex justify="flex-end">
              <Button onClick={() => setIsCreateShareOpen(true)}>
                <Plus /> Create Share
              </Button>
            </Flex>
            {shares?.data.length === 0 && (
              <Box textAlign="center" py={6} color="fg.muted">No shares yet.</Box>
            )}
            {shares?.data.map((share) => (
              <ShareRow
                key={share.id}
                assetId={id!}
                share={share}
                allUsers={allUserOptions}
                allTeams={allTeamOptions}
                onRevoke={(shareId) => revokeShareMutation.mutate(shareId)}
                isAdmin={isAdmin}
              />
            ))}
          </Stack>
        </Tabs.Content>
      </Tabs.Root>

      {/* Create Share Dialog */}
      <Dialog.Root
        open={isCreateShareOpen}
        onOpenChange={(e: any) => !e.open && setIsCreateShareOpen(false)}
      >
        <Dialog.Backdrop />
        {/* @ts-ignore */}
        <Dialog.Positioner>
          {/* @ts-ignore */}
          <Dialog.Content maxW="600px">
            <Dialog.CloseTrigger />
            <Dialog.Header>
              {/* @ts-ignore */}
              <Dialog.Title>Create Share</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={4}>
                <Text fontSize="sm" color="fg.muted">
                  A share creates a unique link that can be granted to users and teams.
                </Text>
                <Stack gap={2}>
                  <Text fontSize="sm" fontWeight="medium">Duration (optional)</Text>
                  <HStack>
                    <Input
                      placeholder="1–60"
                      type="number"
                      min={1}
                      max={60}
                      value={durationValue}
                      onChange={(e) => setDurationValue(e.target.value)}
                      size="sm"
                      maxW="100px"
                    />
                    <select
                      value={durationUnit}
                      onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                      style={{ fontSize: '0.875rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--chakra-colors-border)' }}
                    >
                      {DURATION_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </HStack>
                  <Text fontSize="xs" color="fg.muted">Leave blank for no expiry.</Text>
                </Stack>
                <HStack align="center" gap={3}>
                  <Switch
                    checked={isPublic}
                    onCheckedChange={({ checked }: { checked: boolean }) => setIsPublic(checked)}
                  />
                  <Stack gap={0}>
                    <Text fontSize="sm" fontWeight="medium">{isPublic ? 'Public' : 'Private'}</Text>
                    <Text fontSize="xs" color="fg.muted">
                      {isPublic
                        ? 'Allow anonymous access via the share link.'
                        : 'Only the following users and teams can access the share.'}
                    </Text>
                  </Stack>
                </HStack>

                {!isPublic && (
                  <Stack gap={4} pt={1}>
                    <Separator />
                    {/* Users */}
                    <Stack gap={2}>
                      <HStack>
                        <Users size={14} />
                        <Text fontSize="sm" fontWeight="medium">Users</Text>
                      </HStack>
                      <HStack>
                        <select
                          value={pendingUserSelect}
                          onChange={(e) => setPendingUserSelect(e.target.value)}
                          disabled={allUserOptions.filter((u) => !pendingUsers.includes(u.value)).length === 0}
                          style={{ flex: 1, fontSize: '0.875rem', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--chakra-colors-border)', background: 'var(--chakra-colors-bg)', color: 'var(--chakra-colors-fg)' }}
                        >
                          <option value="">Select user…</option>
                          {allUserOptions
                            .filter((u) => !pendingUsers.includes(u.value))
                            .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <Button
                          size="sm"
                          colorPalette="blue"
                          disabled={!pendingUserSelect}
                          onClick={() => { setPendingUsers((prev) => [...prev, pendingUserSelect]); setPendingUserSelect(''); }}
                        >
                          <Plus /> Add
                        </Button>
                      </HStack>
                      {pendingUsers.length > 0 && (
                        <Stack gap={1}>
                          {pendingUsers.map((email) => (
                            <HStack key={email} justify="space-between" px={2} py={1} borderWidth="1px" borderRadius="md" bg="bg.subtle">
                              <Text fontSize="sm">{email}</Text>
                              <Button variant="ghost" size="xs" colorPalette="red" onClick={() => setPendingUsers((prev) => prev.filter((e) => e !== email))}>
                                <Trash2 size={12} />
                              </Button>
                            </HStack>
                          ))}
                        </Stack>
                      )}
                    </Stack>
                    {/* Teams */}
                    <Stack gap={2}>
                      <HStack>
                        <Shield size={14} />
                        <Text fontSize="sm" fontWeight="medium">Teams</Text>
                      </HStack>
                      <HStack>
                        <select
                          value={pendingTeamSelect}
                          onChange={(e) => setPendingTeamSelect(e.target.value)}
                          disabled={allTeamOptions.filter((t) => !pendingTeams.includes(t.value)).length === 0}
                          style={{ flex: 1, fontSize: '0.875rem', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--chakra-colors-border)', background: 'var(--chakra-colors-bg)', color: 'var(--chakra-colors-fg)' }}
                        >
                          <option value="">Select team…</option>
                          {allTeamOptions
                            .filter((t) => !pendingTeams.includes(t.value))
                            .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <Button
                          size="sm"
                          colorPalette="blue"
                          disabled={!pendingTeamSelect}
                          onClick={() => { setPendingTeams((prev) => [...prev, pendingTeamSelect]); setPendingTeamSelect(''); }}
                        >
                          <Plus /> Add
                        </Button>
                      </HStack>
                      {pendingTeams.length > 0 && (
                        <Stack gap={1}>
                          {pendingTeams.map((name) => (
                            <HStack key={name} justify="space-between" px={2} py={1} borderWidth="1px" borderRadius="md" bg="bg.subtle">
                              <Text fontSize="sm">{name}</Text>
                              <Button variant="ghost" size="xs" colorPalette="red" onClick={() => setPendingTeams((prev) => prev.filter((n) => n !== name))}>
                                <Trash2 size={12} />
                              </Button>
                            </HStack>
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </Stack>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              {createShareMutation.error && (
                <Text fontSize="sm" color="red.500" flex="1">
                  {(createShareMutation.error as Error).message}
                </Text>
              )}
              <Button variant="outline" onClick={() => setIsCreateShareOpen(false)}>Cancel</Button>
              <Button
                colorPalette="blue"
                loading={createShareMutation.isPending}
                onClick={() => createShareMutation.mutate()}
              >
                Create Share
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Stack>
  );
};
