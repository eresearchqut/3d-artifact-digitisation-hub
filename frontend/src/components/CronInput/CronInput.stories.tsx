import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Box, Text, Stack } from '@chakra-ui/react';
import { CronInput } from './CronInput';

const meta: Meta<typeof CronInput> = {
  title: 'Components/CronInput',
  component: CronInput,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CronInput>;

// Controlled wrapper so the value actually updates in stories
const ControlledCronInput = (args: React.ComponentProps<typeof CronInput>) => {
  const [value, setValue] = useState(args.value ?? '* * * * *');
  return (
    <Stack gap={4}>
      <CronInput
        {...args}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Text fontFamily="mono" fontSize="sm" color="fg.muted">
        Value: <strong>{value}</strong>
      </Text>
    </Stack>
  );
};

export const Default: Story = {
  render: (args) => <ControlledCronInput {...args} />,
  args: {
    value: '* * * * *',
  },
};

export const Daily: Story = {
  render: (args) => <ControlledCronInput {...args} />,
  args: {
    value: '0 9 * * *',
  },
};

export const WeekdaysAt9am: Story = {
  render: (args) => <ControlledCronInput {...args} />,
  args: {
    value: '0 9 * * MON-FRI',
  },
};

export const EveryFiveMinutes: Story = {
  render: (args) => <ControlledCronInput {...args} />,
  args: {
    value: '*/5 * * * *',
  },
};

export const Disabled: Story = {
  render: (args) => (
    <Box>
      <CronInput {...args} />
    </Box>
  ),
  args: {
    value: '0 9 * * MON',
    disabled: true,
  },
};

export const ReadOnly: Story = {
  render: (args) => (
    <Box>
      <CronInput {...args} />
    </Box>
  ),
  args: {
    value: '0 0 1 * *',
    readOnly: true,
  },
};
