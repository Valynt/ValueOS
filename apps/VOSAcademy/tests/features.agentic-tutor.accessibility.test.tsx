import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AgenticTutor from '../src/features/ai-tutor/AgenticTutor'

const mutateSpy = vi.fn()

vi.mock('@valueos/design-system', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))


vi.mock('streamdown', () => ({
  default: (content: string) => content,
}))

vi.mock('@/lib/trpc', () => ({
  trpc: {
    ai: {
      chat: {
        useMutation: () => ({ mutate: mutateSpy }),
      },
    },
  },
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

describe('AgenticTutor accessibility', () => {
  beforeEach(() => {
    mutateSpy.mockClear()
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('exposes a labeled send button and supports keyboard operation', async () => {
    const user = userEvent.setup()
    render(<AgenticTutor />)

    const sendButton = screen.getByRole('button', { name: /send message/i })
    expect(sendButton).toBeInTheDocument()
    expect(sendButton).toBeDisabled()

    const textInput = screen.getByPlaceholderText(/ask me anything about vos/i)
    await user.type(textInput, 'Help me prepare an ROI narrative')

    sendButton.focus()
    expect(sendButton).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(mutateSpy).toHaveBeenCalledTimes(1)

    const loadingSendButton = screen.getByRole('button', { name: /send message/i })
    expect(loadingSendButton).toBeDisabled()
  })

  it('sends on Enter and allows Shift+Enter newline in the textarea', async () => {
    const user = userEvent.setup()
    render(<AgenticTutor />)

    const textInput = screen.getByPlaceholderText(/ask me anything about vos/i)
    await user.type(textInput, 'Line 1')
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    await user.type(textInput, 'Line 2')

    expect(textInput).toHaveValue('Line 1\nLine 2')
    expect(mutateSpy).toHaveBeenCalledTimes(0)

    await user.keyboard('{Enter}')
    expect(mutateSpy).toHaveBeenCalledTimes(1)
  })
})
