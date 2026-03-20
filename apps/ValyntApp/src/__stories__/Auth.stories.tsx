import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";

import { ModernLoginPage } from "../views/Auth/ModernLoginPage";
import { ModernSignupPage } from "../views/Auth/ModernSignupPage";
import { ResetPasswordPage } from "../views/Auth/ResetPasswordPage";

// ── Login ─────────────────────────────────────────────────────────────────────

const loginMeta: Meta<typeof ModernLoginPage> = {
  title: "Auth/Login",
  component: ModernLoginPage,
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  parameters: { layout: "fullscreen" },
};
export default loginMeta;

export const Default: StoryObj<typeof ModernLoginPage> = {};

// ── Signup ────────────────────────────────────────────────────────────────────

export const Signup: StoryObj = {
  render: () => (
    <MemoryRouter>
      <ModernSignupPage />
    </MemoryRouter>
  ),
};

// ── Reset Password ────────────────────────────────────────────────────────────

export const ResetPassword: StoryObj = {
  render: () => (
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>
  ),
};
