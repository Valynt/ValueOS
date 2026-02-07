import React from "react";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  className?: string;
};

export const Skeleton: React.FC<SkeletonProps> = ({ className, children, ...props }) => {
  return (
    <div className={className} aria-hidden={true} {...props}>
      {children}
    </div>
  );
};
