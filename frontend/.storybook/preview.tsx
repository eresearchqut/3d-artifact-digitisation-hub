import type { Preview } from "@storybook/react";
import React from "react";
import { Provider } from "../src/components/ui/provider";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    a11y: {
      test: "error",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "dark", value: "#09090b" },
      ],
    },
    layout: "centered",
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || "light";
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(theme);
      // We might want to pass theme to the Provider if it uses one, but standard Chakra provider will rely on the HTML class
      return (
        <Provider>
          <Story />
        </Provider>
      );
    },
  ],
  globalTypes: {
    theme: {
      description: "Global theme for components",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: ["light", "dark"],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;