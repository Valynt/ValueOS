# Consumer-Grade Shell Polish

Exact changes applied to the ValueOS shell. Apply these as a checklist when the shell feels "enterprise-heavy" or unrefined.

## Table of Contents
1. [Global CSS](#1-global-css)
2. [TopBar](#2-topbar)
3. [Sidebar](#3-sidebar)
4. [MainLayout — page transitions](#4-mainlayout--page-transitions)
5. [What not to do](#5-what-not-to-do)

---

## 1. Global CSS

Add to `globals.css` (or equivalent base stylesheet), inside `@layer base`:

```css
@layer base {
  /* Smooth font rendering — eliminates subpixel aliasing on macOS/retina */
  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  /* Thin, unobtrusive scrollbars */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: hsl(0 0% 80%);
    border-radius: 9999px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: hsl(0 0% 65%);
  }

  /* Prevent layout shift when scrollbar appears/disappears */
  body {
    scrollbar-gutter: stable;
  }
}
```

**Why:** Default browser scrollbars are visually heavy and break the calm aesthetic. `scrollbar-gutter: stable` prevents the 15px layout jump when content overflows.

---

## 2. TopBar

**Height:** `h-14` (56px) not `h-16` (64px). Saves 8px of vertical chrome.

**Border:** `border-zinc-100` not `border-zinc-200`. Lighter = less visual weight.

**Background:** `bg-white/95 backdrop-blur-sm` — subtle frosted glass when content scrolls under it.

**Buttons:**
- Notification icon: `min-h-9 min-w-9` (36px), icon `w-[17px] h-[17px]`
- Notification dot: `w-1.5 h-1.5` (6px) not `w-2 h-2` (8px)
- Primary CTA: `h-9` with `active:scale-[0.98]` micro-interaction

```tsx
// TopBar header element
<header className="h-14 border-b border-zinc-100 bg-white/95 backdrop-blur-sm flex items-center ...">

// Primary CTA button
<button className="... h-9 bg-zinc-950 text-white rounded-xl text-[13px] font-medium
  hover:bg-zinc-800 active:scale-[0.98] transition-all duration-150 whitespace-nowrap">
  <Sparkles className="w-3.5 h-3.5" />
  Ask Agent
</button>
```

**Tenant badge:** Remove role label from the badge — it adds noise. Keep only name + color dot.

```tsx
// Before (noisy)
<div className="... border-zinc-200 bg-zinc-50 ...">
  <span style={{ backgroundColor: tenant.color }} />
  <span>{tenant.name}</span>
  <span className="text-zinc-400 capitalize">{tenant.role}</span>  {/* remove */}
</div>

// After (clean)
<div className="... border-zinc-100 bg-zinc-50 text-zinc-500 ...">
  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tenant.color }} />
  <span>{tenant.name}</span>
</div>
```

---

## 3. Sidebar

**Border:** `border-zinc-100` throughout (header, footer, dividers). Not `border-zinc-200`.

**Header height:** Match TopBar — `h-14` not `h-16`.

**Nav items:**
- Height: `min-h-10` (40px) not `min-h-11` (44px)
- Transition: `transition-all duration-150` not just `transition-colors`
- Active state: add `shadow-sm` to the active pill for subtle depth
- Hover: `hover:bg-zinc-50` not `hover:bg-zinc-100` — lighter hover

```tsx
// Primary nav item
className={({ isActive }) => cn(
  "flex items-center gap-3 px-3 sm:px-4 min-h-10 rounded-xl text-[13px] font-medium transition-all duration-150",
  isActive
    ? "bg-zinc-950 text-white shadow-sm"
    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900",
)}

// Platform nav item
className={({ isActive }) => cn(
  "flex items-center gap-3 px-3 sm:px-4 min-h-10 rounded-xl text-[13px] font-medium transition-all duration-150",
  isActive
    ? "bg-zinc-100 text-zinc-900"
    : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700",
)}
```

**Collapse toggle:** Reduce from `w-11 h-11` to `w-6 h-6` — the large circle is visually dominant.

**User footer:**
- Border: `border-zinc-100`
- Avatar: `w-7 h-7 bg-zinc-950 rounded-full` (dark, not light) with white icon
- Email: `text-[12px]` not `text-[13px]`
- Role label: `text-[10px] uppercase tracking-[0.1em]`
- Sign out: `min-h-10`, `hover:bg-zinc-50`

---

## 4. MainLayout — page transitions

Add a `PageTransition` wrapper around `<Outlet />`. Uses CSS `transition-opacity` triggered by a `requestAnimationFrame` — no animation library required.

```tsx
function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [visible, setVisible] = useState(true);
  const prevKey = useRef(location.key);

  useEffect(() => {
    if (location.key !== prevKey.current) {
      prevKey.current = location.key;
      setVisible(false);
      requestAnimationFrame(() => setVisible(true));
    }
  }, [location.key]);

  return (
    <div className={cn(
      "transition-opacity duration-150 ease-out",
      visible ? "opacity-100" : "opacity-0"
    )}>
      {children}
    </div>
  );
}

// In MainLayout:
<main className="flex-1 overflow-y-auto overscroll-contain">
  <PageTransition>
    <Outlet />
  </PageTransition>
</main>
```

**Why `requestAnimationFrame` not `setTimeout(0)`:** rAF fires before the next paint, ensuring the opacity-0 frame is actually rendered before snapping back to opacity-1. `setTimeout(0)` can be batched and skipped.

**`overscroll-contain` on `<main>`:** Prevents scroll chaining to the body on mobile — the page doesn't bounce when you reach the bottom of a scrollable section.

---

## 5. What not to do

| Temptation | Why to avoid |
|---|---|
| Framer Motion for page transitions | 40KB+ for a 150ms fade. CSS transition is sufficient. |
| `border-zinc-200` everywhere | Creates a heavy grid-like feel. Use `zinc-100` for structural borders, `zinc-200` only for interactive elements (cards, inputs). |
| `min-h-11` (44px) for all interactive elements | Correct for touch targets on mobile, but sidebar nav items at 44px feel chunky on desktop. Use `min-h-10` for nav, `min-h-11` for primary actions. |
| Removing scrollbars entirely (`overflow: hidden`) | Breaks keyboard navigation and accessibility. Use thin styled scrollbars instead. |
| `backdrop-blur` on the sidebar | Expensive on low-end hardware. Reserve for the TopBar only (small surface area). |
| Animating `height` or `width` | Triggers layout — use `opacity` + `transform` only. |
