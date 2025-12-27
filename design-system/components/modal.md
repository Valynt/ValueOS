# Modal Component

Modals interrupt the user workflow to demand attention or input. They appear on top of the main content (`elevation-level-2`).

## Variants

| Variant        | Visual               | Usage                                    |
| -------------- | -------------------- | ---------------------------------------- |
| **Default**    | `max-w-md` centered  | Confirmations, simple forms.             |
| **Large**      | `max-w-2xl` centered | Complex forms, detail views.             |
| **Fullscreen** | `inset-0`            | Heavy workflows (e.g., Template Editor). |
| **Drawer**     | Slides from Right    | Properties panels, drill-down details.   |

## Anatomy

1. **Overlay**: Semi-transparent black backdrop (`bg-black/50` backdrop-blur).
2. **Container**: The modal window (`bg-surface-3`).
3. **Title**: Clear header describing the task.
4. **Close Button**: "X" icon in top-right.
5. **Content**: The body.
6. **Actions**: Primary/Secondary buttons at bottom right.

## Behavior

- **Focus Trap**: Keyboard focus must stay inside the modal.
- **Escape Key**: Pressing `ESC` should close the modal.
- **Click Outside**: Clicking overlay should close (unless `persistent` prop is true).

## Usage Rules

✅ **DO** use for destructive confirmations ("Are you sure?").
✅ **DO** use for "Properties Drawers" in the canvas workflow.
❌ **DON'T** use for simple notifications (use Toast instead).

## Code Example

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Edit Profile</DialogTitle>
      <DialogDescription>Make changes to your profile here.</DialogDescription>
    </DialogHeader>
    <div className="grid gap-4 py-4">{/* Content */}</div>
    <DialogFooter>
      <Button type="submit">Save changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```
