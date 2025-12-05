/**
 * Storybook Stories for UserAppearance Component
 */

import type { Meta, StoryObj } from '@storybook/react';
import { UserAppearance } from './UserAppearance';
import { settingsRegistry } from '../../lib/settingsRegistry';

const meta: Meta<typeof UserAppearance> = {
  title: 'Settings/UserAppearance',
  component: UserAppearance,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof UserAppearance>;

// Mock settings data
const mockUserId = 'user-123';

export const Default: Story = {
  args: {
    userId: mockUserId,
  },
};

export const DarkTheme: Story = {
  args: {
    userId: mockUserId,
  },
  play: async () => {
    await settingsRegistry.saveSetting('user.theme', 'dark', 'user', mockUserId);
  },
};

export const LightTheme: Story = {
  args: {
    userId: mockUserId,
  },
  play: async () => {
    await settingsRegistry.saveSetting('user.theme', 'light', 'user', mockUserId);
  },
};

export const HighContrast: Story = {
  args: {
    userId: mockUserId,
  },
  play: async () => {
    await settingsRegistry.saveSetting('user.accessibility.highContrast', true, 'user', mockUserId);
  },
};

export const LargeFontSize: Story = {
  args: {
    userId: mockUserId,
  },
  play: async () => {
    await settingsRegistry.saveSetting('user.accessibility.fontSize', 'large', 'user', mockUserId);
  },
};

export const ReducedMotion: Story = {
  args: {
    userId: mockUserId,
  },
  play: async () => {
    await settingsRegistry.saveSetting('user.accessibility.reducedMotion', true, 'user', mockUserId);
  },
};
