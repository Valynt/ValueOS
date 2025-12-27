# Button Component

The standard interactive element for triggering actions.

## Variants

| Variant       | Visual                                 | Usage                                                     |
| ------------- | -------------------------------------- | --------------------------------------------------------- |
| **Primary**   | `bg-teal-500` text-white               | **Main Call-to-Action**. Use once per view.               |
| **Secondary** | `bg-surface-2` border `border-default` | **Alternative Actions**. Cancel, Back, secondary options. |
| **Outline**   | Transparent, border `border-default`   | Low priority actions, filters.                            |
| **Ghost**     | Transparent, no border                 | Subtle actions, typically in toolbars or dense lists.     |
| **Danger**    | `bg-red-500`                           | **Destructive Actions**. Delete, Remove.                  |

## Sizes

| Size             | Height | Padding | Text        |
| ---------------- | ------ | ------- | ----------- |
| **XS**           | `24px` | `px-1`  | `text-xs`   |
| **SM**           | `32px` | `px-2`  | `text-sm`   |
| **MD** (Default) | `40px` | `px-3`  | `text-sm`   |
| **LG**           | `48px` | `px-4`  | `text-base` |

## States

- **Default**: Standard appearance.
- **Hover**: Brightness shift (`110%` or lighter background). Cursor: pointer.
- **Active**: Scale down (`0.98`) to simulate press.
- **Disabled**: Opacity `0.5`, `cursor-not-allowed`, no pointer events.
- **Loading**: Shows `Loader2` spinner, text remains or is replaced by "Loading...".

## Usage Rules

✅ **DO** use consistent capitalization (Sentence case preferred).
✅ **DO** use icons (Left or Right) to clarify action meaning.
❌ **DON'T** use multiple Primary buttons in a single row (rule of thumb).

## Code Example

```tsx
import { Button } from "@/components/Common/Button";
import { Plus } from "lucide-react";

<Button
  variant="primary"
  size="md"
  leftIcon={<Plus className="w-4 h-4" />}
  onClick={handleAdd}
>
  Create New Case
</Button>;
```

## Accessibility (ARIA)

- Buttons automatically receive `role="button"`.
- If `loading`, receives `aria-busy="true"` and `aria-disabled="true"`.
- Icon-only buttons MUST provide an `aria-label` or `sr-only` text description.
