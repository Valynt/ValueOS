# Navigation Patterns

## Sidebar (Primary Navigation)

The sidebar provides access to the global sections of the application.

- **Width**: `240px` (Expanded) / `64px` (Collapsed).
- **Position**: Fixed Left.
- **Content**:
  1.  **Logo**: Top Left.
  2.  **Context Switcher** (Client/Project): Below Logo.
  3.  **Primary Links**: (Dashboard, Canvas, Settings).
  4.  **User Profile**: Bottom.

## Breadcrumbs (Secondary Navigation)

Show location depth.

- `Home > Project > Canvas`
- Use for "Wayfinding" in deep hierarchies.

## Tabs (Local Navigation)

Switch views within a specific context.

- **Visual**: Underline indicator (`border-b-2 border-teal-500`).
- **Usage**: "Impact View" vs "Financial View" on the same dataset.

## Drildown Patterns

For the "Canvas-to-Properties" flow:

1.  **Click** items on the Main Stage.
2.  **Slide out** the Right Drawer.
3.  **Preserve Context**: The main stage remains visible (dimmed) behind the drawer or resizes to fit.
