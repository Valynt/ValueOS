/**
 * ValueOS UI Components
 *
 * Base component library following the ValueOS design system.
 */

// Button
export { Button, buttonVariants } from "./button";
export type { ButtonProps } from "./button";

// Input
export { Input, inputVariants, SearchInput, Textarea } from "./input";
export type { InputProps, SearchInputProps, TextareaProps } from "./input";

// Card
export {
  Card,
  cardVariants,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  MetricCard,
  ActionCard,
} from "./card";
export type { CardProps, MetricCardProps, ActionCardProps } from "./card";

// Badge
export { Badge, badgeVariants, StatusBadge, VerificationBadge, CountBadge } from "./badge";
export type {
  BadgeProps,
  StatusType,
  StatusBadgeProps,
  VerificationBadgeProps,
  CountBadgeProps,
} from "./badge";

// Avatar
export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  avatarVariants,
  UserAvatar,
  AvatarGroup,
} from "./avatar";
export type { AvatarProps, UserAvatarProps, AvatarGroupProps } from "./avatar";

// Select
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SimpleSelect,
} from "./select";
export type { SimpleSelectOption, SimpleSelectProps } from "./select";

// Dialog
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  ConfirmDialog,
  AlertDialog,
} from "./dialog";
export type { ConfirmDialogProps, AlertDialogProps } from "./dialog";

// Re-export existing components
export { Label } from "./label";
export { Progress } from "./progress";
export { RadioGroup, RadioGroupItem } from "./radio-group";
export { ScrollArea } from "./scroll-area";
export { Alert, AlertDescription } from "./alert";
export { Separator } from "./separator";

// Skeleton
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonButton,
  skeletonVariants,
} from "./skeleton";
export type { SkeletonProps } from "./skeleton";
