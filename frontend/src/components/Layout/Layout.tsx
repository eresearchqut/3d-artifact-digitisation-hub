import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, UserCircle, Globe, LogOut, HelpCircle, Menu } from 'lucide-react';
import { Box, Flex, VStack, HStack, Text, Heading, Icon, Button as ChakraButton, IconButton } from '@chakra-ui/react';
import { useTour } from 'modern-tour';

import { ColorModeButton } from '../ui/color-mode';
import { useIsAdmin } from '../../hooks/useIsAdmin';

interface LayoutProps {
  children: React.ReactNode;
  onSignOut?: () => void;
  email?: string;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

interface SidebarProps {
  navItems: NavItem[];
  onSignOut?: () => void;
  onNavClick?: () => void;
}

function getInitials(email?: string): string {
  if (!email) return '?';
  const local = email.split('@')[0];
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function Sidebar({ navItems, onSignOut, onNavClick }: SidebarProps) {
  return (
    <>
      <Box p="6">
        <Link to="/" onClick={onNavClick}>
          <Text fontSize="2xl" fontWeight="bold" color={{ base: 'blue.600', _dark: 'blue.400' }}>
            3D Hub
          </Text>
        </Link>
      </Box>
      <VStack as="nav" mt="6" px="4" gap="2" align="stretch" flex="1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            style={{ textDecoration: 'none' }}
            onClick={onNavClick}
          >
            {({ isActive }) => (
              <HStack
                px="4"
                py="2"
                borderRadius="lg"
                transition="all 0.2s"
                bg={isActive ? { base: 'blue.50', _dark: 'blue.900' } : 'transparent'}
                color={isActive ? { base: 'blue.600', _dark: 'blue.400' } : { base: 'gray.600', _dark: 'gray.400' }}
                _hover={!isActive ? { bg: { base: 'gray.50', _dark: 'gray.700' } } : undefined}
              >
                <Icon as={item.icon} boxSize="5" />
                <Text fontSize="sm" fontWeight="medium">{item.label}</Text>
              </HStack>
            )}
          </NavLink>
        ))}
      </VStack>
      <Box p="4" borderTop="1px solid" borderColor={{ base: 'gray.200', _dark: 'gray.700' }}>
        <ChakraButton
          variant="ghost"
          w="full"
          justifyContent="flex-start"
          css={{
            color: 'colors.gray.600',
            _dark: { color: 'colors.gray.400' },
            _hover: {
              bg: 'colors.red.50',
              color: 'colors.red.600',
              _dark: { bg: 'colors.red.950', color: 'colors.red.400' },
            },
          }}
          onClick={onSignOut}
        >
          <Icon as={LogOut} boxSize="5" mr="3" />
          Sign Out
        </ChakraButton>
      </Box>
    </>
  );
}

export const Layout: React.FC<LayoutProps> = ({ children, onSignOut, email }) => {
  const isAdmin = useIsAdmin();
  const { start } = useTour();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const navItems: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    ...(isAdmin ? [
      { to: '/team', label: 'Teams', icon: Users },
      { to: '/user', label: 'Users', icon: UserCircle },
    ] : []),
    { to: '/asset', label: 'Assets', icon: Globe },
  ];

  return (
    <Flex h="100dvh" bg={{ base: 'gray.100', _dark: 'gray.900' }}>
      {/* Desktop sidebar — hidden on mobile */}
      <Box
        as="aside"
        w="64"
        bg={{ base: 'white', _dark: 'gray.800' }}
        borderRight="1px solid"
        borderColor={{ base: 'gray.200', _dark: 'gray.700' }}
        display={{ base: 'none', md: 'flex' }}
        flexDirection="column"
        flexShrink={0}
      >
        <Sidebar navItems={navItems} onSignOut={onSignOut} />
      </Box>

      {/* Mobile nav drawer */}
      {isMobileNavOpen && (
        <>
          {/* Backdrop */}
          <Box
            position="fixed"
            inset="0"
            zIndex={1300}
            bg="blackAlpha.600"
            display={{ base: 'block', md: 'none' }}
            onClick={() => setIsMobileNavOpen(false)}
          />
          {/* Drawer */}
          <Box
            as="aside"
            position="fixed"
            top="0"
            left="0"
            h="full"
            w="64"
            bg={{ base: 'white', _dark: 'gray.800' }}
            zIndex={1400}
            display={{ base: 'flex', md: 'none' }}
            flexDirection="column"
            boxShadow="xl"
          >
            <Sidebar
              navItems={navItems}
              onSignOut={onSignOut}
              onNavClick={() => setIsMobileNavOpen(false)}
            />
          </Box>
        </>
      )}

      {/* Main content */}
      <Box as="main" flex="1" overflowY="auto" display="flex" flexDirection="column" minW="0">
        <Box
          as="header"
          bg={{ base: 'white', _dark: 'gray.800' }}
          borderBottom="1px solid"
          borderColor={{ base: 'gray.200', _dark: 'gray.700' }}
          position="sticky"
          top="0"
          zIndex="10"
        >
          <Flex px={{ base: 4, md: 8 }} py="4" align="center" justify="space-between" gap={3}>
            <HStack gap={3} minW="0">
              {/* Hamburger — mobile only */}
              <IconButton
                aria-label="Open navigation"
                variant="ghost"
                size="sm"
                display={{ base: 'flex', md: 'none' }}
                flexShrink={0}
                onClick={() => setIsMobileNavOpen(true)}
              >
                <Icon as={Menu} boxSize="5" />
              </IconButton>
              <Heading
                size={{ base: 'sm', md: 'md' }}
                color={{ base: 'gray.800', _dark: 'white' }}
                truncate
              >
                Management Console
              </Heading>
            </HStack>

            <HStack gap={{ base: 2, md: 4 }} flexShrink={0}>
              {/* Avatar + email */}
              <HStack gap="2">
                <Flex
                  h="8"
                  w="8"
                  borderRadius="full"
                  bg={{ base: 'blue.100', _dark: 'blue.900' }}
                  align="center"
                  justify="center"
                  color={{ base: 'blue.600', _dark: 'blue.400' }}
                  fontWeight="bold"
                  fontSize="xs"
                  flexShrink={0}
                >
                  {getInitials(email)}
                </Flex>
                {email && (
                  <Text
                    fontSize="sm"
                    color={{ base: 'gray.600', _dark: 'gray.400' }}
                    maxW={{ base: '100px', md: '200px' }}
                    truncate
                    display={{ base: 'none', sm: 'block' }}
                  >
                    {email}
                  </Text>
                )}
              </HStack>
              <Text
                fontSize="sm"
                color={{ base: 'gray.500', _dark: 'gray.400' }}
                display={{ base: 'none', lg: 'block' }}
              >
                v1.0.0
              </Text>
              <ColorModeButton />
              <IconButton
                aria-label="Start page tour"
                variant="ghost"
                size="sm"
                onClick={() => start()}
                title="Start page tour"
              >
                <Icon as={HelpCircle} boxSize="5" />
              </IconButton>
            </HStack>
          </Flex>
        </Box>
        <Box p={{ base: 4, md: 8 }} flex="1">
          {children}
        </Box>
      </Box>
    </Flex>
  );
};
