import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetService, getBaseUrl } from '../services/api.service';
import { Plus, Trash2, Globe } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable/DataTable';
import { Button, HStack, Heading, Flex, Box, Stack, Dialog, Progress, Text } from '@chakra-ui/react';
import { FilePicker } from '../components/FilePicker/FilePicker';

interface Asset {
  id: string;
  key: string;
  bucket?: string;
  metadata?: Record<string, string>;
}

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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [viewerAsset, setViewerAsset] = useState<Asset | null>(null);

  const { data: assets, isLoading, error } = useQuery({
    queryKey: ['assets'],
    queryFn: () => assetService.findAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assetService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
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
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadFileName(file.name);

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
      }, 1000);
    } catch (err) {
      console.error('Upload failed', err);
      setIsUploading(false);
      setUploadProgress(0);
      setIsUploadOpen(false);
    }
  };

  const columns: Column<Asset>[] = [
    { key: 'id', header: 'ID', cellClassName: 'text-muted-foreground font-mono text-xs' },
    {
      key: 'name',
      header: 'Name',
      render: (asset) => <span>{asset.metadata?.name ?? '—'}</span>,
    },
    {
      key: 'size',
      header: 'Size',
      render: (asset) => <span>{formatFileSize(asset.metadata?.size)}</span>,
    },
    {
      key: 'lastmodified',
      header: 'Last Modified',
      render: (asset) => <span>{formatLastModified(asset.metadata?.lastmodified)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (asset) => (
        <HStack justify="flex-end">
          <Button variant="ghost" size="sm" onClick={() => setViewerAsset(asset)}>
            <Globe />
            View
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
      <Flex justify="space-between" align="center">
        <Heading size="2xl" color="fg">Assets</Heading>
        <Button onClick={() => setIsUploadOpen(true)}>
          <Plus />
          Upload Asset
        </Button>
      </Flex>


      <DataTable
        data={assets?.data}
        columns={columns}
        keyExtractor={(asset) => asset.id}
        emptyMessage="No assets found."
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
                  <Text fontSize="sm" color="fg.muted" mb={4} truncate>
                    {uploadFileName}
                  </Text>
                  <Progress.Root value={uploadProgress} max={100} size="md" colorPalette="blue">
                    <HStack justify="space-between" mb={1.5}>
                      <Progress.Label fontSize="sm">Uploading...</Progress.Label>
                      <Progress.ValueText fontSize="sm" fontWeight="medium" />
                    </HStack>
                    <Progress.Track borderRadius="full">
                      <Progress.Range />
                    </Progress.Track>
                  </Progress.Root>
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
