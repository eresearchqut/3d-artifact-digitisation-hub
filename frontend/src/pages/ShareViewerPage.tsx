import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchAuthSession, signIn } from 'aws-amplify/auth';
import { Authenticator } from '@aws-amplify/ui-react';
import { Box, Flex, Heading, Spinner, Text } from '@chakra-ui/react';
import { getBaseUrl } from '../services/api.service';

type Status = 'loading' | 'granted' | 'login' | 'forbidden' | 'notfound' | 'error';

// Sub-component: waits until the user is authenticated then calls onAuthenticated once.
function RetryOnAuth({
  user,
  onAuthenticated,
}: {
  user: object | undefined;
  onAuthenticated: () => void;
}) {
  const called = useRef(false);
  useEffect(() => {
    if (user && !called.current) {
      called.current = true;
      onAuthenticated();
    }
  }, [user, onAuthenticated]);
  return null;
}

function LoginPrompt({ onAuthenticated }: { onAuthenticated: () => void }) {
  const services = {
    async handleSignIn(input: { username: string; password?: string }) {
      return signIn({
        username: input.username,
        password: input.password,
        options: { authFlowType: 'USER_PASSWORD_AUTH' },
      });
    },
  };

  return (
    <Authenticator hideSignUp services={services}>
      {({ user }) => <RetryOnAuth user={user} onAuthenticated={onAuthenticated} />}
    </Authenticator>
  );
}

function CentredCard({ children }: { children: React.ReactNode }) {
  return (
    <Flex align="center" justify="center" minH="100vh" bg="gray.50">
      <Box p={8} bg="white" borderRadius="lg" boxShadow="md" textAlign="center" maxW="md" w="full">
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
      <CentredCard>
        <Heading size="md" mb={2}>Sign in to view this share</Heading>
        <Text color="gray.600" mb={6} fontSize="sm">
          This share requires authentication. Please sign in to continue.
        </Text>
        <LoginPrompt onAuthenticated={() => setRetry(r => r + 1)} />
      </CentredCard>
    );
  }

  if (status === 'forbidden') {
    return (
      <CentredCard>
        <Heading size="xl" mb={2} color="red.500">Access Denied</Heading>
        <Text color="gray.600">You do not have permission to view this share.</Text>
      </CentredCard>
    );
  }

  if (status === 'notfound') {
    return (
      <CentredCard>
        <Heading size="xl" mb={2} color="gray.500">Share Not Found</Heading>
        <Text color="gray.600">This share does not exist or has been removed.</Text>
      </CentredCard>
    );
  }

  if (status === 'error') {
    return (
      <CentredCard>
        <Heading size="xl" mb={2} color="red.500">Something went wrong</Heading>
        <Text color="gray.600">An unexpected error occurred. Please try again later.</Text>
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
