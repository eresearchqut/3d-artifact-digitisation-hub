import type { Meta, StoryObj } from '@storybook/react';
import { SplatViewer } from './SplatViewer';

const meta: Meta<typeof SplatViewer> = {
  title: 'Components/SplatViewer',
  component: SplatViewer,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof SplatViewer>;

export const Default: Story = {
  args: {
    url: 'https://huggingface.co/cakewalk/splat-data/resolve/main/train.splat', // Example remote URL
    width: '800px',
    height: '600px',
  },
};

export const CustomSize: Story = {
  args: {
    url: 'https://huggingface.co/cakewalk/splat-data/resolve/main/train.splat',
    width: '400px',
    height: '300px',
  },
};
