import React, { PropsWithChildren } from 'react';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import { render, RenderOptions } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';

type WrapperOptions = {
  route?: string;
  routerProps?: MemoryRouterProps;
  withAuthProvider?: boolean;
};

const Providers: React.FC<PropsWithChildren<WrapperOptions>> = ({
  children,
  route = '/',
  routerProps,
  withAuthProvider = true,
}) => {
  const content = withAuthProvider ? <AuthProvider>{children}</AuthProvider> : children;

  return (
    <MemoryRouter initialEntries={[route]} {...routerProps}>
      {content}
    </MemoryRouter>
  );
};

export function renderWithProviders(
  ui: React.ReactElement,
  options: WrapperOptions & RenderOptions = {}
) {
  const { route, routerProps, withAuthProvider = true, ...renderOptions } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <Providers route={route} routerProps={routerProps} withAuthProvider={withAuthProvider}>
        {children}
      </Providers>
    ),
    ...renderOptions,
  });
}

export * from '@testing-library/react';
