import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { siteService } from '../services/api.service';
import { ArrowLeft, Globe } from 'lucide-react';
import { Heading, Flex, Box, Stack, Text } from '@chakra-ui/react';
import { FilePicker } from '../components/FilePicker/FilePicker';

export const SiteDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const { data: site, isLoading, error } = useQuery({
    queryKey: ['site', id],
    queryFn: () => siteService.findOne(id!),
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
    if (extension !== '.ply' && extension !== '.mp3') {
      setUploadStatus('error');
      setErrorMessage('Unsupported file extension. Only .ply and .mp3 are supported.');
      return;
    }

    setUploadStatus('uploading');
    setErrorMessage('');

    try {
      // 1. Get presigned URL
      const { uploadUrl } = await siteService.generateUploadUrl(id, extension);
      
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
    return <Box textAlign="center" py={10} color="fg.muted">Loading site details...</Box>;
  }

  if (error || !site) {
    return (
      <Box color="red.500" textAlign="center" py={10}>
        Error loading site details
        <Box mt={4}>
          <Link to="/site" className="text-blue-500 hover:underline">
            Back to Sites
          </Link>
        </Box>
      </Box>
    );
  }

  return (
    <Stack gap={6}>
      <Flex align="center" gap={4}>
        <Link to="/site" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <Flex align="center" gap={3}>
          <Box bg="colorPalette.muted" p={2} borderRadius="md" color="colorPalette.fg">
            <Globe className="h-6 w-6" />
          </Box>
          <Heading size="2xl" color="fg">{site.name}</Heading>
        </Flex>
      </Flex>

      <Box bg="bg.panel" p={6} borderRadius="lg" borderWidth="1px" shadow="sm">
        <Heading size="lg" mb={4}>Upload Assets</Heading>
        <Text color="fg.muted" mb={6}>
          Upload a .ply or .mp3 asset file for this site. This will trigger the site builder process.
        </Text>
        
        <FilePicker 
          onFileSelect={handleFileSelect} 
          accept=".ply,.mp3"
          label="Upload .ply or .mp3 file"
          helperText="Drag and drop a .ply or .mp3 file here, or click to select (Max 500MB)"
        />

        {uploadStatus === 'uploading' && (
          <Text color="blue.500" mt={4} textAlign="center">
            Uploading...
          </Text>
        )}
        {uploadStatus === 'success' && (
          <Text color="green.500" mt={4} textAlign="center">
            File uploaded successfully! The site builder will start processing it shortly.
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
