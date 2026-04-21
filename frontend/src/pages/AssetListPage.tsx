import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { assetService, getBaseUrl } from '../services/api.service';
import { AssetStatus } from '../services/types';
import { Plus, Trash2, Globe, Settings2, Search, X } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable/DataTable';
import { Badge, Button, HStack, Heading, Flex, Box, Stack, Dialog, Text, Spinner, Input, InputGroup } from '@chakra-ui/react';
import { toaster } from '../components/ui/toaster';
import { FilePicker } from '../components/FilePicker/FilePicker';
import { usePageTour } from '../hooks/usePageTour';
import { ASSET_LIST_TOUR_STEPS } from '../constants/tourSteps';
import { useClientPagination } from '../hooks/useClientPagination';

interface Asset {
  id: string;
  key: string;
  bucket?: string;
  status?: AssetStatus;
  uploadedAt?: string;
  uploadedBy?: string;
  metadata?: Record<string, string>;
}

const STATUS_CONFIG: Record<AssetStatus, { label: string; colorPalette: string }> = {
  [AssetStatus.UPLOADING]:          { label: 'Uploading',          colorPalette: 'blue'   },
  [AssetStatus.UPLOADED]:           { label: 'Uploaded',           colorPalette: 'cyan'   },
  [AssetStatus.VIEWER_BUILDING]:    { label: 'Viewer Building',    colorPalette: 'orange' },
  [AssetStatus.VIEWER_CONSTRUCTED]: { label: 'Viewer Constructed', colorPalette: 'green'  },
};

function formatFileSize(bytes: string | undefined): string {
  const n = Number(bytes);
  if (!bytes || isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  return `${(n / 1024 ** 4).toFixed(1)} TB`;
}

function formatLastModified(ts: string | undefined): string {
  const n = Number(ts);
  if (!ts || isNaN(n)) return '—';
  return new Date(n).toLocaleString();
}


export const AssetListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [viewerAsset, setViewerAsset] = useState<Asset | null>(null);

  const steps = useMemo(() => ASSET_LIST_TOUR_STEPS, []);
  usePageTour(steps);

  const { data: allAssets, isLoading, error } = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: () => assetService.findAll() as Promise<Asset[]>,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return data.some((a) => a.status !== AssetStatus.VIEWER_CONSTRUCTED) ? 5000 : false;
    },
  });

  const [search, setSearch] = useState('');

  const [sortKey, setSortKey] = useState<string>('lastmodified');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
  };

  const sortedAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = allAssets
      ? allAssets.filter((a) => {
          if (!query) return true;
          return (
            (a.metadata?.name ?? '').toLowerCase().includes(query) ||
            (a.uploadedBy ?? '').toLowerCase().includes(query)
          );
        })
      : allAssets;
    if (!filtered) return filtered;
    return [...filtered].sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;
      switch (sortKey) {
        case 'name':
          aVal = a.metadata?.name ?? '';
          bVal = b.metadata?.name ?? '';
          break;
        case 'size':
          aVal = Number(a.metadata?.size ?? 0);
          bVal = Number(b.metadata?.size ?? 0);
          break;
        case 'lastmodified':
          aVal = Number(a.metadata?.lastmodified ?? 0);
          bVal = Number(b.metadata?.lastmodified ?? 0);
          break;
        case 'uploadedBy':
          aVal = a.uploadedBy ?? '';
          bVal = b.uploadedBy ?? '';
          break;
        case 'status':
          aVal = a.status ?? '';
          bVal = b.status ?? '';
          break;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allAssets, sortKey, sortDir, search]);

  const { page, pageNumber, pageSize, total, hasPrev, hasMore, goNext, goPrev, changePageSize, reset } =
    useClientPagination(sortedAssets, 10);

  useEffect(() => { reset(); }, [search]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assetService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toaster.create({ type: 'success', title: 'Asset deleted' });
    },
    onError: (err: Error) => {
      toaster.create({ type: 'error', title: 'Failed to delete asset', description: err.message });
    },
  });


  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const handleFileSelect = async (file: File) => {
    const fileName = file.name;
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadFileName(fileName);

      const metadata = {
        name: file.name,
        size: file.size.toString(),
        type: file.type || 'application/octet-stream',
        lastmodified: file.lastModified.toString()
      };
      const { uploadUrl } = await assetService.generateUploadUrl(metadata);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(file);
      });

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['assets'] });
        setIsUploading(false);
        setUploadProgress(0);
        setIsUploadOpen(false);
        toaster.create({ type: 'success', title: 'Upload complete', description: fileName });
      }, 1000);
    } catch (err) {
      console.error('Upload failed', err);
      setIsUploading(false);
      setUploadProgress(0);
      setIsUploadOpen(false);
      toaster.create({ type: 'error', title: 'Upload failed', description: err instanceof Error ? err.message : undefined });
    }
  };

  const columns: Column<Asset>[] = [
    { key: 'id', header: 'ID', hideBelow: 'lg', render: (asset) => <Text color="fg.muted" fontFamily="mono" fontSize="xs">{asset.id}</Text> },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (asset) => <span>{asset.metadata?.name ?? '—'}</span>,
    },
    {
      key: 'size',
      header: 'Size',
      hideBelow: 'md',
      sortable: true,
      render: (asset) => <span>{formatFileSize(asset.metadata?.size)}</span>,
    },
    {
      key: 'lastmodified',
      header: 'Last Modified',
      hideBelow: 'md',
      sortable: true,
      render: (asset) => <span>{formatLastModified(asset.metadata?.lastmodified)}</span>,
    },
    {
      key: 'uploadedBy',
      header: 'Uploaded By',
      hideBelow: 'lg',
      sortable: true,
      render: (asset) => <span>{asset.uploadedBy ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (asset) => {
        if (!asset.status) return <span>—</span>;
        const cfg = STATUS_CONFIG[asset.status];
        if (!cfg) return <span>{asset.status}</span>;
        const isInProgress = asset.status !== AssetStatus.VIEWER_CONSTRUCTED;
        return (
          <HStack gap={1.5}>
            {isInProgress && <Spinner size="xs" color={`${cfg.colorPalette}.fg`} />}
            <Badge colorPalette={cfg.colorPalette} variant="subtle" size="sm">{cfg.label}</Badge>
          </HStack>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      textAlign: 'right',
      render: (asset) => (
        <HStack justify="flex-end">
          <Button variant="ghost" size="sm" colorPalette="blue" onClick={() => navigate(`/asset/${asset.id}`)}>
            <Settings2 />
            Manage
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setViewerAsset(asset)}>
            <Globe />
            Viewer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            colorPalette="red"
            onClick={() => handleDelete(asset.id)}
          >
            <Trash2 />
            Delete
          </Button>
        </HStack>
      ),
    },
  ];

  if (isLoading) return <Box textAlign="center" py={10} color="fg.muted">Loading assets...</Box>;
  if (error) return <Box color="red.500" textAlign="center" py={10}>Error loading assets</Box>;

  return (
    <Stack gap={6}>
      <Flex align="center" id="asset-list-heading" wrap="wrap" gap={3}>
        <Heading size={{ base: 'xl', md: '2xl' }} color="fg" flexShrink={0}>Assets</Heading>
        <Box flex={1} minW="0">
          <InputGroup startElement={<Search size={16} />} endElement={
            search ? (
              <Box as="button" onClick={() => setSearch('')} color="fg.muted" _hover={{ color: 'fg' }} display="flex" alignItems="center">
                <X size={14} />
              </Box>
            ) : undefined
          }>
            <Input
              placeholder="Search by name or uploaded by…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
        </Box>
        <Button id="asset-upload-btn" onClick={() => setIsUploadOpen(true)} flexShrink={0}>
          <Plus />
          Upload Asset
        </Button>
      </Flex>


      <Box id="asset-table">
        <DataTable
          data={page}
          columns={columns}
          keyExtractor={(asset) => asset.id}
          emptyMessage="No assets found."
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
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
              Are you sure you want to delete this asset?
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button colorPalette="red" onClick={confirmDelete}>Delete</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Upload Asset Dialog */}
      <Dialog.Root open={isUploadOpen} onOpenChange={(e: any) => !e.open && !isUploading && setIsUploadOpen(false)}>
        <Dialog.Backdrop />
        {/* @ts-ignore */}
        <Dialog.Positioner>
          {/* @ts-ignore */}
          <Dialog.Content>
            <Dialog.CloseTrigger />
            <Dialog.Header>
              {/* @ts-ignore */}
              <Dialog.Title>Upload Asset</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {isUploading ? (
                <Box py={4}>
                  <Text fontSize="sm" color="fg.muted" mb={3} truncate>
                    {uploadFileName}
                  </Text>
                  <HStack justify="space-between" mb={1.5}>
                    <Text fontSize="sm">Uploading...</Text>
                    <Text fontSize="sm" fontWeight="semibold">{uploadProgress}%</Text>
                  </HStack>
                  <Box h="8px" bg="bg.muted" borderRadius="full" overflow="hidden">
                    <Box
                      h="full"
                      bg="blue.solid"
                      borderRadius="full"
                      w={`${uploadProgress}%`}
                      style={{ transition: 'width 200ms ease' }}
                    />
                  </Box>
                </Box>
              ) : (
                <>
                  <Box mb={6} color="fg.muted">
                    Upload a .ply, .spz, .splat, or .sog asset file. This will trigger the asset builder process.
                  </Box>
                  <FilePicker 
                    onFileSelect={handleFileSelect} 
                    accept=".ply,.spz,.splat,.sog"
                    label="Upload 3DGS file"
                    helperText="Drag and drop a .ply, .spz, .splat, or .sog file here, or click to select (Max 500MB)"
                  />
                </>
              )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
      {/* Viewer Dialog */}
      <Dialog.Root open={viewerAsset !== null} onOpenChange={(e: any) => !e.open && setViewerAsset(null)}>
        <Dialog.Backdrop />
        {/* @ts-ignore */}
        <Dialog.Positioner>
          {/* @ts-ignore */}
          <Dialog.Content maxW="90vw" h="90vh">
            <Dialog.CloseTrigger />
            <Dialog.Header>
              {/* @ts-ignore */}
              <Dialog.Title>Asset Viewer: {viewerAsset?.id}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body p={0} m={0} h="full" w="full" overflow="hidden">
              {viewerAsset && (
                <iframe
                  src={`${getBaseUrl()}/asset/${viewerAsset.id}/viewer/index.html`}
                  style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                  title="Asset Viewer"
                  allow="xr-spatial-tracking; fullscreen"
                  allowFullScreen
                />
              )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Stack>
  );
};
