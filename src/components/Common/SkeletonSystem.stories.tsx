import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
  SkeletonForm,
  SkeletonSidebar,
  SkeletonList,
  SkeletonContent,
} from "./SkeletonSystem";

const meta: Meta = {
  title: "Components/Skeleton",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Skeleton components provide consistent loading states that match the final layout to prevent layout shift (CLS < 0.1).",
      },
    },
  },
};

export default meta;

// Base Skeleton
export const BaseSkeleton: StoryObj = {
  render: () => (
    <div className="space-y-4">
      <Skeleton width="100%" height="1rem" />
      <Skeleton width="80%" height="1rem" />
      <Skeleton width="60%" height="1rem" />
    </div>
  ),
};

// Skeleton Variants
export const SkeletonVariants: StoryObj = {
  render: () => (
    <div className="flex space-x-4">
      <div>
        <h4 className="text-sm font-medium mb-2">Rectangular</h4>
        <Skeleton width={80} height={80} variant="rectangular" />
      </div>
      <div>
        <h4 className="text-sm font-medium mb-2">Circular</h4>
        <Skeleton width={80} height={80} variant="circular" />
      </div>
      <div>
        <h4 className="text-sm font-medium mb-2">Rounded</h4>
        <Skeleton width={80} height={80} variant="rounded" />
      </div>
    </div>
  ),
};

// Skeleton Text
export const TextSkeleton: StoryObj = {
  render: () => <SkeletonText lines={4} />,
};

// Skeleton Card
export const CardSkeleton: StoryObj = {
  render: () => (
    <div className="space-y-4">
      <SkeletonCard />
      <SkeletonCard showAvatar={false} />
      <SkeletonCard showActions={false} />
    </div>
  ),
};

// Skeleton Table
export const TableSkeleton: StoryObj = {
  render: () => <SkeletonTable rows={8} columns={5} />,
};

// Skeleton Form
export const FormSkeleton: StoryObj = {
  render: () => <SkeletonForm fields={6} />,
};

// Skeleton Sidebar
export const SidebarSkeleton: StoryObj = {
  render: () => (
    <div className="flex">
      <SkeletonSidebar />
      <div className="p-6">
        <h3 className="text-lg font-medium mb-4">Main Content</h3>
        <p className="text-gray-600">
          This is the main content area next to the sidebar.
        </p>
      </div>
    </div>
  ),
};

// Skeleton List
export const ListSkeleton: StoryObj = {
  render: () => (
    <div className="space-y-4">
      <SkeletonList items={5} showAvatars={true} />
      <SkeletonList items={3} showAvatars={false} />
    </div>
  ),
};

// Skeleton Content
export const ContentSkeleton: StoryObj = {
  render: () => <SkeletonContent />,
};

// Combined Layout
export const LayoutSkeleton: StoryObj = {
  render: () => (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <SkeletonSidebar className="fixed h-screen" />
        <div className="ml-64 flex-1 p-6">
          <div className="mb-6">
            <Skeleton height="2rem" width="300px" className="mb-2" />
            <Skeleton height="1rem" width="500px" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>

          <div className="bg-white rounded-lg p-6 shadow">
            <Skeleton height="1.5rem" width="200px" className="mb-4" />
            <SkeletonTable rows={10} columns={4} />
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: "fullscreen",
  },
};
