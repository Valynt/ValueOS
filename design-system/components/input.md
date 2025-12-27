# Input Component

Text fields allow users to enter text into a UI. They typically appear in forms and dialogs.

## Variants

| Variant      | Visual                                   | Usage                                      |
| ------------ | ---------------------------------------- | ------------------------------------------ |
| **Default**  | Border `border-default`, `bg-surface-1`  | Standard text entry.                       |
| **Filled**   | `bg-surface-2`, no border initially      | Alternative for high-contrast backgrounds. |
| **Error**    | Border `border-error`, Text `text-error` | Validation failure.                        |
| **Disabled** | Opacity `0.5`, `cursor-not-allowed`      | Prevent entry.                             |

## Anatomy

1. **Label**: Descriptive title above input.
2. **Input Container**: The interactive box.
3. **Placeholder**: Hint text (optional).
4. **Help Text / Error Message**: Below the input.
5. **Icon (Leading/Trailing)**: Optional visual cues (e.g., Search icon, Eye icon).

## Sizes

| Size   | Height | Text Size           |
| ------ | ------ | ------------------- |
| **SM** | `32px` | `text-xs`           |
| **MD** | `40px` | `text-sm` (Default) |
| **LG** | `48px` | `text-base`         |

## States

- **Default**: Neutral border color.
- **Focus**: `ring-2` with `teal-500` (Primary glow).
- **Hover**: Darker border or slight background shift.

## Usage Rules

✅ **DO** provide a visible label for accessibility (or `aria-label` for search bars).
✅ **DO** use placeholder text for examples, not as a replacement for labels.
❌ **DON'T** use `30px` inputs for touch interfaces (too small).

## Code Example

```tsx
import { Input } from "@/components/Common/Input";
import { Search } from "lucide-react";

<Input
  label="Search Clients"
  placeholder="e.g. Acme Corp"
  leftIcon={<Search className="w-4 h-4" />}
  onChange={(e) => handleSearch(e.target.value)}
/>;
```
