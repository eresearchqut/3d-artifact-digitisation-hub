import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetService } from '../services/api.service';
import { Plus, Trash2, Globe, Info } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable/DataTable';
import { Button, HStack, Heading, Flex, Box, Stack, Dialog, Spinner } from '@chakra-ui/react';
import { FilePicker } from '../components/FilePicker/FilePicker';

interface Asset {
  id: string;
  key: string;
  bucket?: string;
  metadata?: Record<string, string>;
}

const metadataColumns: Column<{ key: string; value: string }>[] = [
  {
    key: 'key',
    header: 'Key',
    render: (row) => <span className="text-muted-foreground">{row.key}</span>,
  },
  {
    key: 'value',
    header: 'Value',
    render: (row) => <span>{row.value}</span>,
  },
];

export const AssetListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAssetMetadata, setSelectedAssetMetadata] = useState<Record<string, string> | null>(null);
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
      const metadata = {
        name: file.name,
        size: file.size.toString(),
        type: file.type || 'application/octet-stream',
        lastmodified: file.lastModified.toString()
      };
      const { uploadUrl } = await assetService.generateUploadUrl(metadata);

      const headers: Record<string, string> = {
        'Content-Type': 'application/octet-stream',
      };
      // S3 expects metadata headers to be prepended with x-amz-meta-
      Object.entries(metadata).forEach(([k, v]) => {
        headers[`x-amz-meta-${k}`] = v;
      });

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers,
      });

      // Let S3 upload trigger the Lambda and update DynamoDB.
      // Wait a brief moment to let DynamoDB update before refreshing.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['assets'] });
        setIsUploading(false);
        setIsUploadOpen(false);
      }, 1000);
    } catch (err) {
      console.error('Upload failed', err);
      setIsUploading(false);
      setIsUploadOpen(false);
    }
  };

  const columns: Column<Asset>[] = [
    { key: 'id', header: 'ID', cellClassName: 'text-muted-foreground font-mono text-xs' },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      render: (asset) => (
        <HStack justify="flex-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedAssetMetadata(asset.metadata || {})}
          >
            <Info />
            Metadata
          </Button>
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
                <Box textAlign="center" py={10}>
                  <Spinner size="xl" />
                  <Box mt={4} color="fg.muted">Uploading asset...</Box>
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
      {/* Metadata Dialog */}
      <Dialog.Root open={selectedAssetMetadata !== null} onOpenChange={(e: any) => !e.open && setSelectedAssetMetadata(null)}>
        <Dialog.Backdrop />
        {/* @ts-ignore */}
        <Dialog.Positioner>
          {/* @ts-ignore */}
          <Dialog.Content>
            <Dialog.CloseTrigger />
            <Dialog.Header>
              {/* @ts-ignore */}
              <Dialog.Title>Asset Metadata</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {selectedAssetMetadata && Object.keys(selectedAssetMetadata).length > 0 ? (
                <Box overflowX="auto">
                  <DataTable
                    data={Object.entries(selectedAssetMetadata).map(([key, value]) => ({ key, value }))}
                    columns={metadataColumns}
                    keyExtractor={(row) => row.key}
                    emptyMessage="No metadata available."
                  />
                </Box>
              ) : (
                <Box py={4}>No metadata available.</Box>
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
                  src={`${import.meta.env.VITE_S3_ENDPOINT || 'http://localhost:4566'}/${viewerAsset.bucket || '3d-hub-assets'}/viewer/${viewerAsset.id}/index.html`}
                  style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                  title="Asset Viewer"
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
