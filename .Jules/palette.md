## 2026-01-15 - Missing Labels in Modals
**Learning:** Found a systemic pattern of icon-only close buttons in modals lacking accessible names. The decorative icons in headers also lacked `aria-hidden="true"`, creating noise for screen readers.
**Action:** When auditing or creating modals, check the close button specifically. Consider extracting a shared `ModalHeader` component to enforce accessibility defaults (label, hidden decorative icons) globally.
