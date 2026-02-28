import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

// Helper: create a mock lucide-react icon as a proper forwardRef component
function createMockIcon(displayName: string) {
  const Icon = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
    (props, ref) => (
      <svg ref={ref} data-testid={`icon-${displayName}`} {...props}>
        <title>{displayName}</title>
      </svg>
    ),
  )
  Icon.displayName = displayName
  return Icon
}

// Build the mock
