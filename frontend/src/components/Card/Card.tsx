import React, { forwardRef, type HTMLAttributes } from "react";
import { Card as ChakraCard } from "@chakra-ui/react";


export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <ChakraCard.Root
      ref={ref}
      className={className}
      {...props}
    >
      {children}
    </ChakraCard.Root>
  )
);
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <ChakraCard.Header
      ref={ref}
      className={className}
      {...props}
    >
      {children}
    </ChakraCard.Header>
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <ChakraCard.Title
      ref={ref}
      className={className}
      {...props}
    >
      {children}
    </ChakraCard.Title>
  )
);
CardTitle.displayName = "CardTitle";

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <ChakraCard.Body
      ref={ref}
      className={className}
      {...props}
    >
      {children}
    </ChakraCard.Body>
  )
);
CardContent.displayName = "CardContent";
