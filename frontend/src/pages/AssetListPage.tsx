import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { assetService, organisationService } from '../services/api.service';
import { Plus, Trash2, Globe, Building2, Info } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable/DataTable';
import { Button, HStack, Heading, Flex, Box, Stack, Dialog } from '@chakra-ui/react';
import { NativeSelect } from '@chakra-ui/react';
import { Input } from '@chakra-ui/react';
import { FilePicker } from '../components/FilePicker/FilePicker';

interface Asset {
  id: string;
  key: string;
  metadata?: Record<string, string>;
}

export const AssetListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAssetMetadata, setSelectedAssetMetadata] = useState<Record<string, string> | null>(null);

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
      const extension = file.name.substring(file.name.lastIndexOf('.'));
      const id = crypto.randomUUID();
      const metadata = {
        filename: file.name,
        size: file.size.toString(),
        type: file.type || 'application/octet-stream',
        lastmodified: file.lastModified.toString()
      };
      const { uploadUrl } = await assetService.generateUploadUrl(id, extension, metadata);

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
      key: 'key',
      header: 'Asset',
      cellClassName: 'font-medium text-foreground',
      render: (asset) => (
        <Link to={`/asset/${asset.id}`} className="hover:underline">
          <Flex align="center" gap={3}>
            <Box bg="colorPalette.muted" p={1.5} borderRadius="md" color="colorPalette.fg">
              <Globe className="h-4 w-4" />
            </Box>
            <span>{asset.key}</span>
          </Flex>
        </Link>
      ),
    },
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
          <Link to={`/asset/${asset.id}`}>
            <Button variant="ghost" size="sm">
              <Globe />
              View
            </Button>
          </Link>
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
                <Box textAlign="center" py={4}>Uploading...</Box>
              ) : (
                <FilePicker onFileSelect={handleFileSelect} accept=".ply,.spz,.splat,.sog" />
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
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 font-medium">Key</th>
                        <th className="py-2 font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedAssetMetadata).map(([k, v]) => (
                        <tr key={k} className="border-b last:border-0">
                          <td className="py-2 pr-4 text-muted-foreground">{k}</td>
                          <td className="py-2">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              ) : (
                <Box py={4}>No metadata available.</Box>
              )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Stack>
  );
};
