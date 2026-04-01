import React, { forwardRef, type HTMLAttributes } from "react";
import { Badge as ChakraBadge } from "@chakra-ui/react";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

const variantMapping: Record<BadgeVariant, "solid" | "subtle" | "outline" | "surface"> = {
  default: "solid",
  secondary: "subtle",
  destructive: "solid",
  outline: "outline",
};

const colorMapping: Record<BadgeVariant, string> = {
  default: "blue",
  secondary: "gray",
  destructive: "red",
  outline: "gray",
};

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <ChakraBadge
        ref={ref}
        variant={variantMapping[variant]}
        colorPalette={colorMapping[variant]}
        className={className}
        {...props}
      >
        {children}
      </ChakraBadge>
    );
  }
);

Badge.displayName = "Badge";
