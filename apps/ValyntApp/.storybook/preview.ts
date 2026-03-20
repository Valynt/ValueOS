import type { Preview } from "@storybook/react";
import "../src/styles/globals.css";

// Apply dark class to every story by default to match the app default.
const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#0a0a0a" },
        { name: "light", value: "#ffffff" },
      ],
    },
  },
  decorators: [
    (Story, context) => {
      const isDark = context.globals["theme"] !== "light";
      document.documentElement.classList.toggle("dark", isDark);
      return Story();
    },
  ],
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Global theme for components",
      defaultValue: "dark",
      toolbar: {
        icon: "circlehollow",
        items: ["dark", "light"],
        showName: true,
      },
    },
  },
};

export default preview;
