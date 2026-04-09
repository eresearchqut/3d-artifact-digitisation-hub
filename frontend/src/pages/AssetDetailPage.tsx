import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetService, shareService } from '../services/api.service';
import { Share, ShareAccess, AssetAccess } from '../services/types';
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
import { ArrowLeft, Plus, Trash2, Link, Users, Shield } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable/DataTable';
import { CronInput } from '../components/CronInput';

// ─── Duration helpers ─────────────────────────────────────────────────────────

const DURATION_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '1 day', hours: 24 },
  { label: '7 days', hours: 24 * 7 },
  { label: '30 days', hours: 24 * 30 },
  { label: '3 months', hours: 24 * 90 },
  { label: 'Never', hours: null },
];

function computeExpiresAt(hours: number | null): string | undefined {
  if (!hours) return undefined;
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

// ─── Reusable access sub-section ─────────────────────────────────────────────

function AccessSection({
  title,
  icon,
  placeholder,
  accessData,
  isLoading,
  onAdd,
  onRemove,
}: {
  title: string;
  icon: React.ReactNode;
  placeholder: string;
  accessData: AssetAccess[] | ShareAccess[];
  isLoading: boolean;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [inputVal, setInputVal] = useState('');

  const columns: Column<AssetAccess>[] = [
    { key: 'id', header: title },
    {
      key: 'grantedAt',
      header: 'Granted At',
      render: (row) => <span>{row.grantedAt ? new Date(row.grantedAt).toLocaleString() : '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
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
      <HStack>
        <Input
          placeholder={placeholder}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          size="sm"
        />
        <Button
          size="sm"
          disabled={!inputVal.trim()}
          onClick={() => { onAdd(inputVal.trim()); setInputVal(''); }}
        >
          <Plus /> Add
        </Button>
      </HStack>
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
  onRevoke,
}: {
  assetId: string;
  share: Share;
  onRevoke: (id: string) => void;
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share-users', share.id] }),
  });
  const removeUserMutation = useMutation({
    mutationFn: (email: string) => shareService.removeUserAccess(assetId, share.id, email),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share-users', share.id] }),
  });
  const addTeamMutation = useMutation({
    mutationFn: (name: string) => shareService.addTeamAccess(assetId, share.id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share-teams', share.id] }),
  });
  const removeTeamMutation = useMutation({
    mutationFn: (name: string) => shareService.removeTeamAccess(assetId, share.id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share-teams', share.id] }),
  });

  const isExpired = share.expiresAt && new Date(share.expiresAt) < new Date();

  return (
    <Box borderWidth="1px" borderRadius="md" p={4} bg="bg.subtle">
      <Flex justify="space-between" align="flex-start" mb={expanded ? 4 : 0}>
        <Stack gap={1}>
          <HStack>
            <Text fontFamily="mono" fontSize="sm">{share.id}</Text>
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
          </Text>
          {share.duration && (
            <Text fontSize="xs" color="fg.muted">Schedule: <code>{share.duration}</code></Text>
          )}
        </Stack>
        <HStack>
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            <Users /> {expanded ? 'Hide Access' : 'Manage Access'}
          </Button>
          <Button variant="ghost" size="sm" colorPalette="red" onClick={() => onRevoke(share.id)}>
            <Trash2 /> Revoke
          </Button>
        </HStack>
      </Flex>
      {expanded && (
        <Stack gap={4} pt={2}>
          <Separator />
          <AccessSection
            title="Users"
            icon={<Users size={14} />}
            placeholder="user@example.com"
            accessData={userAccess?.data ?? []}
            isLoading={false}
            onAdd={(email) => addUserMutation.mutate(email)}
            onRemove={(email) => removeUserMutation.mutate(email)}
          />
          <AccessSection
            title="Teams"
            icon={<Shield size={14} />}
            placeholder="team-name"
            accessData={teamAccess?.data ?? []}
            isLoading={false}
            onAdd={(name) => addTeamMutation.mutate(name)}
            onRemove={(name) => removeTeamMutation.mutate(name)}
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

  const [isCreateShareOpen, setIsCreateShareOpen] = useState(false);
  const [shareDurationHours, setShareDurationHours] = useState<number | null>(24);
  const [shareCron, setShareCron] = useState('0 0 * * *');
  const [useCronExpiry, setUseCronExpiry] = useState(false);

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-users', id] }),
  });
  const removeUserMutation = useMutation({
    mutationFn: (email: string) => assetService.removeUserAccess(id!, email),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-users', id] }),
  });
  const addTeamMutation = useMutation({
    mutationFn: (name: string) => assetService.addTeamAccess(id!, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-teams', id] }),
  });
  const removeTeamMutation = useMutation({
    mutationFn: (name: string) => assetService.removeTeamAccess(id!, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-teams', id] }),
  });

  const createShareMutation = useMutation({
    mutationFn: () =>
      shareService.create(id!, {
        ...(useCronExpiry ? { duration: shareCron } : {}),
        ...(!useCronExpiry && shareDurationHours
          ? { expiresAt: computeExpiresAt(shareDurationHours) }
          : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-shares', id] });
      setIsCreateShareOpen(false);
    },
  });

  const revokeShareMutation = useMutation({
    mutationFn: (shareId: string) => shareService.remove(id!, shareId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset-shares', id] }),
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
      <Box borderWidth="1px" borderRadius="md" p={4} bg="bg.subtle">
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
        </Stack>
      </Box>

      {/* Tabs: Access + Shares */}
      <Tabs.Root defaultValue="access">
        {/* @ts-ignore */}
        <Tabs.List>
          {/* @ts-ignore */}
          <Tabs.Trigger value="access"><Shield size={14} /> Access</Tabs.Trigger>
          {/* @ts-ignore */}
          <Tabs.Trigger value="shares"><Link size={14} /> Shares</Tabs.Trigger>
        </Tabs.List>

        {/* Access tab */}
        {/* @ts-ignore */}
        <Tabs.Content value="access">
          <Stack gap={6} pt={4}>
            <AccessSection
              title="Users"
              icon={<Users size={16} />}
              placeholder="user@example.com"
              accessData={userAccess?.data ?? []}
              isLoading={false}
              onAdd={(email) => addUserMutation.mutate(email)}
              onRemove={(email) => removeUserMutation.mutate(email)}
            />
            <Separator />
            <AccessSection
              title="Teams"
              icon={<Shield size={16} />}
              placeholder="team-name"
              accessData={teamAccess?.data ?? []}
              isLoading={false}
              onAdd={(name) => addTeamMutation.mutate(name)}
              onRemove={(name) => removeTeamMutation.mutate(name)}
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
                onRevoke={(shareId) => revokeShareMutation.mutate(shareId)}
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
                  <Text fontSize="sm" fontWeight="medium">Expiry</Text>
                  <HStack flexWrap="wrap" gap={2}>
                    {DURATION_OPTIONS.map((opt) => (
                      <Button
                        key={opt.label}
                        size="sm"
                        variant={!useCronExpiry && shareDurationHours === opt.hours ? 'solid' : 'outline'}
                        onClick={() => { setShareDurationHours(opt.hours); setUseCronExpiry(false); }}
                      >
                        {opt.label}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant={useCronExpiry ? 'solid' : 'outline'}
                      onClick={() => setUseCronExpiry(true)}
                    >
                      Custom schedule…
                    </Button>
                  </HStack>
                  {useCronExpiry && (
                    <Box pt={2}>
                      <Text fontSize="xs" color="fg.muted" mb={2}>
                        Set a cron schedule for when this share expires:
                      </Text>
                      <CronInput
                        value={shareCron}
                        onChange={(e) => setShareCron(e.target.value)}
                      />
                    </Box>
                  )}
                </Stack>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={() => setIsCreateShareOpen(false)}>Cancel</Button>
              <Button
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
