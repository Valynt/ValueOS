/**
 * Storybook Stories for UserNotifications Component
 */

import type { Meta, StoryObj } from '@storybook/react';
import { UserNotifications } from './UserNotifications';
import { settingsRegistry } from '../../lib/settingsRegistry';

const meta: Meta<typeof UserNotifications> = {
  title: 'Settings/UserNotifications',
  component: UserNotifications,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof UserNotifications>;

const mockUserId = 'user-123';

export const Default: Story = {
  args: {
    userId: mockUserId,
  },
};

export const AllEnabled: Story = {
  args: {
    userId: mockUserId,
  },
  play: async () => {
    await settingsRegistry.saveSetting('user.notifications.email', true, 'user', mockUserId);
    await settingsRegistry.saveSetting('user.notifications.push', true, 'user', mockUserId);
    await settingsRegistry.saveSetting('user.notifications.slack', true, 'user', mockUserId);
    await settingsRegistry.saveSetting('user.notifications.inApp', true, 'user', mockUserId);
  },
};

export const AllDisabled: Story = {
  args: {
    userId: mockUserId,
  },
  play: async () => {
    await settingsRegistry.saveSetting('user.notifications.email', false, 'user', mockUserId);
    await settingsRegistry.saveSetting('user.notifications.push', false, 'user', mockUserId);
    await settingsRegistry.saveSetting('user.notifications.slack', false, 'user', mockUserId);
    await settingsRegistry.saveSetting('user.notifications.inApp', false, 'user', mockUserId);
  },
};

export const EmailOnly: Story = {
  args: {
    userId: mockUserId,
  },
  play: async () => {
    await settingsRegistry.saveSetting('user.notifications.email', true, 'user', mockUserId);
    await settingsRegistry.saveSetting('user.notifications.push', false, 'user', mockUserId);
    await settingsRegistry.saveSetting('user.notifications.slack', false, 'user', mockUserId);
    await settingsRegistry.saveSetting('user.notifications.inApp', false, 'user', mockUserId);
  },
};
