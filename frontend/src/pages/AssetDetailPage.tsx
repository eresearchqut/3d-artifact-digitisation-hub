import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { assetService } from '../services/api.service';
import { ArrowLeft, Globe } from 'lucide-react';
import { Heading, Flex, Box, Stack, Text } from '@chakra-ui/react';
import { FilePicker } from '../components/FilePicker/FilePicker';

export const AssetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const { data: asset, isLoading, error } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetService.findOne(id!),
    enabled: !!id,
  });

  const handleFileSelect = async (file: File) => {
    if (!id) return;
    
    // Check file size limit (500MB)
    if (file.size > 500 * 1024 * 1024) {
      setUploadStatus('error');
      setErrorMessage('File size exceeds the 500MB limit.');
      return;
    }
    
    // Check file extension
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const supportedExtensions = ['.ply', '.spz', '.splat', '.sog'];
    if (!supportedExtensions.includes(extension)) {
      setUploadStatus('error');
      setErrorMessage('Unsupported file extension. Only .ply, .spz, .splat, and .sog are supported.');
      return;
    }

    setUploadStatus('uploading');
    setErrorMessage('');

    try {
      // 1. Get presigned URL
      const { uploadUrl } = await assetService.generateUploadUrl({ name: file.name, type: file.type, size: file.size.toString(), lastmodified: file.lastModified.toString() });
      
      // 2. Upload file
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      setUploadStatus('success');
    } catch (err: any) {
      console.error('File upload error:', err);
      setUploadStatus('error');
      setErrorMessage(err.message || 'An error occurred during upload.');
    }
  };

  if (isLoading) {
    return <Box textAlign="center" py={10} color="fg.muted">Loading asset details...</Box>;
  }

  if (error || !asset) {
    return (
      <Box color="red.500" textAlign="center" py={10}>
        Error loading asset details
        <Box mt={4}>
          <Link to="/asset" className="text-blue-500 hover:underline">
            Back to Assets
          </Link>
        </Box>
      </Box>
    );
  }

  return (
    <Stack gap={6}>
      <Flex align="center" gap={4}>
        <Link to="/asset" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <Flex align="center" gap={3}>
          <Box bg="colorPalette.muted" p={2} borderRadius="md" color="colorPalette.fg">
            <Globe className="h-6 w-6" />
          </Box>
          <Heading size="2xl" color="fg">{asset.key}</Heading>
        </Flex>
      </Flex>

      <Box bg="bg.panel" p={6} borderRadius="lg" borderWidth="1px" shadow="sm">
        <Heading size="lg" mb={4}>Upload Assets</Heading>
        <Text color="fg.muted" mb={6}>
          Upload a .ply, .spz, .splat, or .sog asset file for this asset. This will trigger the asset builder process.
        </Text>
        
        <FilePicker 
          onFileSelect={handleFileSelect} 
          accept=".ply,.spz,.splat,.sog"
          label="Upload 3DGS file"
          helperText="Drag and drop a .ply, .spz, .splat, or .sog file here, or click to select (Max 500MB)"
        />

        {uploadStatus === 'uploading' && (
          <Text color="blue.500" mt={4} textAlign="center">
            Uploading...
          </Text>
        )}
        {uploadStatus === 'success' && (
          <Text color="green.500" mt={4} textAlign="center">
            File uploaded successfully! The asset builder will start processing it shortly.
          </Text>
        )}
        {uploadStatus === 'error' && (
          <Text color="red.500" mt={4} textAlign="center">
            {errorMessage}
          </Text>
        )}
      </Box>
    </Stack>
  );
};
