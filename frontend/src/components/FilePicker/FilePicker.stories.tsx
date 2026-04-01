import type { Meta, StoryObj } from "@storybook/react";
import { FilePicker } from "./FilePicker";

const meta: Meta<typeof FilePicker> = {
  title: "Components/FilePicker",
  component: FilePicker,
  tags: ["autodocs"],
  argTypes: {
    onFileSelect: { action: "fileSelected" },
  },
};

export default meta;
type Story = StoryObj<typeof FilePicker>;

export const Default: Story = {
  args: {
    label: "Upload a file",
    helperText: "Drag and drop a file here, or click to select",
  },
};

export const CustomLabels: Story = {
  args: {
    label: "Upload Profile Picture",
    helperText: "PNG, JPG up to 5MB",
    accept: "image/*",
  },
};
