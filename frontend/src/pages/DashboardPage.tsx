import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Box, Button, Card, Flex, Heading, Stack, Text } from '@chakra-ui/react';
import { Globe, Users, UserCircle, Upload, Share2, Shield } from 'lucide-react';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { usePageTour } from '../hooks/usePageTour';
import { DASHBOARD_TOUR_STEPS } from '../constants/tourSteps';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  tips: string[];
  to: string;
}

function FeatureCard({ icon, title, description, tips, to }: FeatureCardProps) {
  return (
    <Card.Root height="full">
      <Card.Body>
        <Stack gap={4} height="full">
          <Flex align="center" gap={3}>
            <Box bg="colorPalette.muted" color="colorPalette.fg" p={2} borderRadius="md">
              {icon}
            </Box>
            <Card.Title fontSize="lg">{title}</Card.Title>
          </Flex>
          <Text color="fg.muted" fontSize="sm">{description}</Text>
          <Stack gap={1} flex={1}>
            {tips.map((tip) => (
              <Flex key={tip} align="flex-start" gap={2}>
                <Text color="colorPalette.fg" fontSize="xs" mt="1px">•</Text>
                <Text fontSize="sm" color="fg.subtle">{tip}</Text>
              </Flex>
            ))}
          </Stack>
          <Button asChild variant="outline" size="sm" mt={2}>
            <Link to={to}>Open {title}</Link>
          </Button>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

export const DashboardPage: React.FC = () => {
  const isAdmin = useIsAdmin();
  const steps = useMemo(() => DASHBOARD_TOUR_STEPS, []);
  usePageTour(steps);

  return (
    <Stack gap={8}>
      {/* Header */}
      <Stack gap={2} id="dashboard-heading">
        <Heading size="2xl" color="fg">3D Artifact Digitisation Hub — Management Console</Heading>
        <Text color="fg.muted" fontSize="lg">
          Upload, manage, and securely share 3D scanned artefacts.
        </Text>
      </Stack>

      {/* Overview */}
      <Card.Root bg="colorPalette.muted" borderWidth={0} id="dashboard-about">
        <Card.Body>
          <Stack gap={3}>
            <Heading size="md">About this tool</Heading>
            <Text color="fg.muted">
              The 3D Artifact Digitisation Hub lets you upload, manage, and securely share 3D scanned
              artefacts. Assets are stored in the cloud and can be viewed interactively in the browser.
              Access is controlled at the team and user level, and time-limited share links can be
              generated for external collaborators — with or without requiring a login.
            </Text>
          </Stack>
        </Card.Body>
      </Card.Root>

      {/* Feature cards */}
      <Stack gap={4} id="dashboard-features">
        <Heading size="md">What you can do</Heading>
        <Box
          display="grid"
          gridTemplateColumns={{ base: '1fr', md: isAdmin ? 'repeat(3, 1fr)' : '1fr' }}
          gap={4}
        >
          <FeatureCard
            icon={<Globe size={20} />}
            title="Assets"
            description="Upload and manage 3D artefact files. View them interactively in the browser and control who can access them."
            tips={[
              'Upload 3D scan files from the Assets page',
              'Click Manage on any asset to control access and shares',
              'Grant access to individual users or whole teams',
              'Create share links for external collaborators — optionally with an expiry date',
              'Use the Viewer to preview an asset in the browser',
            ]}
            to="/asset"
          />
          {isAdmin && (
            <FeatureCard
              icon={<Users size={20} />}
              title="Teams"
              description="Organise users into teams. Grant a team access to an asset and all its members inherit that access."
              tips={[
                'Create teams to group users with shared access needs',
                'Add or remove members from the team detail page',
                'Grant team-level access to assets from the asset detail page',
                'Revoking team access removes it for all members at once',
              ]}
              to="/team"
            />
          )}
          {isAdmin && (
            <FeatureCard
              icon={<UserCircle size={20} />}
              title="Users"
              description="Manage user accounts. Create logins, assign admin privileges, and reset passwords."
              tips={[
                'Create new user accounts with an email address',
                'Promote users to admin to grant full management access',
                'Reset a user\'s password and optionally force a change on next login',
                'Delete accounts that are no longer needed',
              ]}
              to="/user"
            />
          )}
        </Box>
      </Stack>

      {/* Quick tips */}
      <Card.Root id="dashboard-access-ref">
        <Card.Body>
          <Stack gap={3}>
            <Flex align="center" gap={2}>
              <Shield size={16} />
              <Heading size="sm">Access control quick reference</Heading>
            </Flex>
            <Box display="grid" gridTemplateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
              <Stack gap={1}>
                <Flex align="center" gap={2}>
                  <Upload size={14} />
                  <Text fontSize="sm" fontWeight="semibold">Uploading</Text>
                </Flex>
                <Text fontSize="sm" color="fg.muted">
                  Any authenticated user can upload assets. The uploader's identity is recorded.
                </Text>
              </Stack>
              <Stack gap={1}>
                <Flex align="center" gap={2}>
                  <Shield size={14} />
                  <Text fontSize="sm" fontWeight="semibold">Asset access</Text>
                </Flex>
                <Text fontSize="sm" color="fg.muted">
                  Access can be granted to named users or teams. Admins always have full access.
                </Text>
              </Stack>
              <Stack gap={1}>
                <Flex align="center" gap={2}>
                  <Share2 size={14} />
                  <Text fontSize="sm" fontWeight="semibold">Share links</Text>
                </Flex>
                <Text fontSize="sm" color="fg.muted">
                  Share links can be public (no login needed) or restricted to users with access. Set an expiry to limit availability.
                </Text>
              </Stack>
            </Box>
          </Stack>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
};
