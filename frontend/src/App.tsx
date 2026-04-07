import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Authenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import { signIn } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';
import { Routes, Route } from 'react-router-dom';
import { Heading, Flex, Box } from '@chakra-ui/react';
import { Layout } from './components/Layout/Layout';
import { OrganisationListPage } from './pages/OrganisationListPage';
import { OrganisationDetailPage } from './pages/OrganisationDetailPage';
import { UserListPage } from './pages/UserListPage';
import { TeamListPage } from './pages/TeamListPage';
import { TeamDetailPage } from './pages/TeamDetailPage';
import { AssetListPage } from './pages/AssetListPage';

const queryClient: QueryClient = new QueryClient();

function App() {
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const apiUrl = import.meta.env.VITE_MANAGEMENT_API_URL || 'http://localhost:3000';
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

  const services = {
    async handleSignIn(input: any) {
      return signIn({
        username: input.username,
        password: input.password,
        options: {
          authFlowType: 'USER_PASSWORD_AUTH',
        },
      });
    },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Authenticator services={services}>
        {({ signOut, user }) => (
          <Layout onSignOut={signOut}>
            <Routes>
              <Route path="/" element={
                <Box spaceY={4}>
                  <Heading size="3xl">Welcome, {user?.username}</Heading>
                  <p style={{ color: "gray" }}>Select a resource from the sidebar to begin management.</p>
                </Box>
              } />
              <Route path="/organisation" element={<OrganisationListPage />} />
              <Route path="/organisation/:id" element={<OrganisationDetailPage />} />
              <Route path="/team" element={<TeamListPage />} />
              <Route path="/team/:id" element={<TeamDetailPage />} />
              <Route path="/user" element={<UserListPage />} />
              <Route path="/asset" element={<AssetListPage />} />
            </Routes>
          </Layout>
        )}
      </Authenticator>
    </QueryClientProvider>
  );
}

export default App;
