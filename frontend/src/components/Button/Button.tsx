import React, { forwardRef, type ButtonHTMLAttributes } from "react";
import { Button as ChakraButton } from "@chakra-ui/react";


export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantMapping: Record<ButtonVariant, "solid" | "subtle" | "ghost" | "outline"> = {
  primary: "solid",
  secondary: "subtle",
  ghost: "ghost",
  danger: "solid",
  outline: "outline",
};

const colorMapping: Record<ButtonVariant, string> = {
  primary: "blue",
  secondary: "gray",
  ghost: "gray",
  danger: "red",
  outline: "gray",
};

const sizeMapping: Record<ButtonSize, "sm" | "md" | "lg" | "sm"> = {
  sm: "sm",
  md: "md",
  lg: "lg",
  icon: "md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", isLoading, disabled, children, ...props },
    ref
  ) => {
    return (
      <ChakraButton
        ref={ref}
        variant={variantMapping[variant]}
        colorPalette={colorMapping[variant]}
        size={sizeMapping[size]}
        loading={isLoading}
        disabled={disabled}
        className={className}
        {...props}
      >
        {children}
      </ChakraButton>
    );
  }
);

Button.displayName = "Button";
