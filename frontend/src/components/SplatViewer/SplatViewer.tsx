import React from 'react';
import { Box, Spinner, Center } from '@chakra-ui/react';

export interface SplatViewerProps {
  url: string;
  width?: string | number;
  height?: string | number;
}

export const SplatViewer: React.FC<SplatViewerProps> = ({ url, width = '100%', height = '500px' }) => {
  const [isLoading, setIsLoading] = React.useState(true);

  // Encode the URL so it can be passed safely via query parameters
  const iframeSrc = `/splat-viewer/index.html?url=${encodeURIComponent(url)}`;

  return (
    <Box position="relative" width={width} height={height} borderRadius="md" overflow="hidden" bg="black">
      {isLoading && (
        <Center position="absolute" top={0} left={0} right={0} bottom={0} zIndex={1}>
          <Spinner color="white" size="xl" />
        </Center>
      )}
      <iframe
        src={iframeSrc}
        title="Splat Viewer"
        width="100%"
        height="100%"
        style={{ border: 'none', position: 'absolute', zIndex: 2 }}
        onLoad={() => setIsLoading(false)}
        allow="autoplay; fullscreen; vr"
      />
    </Box>
  );
};
