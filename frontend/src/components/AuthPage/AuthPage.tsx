import { useState } from 'react';
import {
  signIn,
  signOut as amplifySignOut,
  resetPassword,
  confirmResetPassword,
  confirmSignIn,
} from 'aws-amplify/auth';
import {
  Box,
  Button,
  Field,
  Flex,
  Group,
  Heading,
  HStack,
  Input,
  InputAddon,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

type Screen = 'signIn' | 'forgotPassword' | 'confirmReset' | 'forceNewPassword';

interface AuthPageProps {
  /** Optional subtitle shown below the hub name */
  subtitle?: string;
  /** Called after successful sign-in (useful for callback-based flows like ShareViewerPage) */
  onAuthenticated?: () => void;
  /** Initial screen to display — useful for Storybook and testing */
  initialScreen?: Screen;
}

export function AuthPage({ subtitle = 'Management Console', onAuthenticated, initialScreen = 'signIn' }: AuthPageProps) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const clearError = () => setError('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsLoading(true);
    try {
      const result = await signIn({
        username: email,
        password,
        options: { authFlowType: 'USER_PASSWORD_AUTH' },
      });
      if (result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        setScreen('forceNewPassword');
      } else if (result.isSignedIn) {
        onAuthenticated?.();
      }
    } catch (err: any) {
      // If already signed in as a different user, sign out first then inform the user
      if (err.name === 'UserAlreadyAuthenticatedException') {
        await amplifySignOut();
        setError('Session expired. Please sign in again.');
      } else {
        setError(err.message || 'Sign in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await confirmSignIn({ challengeResponse: newPassword });
      if (result.isSignedIn) {
        onAuthenticated?.();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to set new password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsLoading(true);
    try {
      await resetPassword({ username: email });
      setScreen('confirmReset');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      await confirmResetPassword({ username: email, confirmationCode: resetCode, newPassword });
      setScreen('signIn');
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setResetCode('');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = (dest: Screen = 'signIn') => {
    setScreen(dest);
    clearError();
  };

  const errorBox = error ? (
    <Box
      bg={{ base: 'red.50', _dark: 'red.950' }}
      borderWidth="1px"
      borderColor={{ base: 'red.200', _dark: 'red.800' }}
      borderRadius="md"
      p={3}
    >
      <Text fontSize="sm" color={{ base: 'red.600', _dark: 'red.400' }}>{error}</Text>
    </Box>
  ) : null;

  return (
    <Flex
      minH="100dvh"
      align={{ base: 'flex-start', md: 'center' }}
      justify="center"
      bg={{ base: 'bg', md: 'bg.subtle' }}
    >
      <Box
        w="full"
        maxW={{ base: 'full', md: '440px' }}
        minH={{ base: '100dvh', md: 'auto' }}
        bg="bg"
        borderWidth={{ base: '0', md: '1px' }}
        borderRadius={{ base: '0', md: 'xl' }}
        boxShadow={{ base: 'none', md: 'md' }}
        p={{ base: 6, md: 8 }}
      >
        {/* Brand header */}
        <Stack align="center" gap={1} mb={8}>
          <Heading size="xl" color={{ base: 'blue.600', _dark: 'blue.300' }}>
            3D Hub
          </Heading>
          {/* @ts-ignore */}
          <Text fontSize="sm" color="fg.muted" textAlign="center">{subtitle}</Text>
        </Stack>

        {/* ── Sign In ── */}
        {screen === 'signIn' && (
          <form onSubmit={handleSignIn}>
            <Stack gap={5}>
              <Heading size="md">Sign in to your account</Heading>
              {errorBox}
              <Field.Root>
                {/* @ts-ignore */}
                <Field.Label>Email</Field.Label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearError(); }}
                  required
                />
              </Field.Root>
              <Field.Root>
                {/* @ts-ignore */}
                <Field.Label>
                  <HStack justify="space-between" w="full">
                    <span>Password</span>
                    <Button
                      variant="plain"
                      size="xs"
                      color="blue.500"
                      fontWeight="normal"
                      p={0}
                      h="auto"
                      type="button"
                      onClick={() => goBack('forgotPassword')}
                    >
                      Forgot password?
                    </Button>
                  </HStack>
                </Field.Label>
                <Group attached w="full">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => { setPassword(e.target.value); clearError(); }}
                    required
                  />
                  <InputAddon>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </InputAddon>
                </Group>
              </Field.Root>
              <Button type="submit" colorPalette="blue" w="full" loading={isLoading}>
                Sign In
              </Button>
            </Stack>
          </form>
        )}

        {/* ── Force New Password ── */}
        {screen === 'forceNewPassword' && (
          <form onSubmit={handleForceNewPassword}>
            <Stack gap={5}>
              <Stack gap={1}>
                <Heading size="md">Set a new password</Heading>
                {/* @ts-ignore */}
                <Text fontSize="sm" color="fg.muted">You must set a new password before continuing.</Text>
              </Stack>
              {errorBox}
              <Field.Root>
                {/* @ts-ignore */}
                <Field.Label>New Password</Field.Label>
                <Group attached w="full">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); clearError(); }}
                    required
                  />
                  <InputAddon>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewPassword(v => !v)}>
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </InputAddon>
                </Group>
              </Field.Root>
              <Field.Root>
                {/* @ts-ignore */}
                <Field.Label>Confirm Password</Field.Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); clearError(); }}
                  required
                />
              </Field.Root>
              <Button type="submit" colorPalette="blue" w="full" loading={isLoading}>
                Set Password
              </Button>
            </Stack>
          </form>
        )}

        {/* ── Forgot Password ── */}
        {screen === 'forgotPassword' && (
          <form onSubmit={handleForgotPassword}>
            <Stack gap={5}>
              <HStack gap={2} align="center">
                <Button variant="ghost" size="sm" type="button" onClick={() => goBack('signIn')} p={1}>
                  <ArrowLeft size={16} />
                </Button>
                <Heading size="md">Reset your password</Heading>
              </HStack>
              {/* @ts-ignore */}
              <Text fontSize="sm" color="fg.muted">
                Enter your email and we'll send a code to reset your password.
              </Text>
              {errorBox}
              <Field.Root>
                {/* @ts-ignore */}
                <Field.Label>Email</Field.Label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearError(); }}
                  required
                />
              </Field.Root>
              <Button type="submit" colorPalette="blue" w="full" loading={isLoading}>
                Send Reset Code
              </Button>
            </Stack>
          </form>
        )}

        {/* ── Confirm Reset Password ── */}
        {screen === 'confirmReset' && (
          <form onSubmit={handleConfirmReset}>
            <Stack gap={5}>
              <Stack gap={1}>
                <Heading size="md">Enter new password</Heading>
                {/* @ts-ignore */}
                <Text fontSize="sm" color="fg.muted">
                  Check your email for the confirmation code.
                </Text>
              </Stack>
              {errorBox}
              <Field.Root>
                {/* @ts-ignore */}
                <Field.Label>Confirmation Code</Field.Label>
                <Input
                  placeholder="6-digit code"
                  value={resetCode}
                  onChange={e => { setResetCode(e.target.value); clearError(); }}
                  required
                />
              </Field.Root>
              <Field.Root>
                {/* @ts-ignore */}
                <Field.Label>New Password</Field.Label>
                <Group attached w="full">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); clearError(); }}
                    required
                  />
                  <InputAddon>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewPassword(v => !v)}>
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </InputAddon>
                </Group>
              </Field.Root>
              <Field.Root>
                {/* @ts-ignore */}
                <Field.Label>Confirm Password</Field.Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); clearError(); }}
                  required
                />
              </Field.Root>
              <Button type="submit" colorPalette="blue" w="full" loading={isLoading}>
                Reset Password
              </Button>
              <Button variant="ghost" size="sm" type="button" onClick={() => goBack('signIn')}>
                <ArrowLeft size={14} /> Back to Sign In
              </Button>
            </Stack>
          </form>
        )}
      </Box>
    </Flex>
  );
}
