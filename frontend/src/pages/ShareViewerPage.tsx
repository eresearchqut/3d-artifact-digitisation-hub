import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Box, Flex, Heading, Spinner, Text } from '@chakra-ui/react';
import { getBaseUrl } from '../services/api.service';
import { AuthPage } from '../components/AuthPage/AuthPage';

type Status = 'loading' | 'granted' | 'login' | 'forbidden' | 'notfound' | 'error';

function CentredCard({ children }: { children: React.ReactNode }) {
  return (
    <Flex align="center" justify="center" minH="100dvh" bg="bg.subtle">
      <Box p={8} bg="bg" borderWidth="1px" borderRadius="xl" boxShadow="md" textAlign="center" maxW="md" w="full">
        {children}
      </Box>
    </Flex>
  );
}

export function ShareViewerPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [iframeSrc, setIframeSrc] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!shareId) return;

    const checkAccess = async () => {
      setStatus('loading');

      let token: string | null = null;
      try {
        const session = await fetchAuthSession();
        token = session.tokens?.idToken?.toString() ?? null;
      } catch {
        // Not authenticated — fine for public shares.
      }

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
        const res = await fetch(`${getBaseUrl()}/share/${shareId}/index.html`, { headers });

        if (res.ok) {
          // Build the iframe URL; for private shares pass the token as a query param
          // so the iframe can authenticate when loading sub-resources.
          const src = token
            ? `${getBaseUrl()}/share/${shareId}/index.html?token=${encodeURIComponent(token)}`
            : `${getBaseUrl()}/share/${shareId}/index.html`;
          setIframeSrc(src);
          setStatus('granted');
        } else if (res.status === 403) {
          // No token means authentication is required; with a token it's a true access denial.
          setStatus(token ? 'forbidden' : 'login');
        } else if (res.status === 404) {
          setStatus('notfound');
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    };

    checkAccess();
  }, [shareId, retry]);

  if (status === 'loading') {
    return (
      <Flex align="center" justify="center" minH="100vh">
        <Spinner size="xl" />
      </Flex>
    );
  }

  if (status === 'login') {
    return (
      <AuthPage
        subtitle="Sign in to view this share"
        onAuthenticated={() => setRetry(r => r + 1)}
      />
    );
  }

  if (status === 'forbidden') {
    return (
      <CentredCard>
        <Heading size="xl" mb={2} color="red.500">Access Denied</Heading>
        <Text color="fg.muted">You do not have permission to view this share.</Text>
      </CentredCard>
    );
  }

  if (status === 'notfound') {
    return (
      <CentredCard>
        <Heading size="xl" mb={2} color="fg.muted">Share Not Found</Heading>
        <Text color="fg.muted">This share does not exist or has been removed.</Text>
      </CentredCard>
    );
  }

  if (status === 'error') {
    return (
      <CentredCard>
        <Heading size="xl" mb={2} color="red.500">Something went wrong</Heading>
        <Text color="fg.muted">An unexpected error occurred. Please try again later.</Text>
      </CentredCard>
    );
  }

  return (
    <iframe
      src={iframeSrc}
      title="Share Viewer"
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', border: 'none' }}
    />
  );
}
