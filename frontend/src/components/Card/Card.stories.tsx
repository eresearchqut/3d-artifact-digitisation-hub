import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Button } from '../Button/Button';
import { Input } from '@chakra-ui/react';

const meta = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Card className="w-[350px]" {...args}>
      <CardHeader>
        <CardTitle>Create project</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Deploy your new project in one-click.
        </p>
        <form>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium">Name</label>
              <Input id="name" placeholder="Name of your project" />
            </div>
          </div>
        </form>
        <div className="flex justify-between mt-6">
          <Button variant="outline">Cancel</Button>
          <Button>Deploy</Button>
        </div>
      </CardContent>
    </Card>
  ),
};
