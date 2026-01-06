/**
 * Customer Layout Component Tests
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerContainer, CustomerLayout, CustomerSection } from '../CustomerLayout';

describe('CustomerLayout', () => {
  it('should render children when not loading', () => {
    render(
      <CustomerLayout companyName="Acme Corp">
        <div>Test Content</div>
      </CustomerLayout>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should display company name in header', () => {
    render(
      <CustomerLayout companyName="Acme Corp">
        <div>Content</div>
      </CustomerLayout>
    );

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Value Realization Portal')).toBeInTheDocument();
  });

  it('should display company logo when provided', () => {
    render(
      <CustomerLayout 
        companyName="Acme Corp" 
        companyLogo="https://example.com/logo.png"
      >
        <div>Content</div>
      </CustomerLayout>
    );

    const logo = screen.getByAlt('Acme Corp logo');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', 'https://example.com/logo.png');
  });

  it('should display loading state when loading prop is true', () => {
    render(
      <CustomerLayout loading={true}>
        <div>Content</div>
      </CustomerLayout>
    );

    expect(screen.getByText('Loading your value metrics...')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should display error state when error prop is provided', () => {
    const errorMessage = 'Invalid token';
    
    render(
      <CustomerLayout error={errorMessage}>
        <div>Content</div>
      </CustomerLayout>
    );

    expect(screen.getByText('Unable to Load Portal')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should display "Powered by ValueOS" in header', () => {
    render(
      <CustomerLayout>
        <div>Content</div>
      </CustomerLayout>
    );

    expect(screen.getByText('Powered by')).toBeInTheDocument();
    expect(screen.getByText('ValueOS')).toBeInTheDocument();
  });

  it('should display footer with links', () => {
    render(
      <CustomerLayout>
        <div>Content</div>
      </CustomerLayout>
    );

    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
  });

  it('should display current year in footer', () => {
    render(
      <CustomerLayout>
        <div>Content</div>
      </CustomerLayout>
    );

    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${currentYear}`))).toBeInTheDocument();
  });

  it('should display first letter of company name when no logo', () => {
    render(
      <CustomerLayout companyName="Acme Corp">
        <div>Content</div>
      </CustomerLayout>
    );

    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('should be responsive with proper container classes', () => {
    const { container } = render(
      <CustomerLayout>
        <div>Content</div>
      </CustomerLayout>
    );

    const main = container.querySelector('main');
    expect(main).toHaveClass('max-w-7xl', 'mx-auto', 'px-4', 'sm:px-6', 'lg:px-8');
  });
});

describe('CustomerSection', () => {
  it('should render section with title', () => {
    render(
      <CustomerSection title="Test Section">
        <div>Section Content</div>
      </CustomerSection>
    );

    expect(screen.getByText('Test Section')).toBeInTheDocument();
    expect(screen.getByText('Section Content')).toBeInTheDocument();
  });

  it('should render description when provided', () => {
    render(
      <CustomerSection 
        title="Test Section" 
        description="This is a test description"
      >
        <div>Content</div>
      </CustomerSection>
    );

    expect(screen.getByText('This is a test description')).toBeInTheDocument();
  });

  it('should not render description when not provided', () => {
    const { container } = render(
      <CustomerSection title="Test Section">
        <div>Content</div>
      </CustomerSection>
    );

    const descriptions = container.querySelectorAll('.text-sm.text-gray-500');
    expect(descriptions.length).toBe(0);
  });
});

describe('CustomerContainer', () => {
  it('should render children with proper spacing', () => {
    const { container } = render(
      <CustomerContainer>
        <div>Child 1</div>
        <div>Child 2</div>
      </CustomerContainer>
    );

    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
    
    const containerDiv = container.firstChild;
    expect(containerDiv).toHaveClass('space-y-6');
  });
});
