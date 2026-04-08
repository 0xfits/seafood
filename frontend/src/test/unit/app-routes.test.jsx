import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: {
      changeLanguage: vi.fn(),
    },
  }),
}))

vi.mock('../../pages/HomePage', () => ({
  default: () => <div>home page content</div>,
}))

vi.mock('../../pages/RewardPage', () => ({
  default: () => <div>reward page content</div>,
}))

vi.mock('../../pages/TaskPage', () => ({
  default: () => <div>task page content</div>,
}))

vi.mock('../../pages/ProfilePage', () => ({
  default: () => <div>profile page content</div>,
}))

vi.mock('../../pages/DashboardPage', () => ({
  default: () => <div>dashboard page content</div>,
}))

vi.mock('../../pages/ShardPage', () => ({
  default: () => <div>shard page content</div>,
}))

vi.mock('../../pages/AuthPage', () => ({
  default: ({ mode }) => <div>{mode} auth page</div>,
}))

vi.mock('../../components/Header', () => ({
  default: () => <div>site header</div>,
}))

vi.mock('../../components/Footer', () => ({
  default: () => <div>site footer</div>,
}))

vi.mock('../../components/LoginModal', () => ({
  default: () => null,
}))

vi.mock('../../components/layout/AdminLayout', () => ({
  default: () => <div>admin layout</div>,
}))

vi.mock('../../admin-utils', () => ({
  fetchAdminAccess: vi.fn(),
  hasAdminPermission: vi.fn(() => false),
}))

vi.mock('../../auth-context', () => ({
  useAuth: vi.fn(),
}))

import App from '../../App'
import { useAuth } from '../../auth-context'

describe('App routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
    })
  })

  it('renders the home route without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('site header')).toBeInTheDocument()
    expect(screen.getByText('home page content')).toBeInTheDocument()
    expect(screen.getByText('site footer')).toBeInTheDocument()
  })

  it('renders the login route through the auth page', () => {
    render(
      <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('login auth page')).toBeInTheDocument()
  })
})
