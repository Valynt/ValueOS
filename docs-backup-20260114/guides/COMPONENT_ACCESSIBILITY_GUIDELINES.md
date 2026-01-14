# Component Accessibility Guidelines

This guide provides comprehensive accessibility requirements and patterns for ValueOS components to ensure WCAG 2.1 AA compliance across all user interfaces.

## Table of Contents

- [Core Principles](#core-principles)
- [Component Patterns](#component-patterns)
- [ARIA Guidelines](#aria-guidelines)
- [Keyboard Navigation](#keyboard-navigation)
- [Screen Reader Support](#screen-reader-support)
- [Color and Contrast](#color-and-contrast)
- [Testing Requirements](#testing-requirements)
- [Common Pitfalls](#common-pitfalls)

## Core Principles

### 1. Semantic HTML First
Always use native HTML elements with their built-in accessibility features before adding ARIA:

```tsx
// ✅ Good - Native button with built-in accessibility
<button onClick={handleSubmit}>Submit</button>

// ❌ Avoid - Div with button role
<div role="button" onClick={handleSubmit}>Submit</div>
```

### 2. Progressive Enhancement
Ensure functionality works without JavaScript and enhances with it:

```tsx
// ✅ Good - Form works without JavaScript
<form action="/submit" method="post">
  <button type="submit">Submit</button>
</form>

// ❌ Avoid - Requires JavaScript for basic functionality
<div onClick={handleSubmit}>Submit</div>
```

### 3. Keyboard First Design
All interactive elements must be keyboard accessible:

```tsx
// ✅ Good - Keyboard accessible
<button onKeyDown={handleKeyDown} onClick={handleClick}>
  Action
</button>

// ❌ Avoid - Mouse-only interaction
<div onMouseDown={handleMouseDown}>Action</div>
```

## Component Patterns

### Buttons

#### Standard Button
```tsx
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export function Button({ children, onClick, disabled, variant = 'primary' }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
      aria-disabled={disabled}
    >
      {children}
    </button>
  );
}
```

**Requirements:**
- Always use `<button>` element
- Include `aria-disabled` when disabled
- Provide visible focus indicator
- Support Enter/Space key activation

#### Icon Button
```tsx
interface IconButtonProps {
  icon: React.ReactNode;
  label: string; // Required for accessibility
  onClick?: () => void;
  disabled?: boolean;
}

export function IconButton({ icon, label, onClick, disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="icon-button"
    >
      {icon}
    </button>
  );
}
```

**Requirements:**
- Always provide `aria-label` describing the action
- Minimum touch target: 44x44px
- Visible focus indicator
- Support keyboard activation

### Form Controls

#### Input Field
```tsx
interface InputFieldProps {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export function InputField({
  id,
  label,
  type = 'text',
  required,
  error,
  placeholder,
  value,
  onChange
}: InputFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span className="required" aria-label="required">*</span>}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        aria-invalid={!!error}
        aria-describedby={errorId}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {error && (
        <div id={errorId} className="error-message" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
```

**Requirements:**
- Always associate labels with inputs (`htmlFor`/`id`)
- Use `aria-invalid` for validation errors
- Announce errors with `role="alert"`
- Provide clear error messages
- Support autocomplete when appropriate

#### Select Field
```tsx
interface SelectFieldProps {
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  error?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export function SelectField({
  id,
  label,
  options,
  required,
  error,
  value,
  onChange
}: SelectFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span className="required" aria-label="required">*</span>}
      </label>
      <select
        id={id}
        required={required}
        aria-invalid={!!error}
        aria-describedby={errorId}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <div id={errorId} className="error-message" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
```

### Navigation

#### Main Navigation
```tsx
interface NavigationProps {
  items: Array<{
    href: string;
    label: string;
    current?: boolean;
  }>;
}

export function Navigation({ items }: NavigationProps) {
  return (
    <nav aria-label="Main navigation">
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              aria-current={item.current ? 'page' : undefined}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

**Requirements:**
- Use `<nav>` with descriptive `aria-label`
- Use `aria-current="page"` for current page
- Maintain logical tab order
- Support keyboard navigation

#### Breadcrumbs
```tsx
interface BreadcrumbProps {
  items: Array<{
    href?: string;
    label: string;
    current?: boolean;
  }>;
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={index}>
            {item.href ? (
              <a href={item.href}>{item.label}</a>
            ) : (
              <span aria-current={item.current ? 'page' : undefined}>
                {item.label}
              </span>
            )}
            {index < items.length - 1 && (
              <span aria-hidden="true">/</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

### Modal Dialogs

#### Modal Component
```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Store previous focus
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus modal
      modalRef.current?.focus();

      // Trap focus
      const trapFocus = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          const focusableElements = modalRef.current?.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ) as NodeListOf<HTMLElement>;

          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }

        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', trapFocus);

      return () => {
        document.removeEventListener('keydown', trapFocus);
        // Restore focus
        previousFocusRef.current?.focus();
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="close-button"
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
```

**Requirements:**
- Use `role="dialog"` and `aria-modal="true"`
- Trap focus within modal
- Restore focus on close
- Support Escape key to close
- Provide close button with clear label

## ARIA Guidelines

### Landmarks
Use semantic landmarks to structure content:

```tsx
// ✅ Good landmark structure
<header role="banner">
  <nav aria-label="Main navigation">...</nav>
</header>

<main role="main">
  <section aria-labelledby="section-title">
    <h2 id="section-title">Section Title</h2>
  </section>
</main>

<aside role="complementary" aria-label="Sidebar">
  ...
</aside>

<footer role="contentinfo">
  ...
</footer>
```

### Live Regions
For dynamic content updates:

```tsx
// ✅ Polite announcements
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>

// ✅ Important announcements
<div aria-live="assertive" aria-atomic="true">
  {errorMessage}
</div>

// ✅ Loading states
<div aria-busy={isLoading}>
  {isLoading ? 'Loading...' : content}
</div>
```

### Descriptions and Relationships
```tsx
// ✅ Field descriptions
<input
  id="password"
  aria-describedby="password-help password-requirements"
/>
<div id="password-help">Enter a secure password</div>
<div id="password-requirements">Must be 8+ characters</div>

// ✅ Table headers
<table>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Email</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">John Doe</th>
      <td>john@example.com</td>
    </tr>
  </tbody>
</table>
```

## Keyboard Navigation

### Tab Order
Maintain logical tab order following visual layout:

```tsx
// ✅ Logical tab order
<div className="form">
  <input id="field1" />
  <input id="field2" />
  <button type="submit">Submit</button>
</div>

// ❌ Avoid - tabindex manipulation
<div className="form">
  <input id="field2" tabIndex={2} />
  <input id="field1" tabIndex={1} />
  <button type="submit" tabIndex={3}>Submit</button>
</div>
```

### Focus Management
```tsx
// ✅ Visible focus indicators
.focusable:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

// ✅ Skip links
<a href="#main-content" className="skip-link">
  Skip to main content
</a>

<main id="main-content">
  ...
</main>
```

### Keyboard Shortcuts
Provide keyboard alternatives for mouse actions:

```tsx
// ✅ Keyboard support for custom components
const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
    case ' ':
      e.preventDefault();
      activate();
      break;
    case 'ArrowDown':
      e.preventDefault();
      moveDown();
      break;
    case 'ArrowUp':
      e.preventDefault();
      moveUp();
      break;
  }
};
```

## Screen Reader Support

### Announcements
Provide meaningful announcements for actions:

```tsx
// ✅ Action announcements
const announceAction = (message: string) => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};
```

### Hidden Content
Use proper techniques for visually hidden content:

```css
/* ✅ Screen reader only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ❌ Avoid - display: none */
.hidden {
  display: none; /* Not accessible to screen readers */
}
```

## Color and Contrast

### Contrast Requirements
- Normal text: 4.5:1 minimum
- Large text (18pt+ or 14pt+ bold): 3:1 minimum
- Interactive elements: 3:1 minimum

```css
/* ✅ Sufficient contrast */
.text-primary {
  color: #000000; /* 21:1 ratio on white */
}

.text-secondary {
  color: #666666; /* 5.74:1 ratio on white */
}

/* ✅ Focus indicators */
.focus-visible:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}
```

### Don't Rely on Color Alone
Include additional indicators:

```tsx
// ✅ Multiple indicators
<div className={`status ${status}`}>
  <span className="status-icon" aria-hidden="true">●</span>
  <span className="status-text">{status}</span>
</div>

// ❌ Color only
<div className={`status-${status}`}>
  {status}
</div>
```

## Testing Requirements

### Automated Testing
All components must pass:

1. **axe-core scans** - Zero violations
2. **ESLint jsx-a11y rules** - No errors
3. **Unit tests** - Accessibility behavior coverage
4. **Visual regression** - Focus indicator testing

### Manual Testing Checklist
- [ ] Keyboard navigation works
- [ ] Screen reader announcements are correct
- [ ] Focus indicators are visible
- [ ] Color contrast meets requirements
- [ ] Touch targets are 44x44px minimum
- [ ] Forms work with assistive technology

### Test Templates
```tsx
// ✅ Component accessibility test
describe('Button Accessibility', () => {
  it('should be keyboard accessible', () => {
    render(<Button onClick={mockClick}>Test</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'button');

    // Test keyboard activation
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(mockClick).toHaveBeenCalled();
  });

  it('should announce disabled state', () => {
    render(<Button disabled>Test</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});
```

## Common Pitfalls

### 1. Missing Labels
```tsx
// ❌ Missing label
<input type="text" />

// ✅ Properly labeled
<label htmlFor="email">Email</label>
<input id="email" type="text" />
```

### 2. Positive Tabindex
```tsx
// ❌ Breaks natural tab order
<button tabIndex={1}>First</button>
<button tabIndex={2}>Second</button>

// ✅ Natural order
<button>First</button>
<button>Second</button>
```

### 3. Color-Only Information
```tsx
// ❌ Color only
<span className="error-red">Error</span>

// ✅ Multiple indicators
<span className="error">
  <span aria-hidden="true">❌</span>
  Error
</span>
```

### 4. Auto-focus Issues
```tsx
// ❌ Auto-focus without user control
<input autoFocus />

// ✅ User-controlled focus
const { ref, autoFocus } = useAutoFocus({ shouldFocus: true });
<input ref={ref} autoFocus={autoFocus} />
```

### 5. Missing Error Handling
```tsx
// ❌ No error announcement
{error && <div className="error">{error}</div>}

// ✅ Proper error announcement
{error && (
  <div role="alert" className="error">
    {error}
  </div>
)}
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)
- [axe-core Documentation](https://www.deque.com/axe/core-documentation/)
- [ARIA Authoring Practices](https://www.w3.org/TR/wai-aria-practices-1.1/)
- [WebAIM Checklist](https://webaim.org/standards/wcag/checklist)

## Review Process

All components must undergo accessibility review:

1. **Self-review** using this checklist
2. **Peer review** by accessibility champion
3. **Automated testing** verification
4. **Manual testing** with screen readers
5. **Documentation** of accessibility features

Remember: Accessibility is not optional—it's essential for creating inclusive products that work for everyone.
