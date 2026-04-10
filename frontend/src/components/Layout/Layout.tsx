import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, UserCircle, Globe, LogOut } from 'lucide-react';
import { Box, Flex, VStack, HStack, Text, Heading, Icon } from '@chakra-ui/react';
import { Button } from '../Button/Button';
import { ColorModeButton } from '../ui/color-mode';
import { useIsAdmin } from '../../hooks/useIsAdmin';

interface LayoutProps {
  children: React.ReactNode;
  onSignOut?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onSignOut }) => {
  const isAdmin = useIsAdmin();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true, adminOnly: false },
    { to: '/team', label: 'Teams', icon: Users, adminOnly: true },
    { to: '/user', label: 'Users', icon: UserCircle, adminOnly: true },
    { to: '/asset', label: 'Assets', icon: Globe, adminOnly: false },
  ].filter((item) => !item.adminOnly || isAdmin);

  return (
    <Flex h="100vh" bg={{ base: 'gray.100', _dark: 'gray.900' }}>
      {/* Sidebar */}
      <Box
        as="aside"
        w="64"
        bg={{ base: 'white', _dark: 'gray.800' }}
        borderRight="1px solid"
        borderColor={{ base: 'gray.200', _dark: 'gray.700' }}
        position="relative"
        display="flex"
        flexDirection="column"
      >
        <Box p="6">
          <Link to="/">
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
                  <Text fontSize="sm" fontWeight="medium">
                    {item.label}
                  </Text>
                </HStack>
              )}
            </NavLink>
          ))}
        </VStack>
        <Box p="4" borderTop="1px solid" borderColor={{ base: 'gray.200', _dark: 'gray.700' }}>
          <Button
            variant="ghost"
            className="w-full justify-start text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
            onClick={onSignOut}
          >
            <Icon as={LogOut} boxSize="5" mr="3" />
            Sign Out
          </Button>
        </Box>
      </Box>

      {/* Main Content */}
      <Box as="main" flex="1" overflowY="auto" display="flex" flexDirection="column">
        <Box
          as="header"
          bg={{ base: 'white', _dark: 'gray.800' }}
          borderBottom="1px solid"
          borderColor={{ base: 'gray.200', _dark: 'gray.700' }}
          position="sticky"
          top="0"
          zIndex="10"
        >
          <Flex px="8" py="4" align="center" justify="space-between">
            <Heading size="md" color={{ base: 'gray.800', _dark: 'white' }}>
              Management Console
            </Heading>
            <HStack gap="4">
              <Text fontSize="sm" color={{ base: 'gray.500', _dark: 'gray.400' }}>
                v1.0.0
              </Text>
              <ColorModeButton />
              <Flex
                h="8"
                w="8"
                borderRadius="full"
                bg={{ base: 'blue.100', _dark: 'blue.900' }}
                align="center"
                justify="center"
                color={{ base: 'blue.600', _dark: 'blue.400' }}
                fontWeight="bold"
              >
                JS
              </Flex>
            </HStack>
          </Flex>
        </Box>
        <Box p="8" flex="1">
          {children}
        </Box>
      </Box>
    </Flex>
  );
};
