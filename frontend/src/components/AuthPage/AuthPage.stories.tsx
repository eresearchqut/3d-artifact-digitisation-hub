import type { Meta, StoryObj } from '@storybook/react';
import { AuthPage } from './AuthPage';

const meta = {
  title: 'Components/AuthPage',
  component: AuthPage,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    initialScreen: {
      control: 'select',
      options: ['signIn', 'forgotPassword', 'confirmReset', 'forceNewPassword'],
      description: 'Which screen to display initially',
    },
    subtitle: {
      control: 'text',
      description: 'Subtitle shown below the hub name',
    },
    onAuthenticated: { action: 'authenticated' },
  },
} satisfies Meta<typeof AuthPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignIn: Story = {
  args: {
    initialScreen: 'signIn',
    subtitle: 'Management Console',
  },
};

export const SignInShareViewer: Story = {
  name: 'Sign In (Share Viewer)',
  args: {
    initialScreen: 'signIn',
    subtitle: 'Sign in to view this share',
  },
};

export const ForgotPassword: Story = {
  args: {
    initialScreen: 'forgotPassword',
    subtitle: 'Management Console',
  },
};

export const ConfirmResetPassword: Story = {
  args: {
    initialScreen: 'confirmReset',
    subtitle: 'Management Console',
  },
};

export const ForceNewPassword: Story = {
  args: {
    initialScreen: 'forceNewPassword',
    subtitle: 'Management Console',
  },
};
