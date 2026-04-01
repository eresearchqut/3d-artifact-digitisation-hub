import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { Heading } from '@chakra-ui/react';
import { Layout } from './Layout';

const meta = {
  title: 'Components/Layout',
  component: Layout,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof Layout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onSignOut: () => alert('Sign Out clicked'),
    children: (
      <div className="p-4 bg-white border border-dashed border-gray-300 rounded-lg">
        <Heading size="xl" className="mb-4">Page Content</Heading>
        <p className="text-gray-600">This is where the main content of the page goes.</p>
      </div>
    ),
  },
};
