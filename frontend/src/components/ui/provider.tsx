// @ts-nocheck
"use client"

import { ChakraProvider, defaultSystem, Toaster, Portal, Toast, Stack, Spinner } from "@chakra-ui/react"
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "./color-mode"
import { toaster } from "./toaster"

export function Provider(props: ColorModeProviderProps) {
  return (
    <ChakraProvider value={defaultSystem}>
      <ColorModeProvider {...props} />
      <Portal>
        <Toaster toaster={toaster} insetInline={{ mdDown: "4" }}>
          {(toast) => (
            <Toast.Root key={toast.id} width={{ md: "sm" }}>
              {toast.type === "loading" ? (
                <Spinner size="sm" color="blue.solid" />
              ) : (
                <Toast.Indicator />
              )}
              <Stack gap="1" flex="1" maxWidth="100%">
                {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
                {toast.description && (
                  <Toast.Description>{toast.description}</Toast.Description>
                )}
              </Stack>
              {toast.action && (
                <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
              )}
              {toast.closable && <Toast.CloseTrigger />}
            </Toast.Root>
          )}
        </Toaster>
      </Portal>
    </ChakraProvider>
  )
}
