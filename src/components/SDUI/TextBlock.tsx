interface TextBlockProps {
  text: string;
  variant?: "default" | "heading" | "muted";
}

export function TextBlock({ text, variant = "default" }: TextBlockProps) {
  const variantClasses = {
    default: "text-neutral-300",
    heading: "text-white font-semibold text-lg",
    muted: "text-muted-foreground text-sm",
  };

  return (
    <div className={`${variantClasses[variant]} leading-relaxed`}>{text}</div>
  );
}

export default TextBlock;
