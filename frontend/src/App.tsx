import { useState, useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Heading, Flex, Box, Spinner } from '@chakra-ui/react';
import { Layout } from './components/Layout/Layout';
import { TourManager } from './contexts/PageTourContext';
import { UserListPage } from './pages/UserListPage';
import { TeamListPage } from './pages/TeamListPage';
import { TeamDetailPage } from './pages/TeamDetailPage';
import { AssetListPage } from './pages/AssetListPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { ShareViewerPage } from './pages/ShareViewerPage';
import { DashboardPage } from './pages/DashboardPage';
import { setBaseUrl } from './services/api.service';
import { AuthPage } from './components/AuthPage/AuthPage';

const queryClient: QueryClient = new QueryClient();

function App() {
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // runtime-config.json is written into the S3 bucket by CDK at deploy time
        // and contains the real API Gateway URL. In local dev the file won't exist,
        // so we fall back to VITE_MANAGEMENT_API_URL / localhost.
        // We check Content-Type before parsing: CloudFront's 403→200 SPA redirect
        // would return text/html (index.html) for a missing file — if we get HTML
        // back we skip it and use the env-var fallback.
        let apiUrl = (import.meta.env.VITE_MANAGEMENT_API_URL || 'http://localhost:3000').replace(/\/$/, '');
        try {
          const runtimeConfigResponse = await fetch('/runtime-config.json');
          const contentType = runtimeConfigResponse.headers.get('content-type') ?? '';
          if (runtimeConfigResponse.ok && contentType.includes('application/json')) {
            const runtimeData = await runtimeConfigResponse.json();
            if (runtimeData.apiUrl) {
              apiUrl = String(runtimeData.apiUrl).replace(/\/$/, '');
            }
          }
        } catch {
          // runtime-config.json not present (local dev) — use env var fallback
        }

        // Propagate the resolved URL to the API service so all subsequent
        // data fetches (assets, users, orgs, etc.) use the correct base URL.
        setBaseUrl(apiUrl);

        const response = await fetch(`${apiUrl}/config/amplify`);
        if (!response.ok) {
          throw new Error(`Failed to fetch config: ${response.statusText}`);
        }
        const data = await response.json();
        Amplify.configure({...data});
        setIsConfigured(true);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred while fetching configuration');
        }
      }
    };

    fetchConfig().then(() => console.debug('Amplify configured'));
  }, []);

  if (error) {
    return (
      <Flex align="center" justify="center" minH="100vh" bg="gray.50">
        <Box p={8} bg="white" borderRadius="lg" boxShadow="md" color="red.600">
          <Heading size="xl" mb={4}>Configuration Error</Heading>
          <p>{error}</p>
        </Box>
      </Flex>
    );
  }

  if (!isConfigured) {
    return (
      <Flex align="center" justify="center" minH="100vh" bg="gray.50">
        <Box color="gray.600">Loading configuration...</Box>
      </Flex>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        {/* Public route — accessible without authentication */}
        <Route path="/share/:shareId" element={<ShareViewerPage />} />

        {/* All other routes require authentication */}
        <Route path="/*" element={
          <Authenticator.Provider>
            <AuthenticatedApp />
          </Authenticator.Provider>
        } />
      </Routes>
    </QueryClientProvider>
  );
}

/** Reads auth state and renders either the custom login page or the app. */
function AuthenticatedApp() {
  const { authStatus, signOut } = useAuthenticator(ctx => [ctx.authStatus, ctx.signOut]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | undefined>(undefined);

  const handleSignOut = useCallback(() => {
    queryClient.clear();
    signOut();
  }, [queryClient, signOut]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    fetchAuthSession()
      .then((session) => {
        const emailClaim = session.tokens?.idToken?.payload?.['email'] as string | undefined;
        if (emailClaim) setEmail(emailClaim);
      })
      .catch(() => {});
  }, [authStatus]);

  if (authStatus === 'configuring') {
    return (
      <Flex align="center" justify="center" minH="100vh">
        <Spinner size="xl" />
      </Flex>
    );
  }

  if (authStatus !== 'authenticated') {
    return <AuthPage onAuthenticated={() => navigate('/')} />;
  }

  return (
    <TourManager>
      <Layout onSignOut={handleSignOut} email={email}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/team" element={<TeamListPage />} />
          <Route path="/team/:id" element={<TeamDetailPage />} />
          <Route path="/user" element={<UserListPage />} />
          <Route path="/asset" element={<AssetListPage />} />
          <Route path="/asset/:id" element={<AssetDetailPage />} />
        </Routes>
      </Layout>
    </TourManager>
  );
}

export default App;
