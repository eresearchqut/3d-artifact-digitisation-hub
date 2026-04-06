// @ts-nocheck
import * as React from "react"
import { useAssetViewer } from "./splat-viewer-context"
import { DialogRoot as Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../dialog"
import { DrawerRoot as Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "../drawer"
import { Table, Badge, Tabs, Card } from "@chakra-ui/react"
import { CameraModeToggle } from "./menu-button"

export function useMediaQuery(query: string) {
  const [value, setValue] = React.useState(false)

  React.useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches)
    }

    const result = matchMedia(query)
    result.addEventListener("change", onChange)
    setValue(result.matches)

    return () => result.removeEventListener("change", onChange)
  }, [query])

  return value
}
  
function CameraHelpTable() {
  const { mode } = useAssetViewer()

  return (
    <>
      <Tabs.Content {...{children: undefined} as any} value="keyboard">  
        { mode === "orbit" ? (
          <ControlSection controls={[
            ["Orbit", "Left Mouse"],
            ["Pan", "Right Mouse"],
            ["Zoom", "Mouse Wheel"],
            ["Reset View", <div className="flex gap-2 text-right" key="reset">
              <Badge variant="subtle">R</Badge>
            </div>],
          ]} />
        ) : (
          <ControlSection controls={[
            ["Orbit", "Left Mouse"],
            ["Forward / Backward", <div className="flex gap-2" key="forward-backward">
              <Badge variant="subtle" >W</Badge>
              <Badge variant="subtle" >S</Badge>
            </div>],
            ["Left / Right", <div className="flex gap-2" key="left-right">
              <Badge variant="subtle" >A</Badge>
              <Badge variant="subtle" >D</Badge>
            </div>],
            ["Up / Down", <div className="flex gap-2" key="up-down">
              <Badge variant="subtle" >Q</Badge>
              <Badge variant="subtle" >E</Badge>
            </div>],
            ["Reset View", <div className="flex gap-2" key="reset">
              <Badge variant="subtle">R</Badge>
            </div>],
          ]} />
        )}
      </Tabs.Content>
      <Tabs.Content {...{children: undefined} as any} value="touch">
        { mode === "orbit" ? (<ControlSection controls={[
          ["Orbit", "One Finger Drag"],
          ["Pan", "Two Finger Drag"],
          ["Zoom", "Pinch"],
          // ["Focus", "Double Tap"],
        ]} />) : (
          <ControlSection controls={[
            ["Look Around", "Touch on Right"],
            ["Fly", "Touch on Left"],
            ["Reset View", "Double Tap"],
          ]} />
        )}
      </Tabs.Content>
    </>
  )
}
  
function ControlSection({ controls }: { controls: [string, string | React.ReactNode][] }) {
  return (
    <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.ColumnHeader>Input</Table.ColumnHeader>
        <Table.ColumnHeader textAlign="right">Action</Table.ColumnHeader>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {controls.map(([label, key]) => (
        <Table.Row key={label}>
          <Table.Cell fontWeight="medium">{label}</Table.Cell>
          <Table.Cell display="flex" justifyContent="flex-end" color="fg.muted">{key}</Table.Cell>
        </Table.Row>
      ))}
    </Table.Body>
  </Table.Root>
  )
}
  
export function HelpDialog() {
  const { overlay, setOverlay } = useAssetViewer()
  const isDesktop = useMediaQuery("(min-width: 768px)")

  if (isDesktop) {
    return (
      <Dialog open={overlay === "help"} onOpenChange={() => setOverlay(null)}>
        <DialogContent {...{children: undefined} as any} className="max-w-md" aria-label="Camera Controls">
          <DialogHeader>
            <DialogTitle>Camera Controls</DialogTitle>
            <DialogDescription>Use these controls to navigate.</DialogDescription>
          </DialogHeader>
          <Card.Root className="p-2 my-2 opacity-90">
            <CameraModeToggle />
          </Card.Root>
          <Tabs.Root defaultValue="keyboard">
            <Tabs.List {...{children: undefined} as any} className="grid w-full grid-cols-2">
              <Tabs.Trigger {...{children: undefined} as any} value="keyboard" className="data-[state=active]:bg-background">Keyboard</Tabs.Trigger>
              <Tabs.Trigger {...{children: undefined} as any} value="touch" className="data-[state=active]:bg-background">Touch</Tabs.Trigger>
            </Tabs.List>
            <CameraHelpTable />
          </Tabs.Root>
        </DialogContent>
      </Dialog>
    )
  }
  
  return (
    <Drawer 
      open={overlay === "help"} 
      onOpenChange={() => setOverlay(null)} 
      >
      <DrawerContent {...{children: undefined} as any} className="min-h-[320px]">
        <div className="mx-auto w-full max-w-sm  pb-18">
          <DrawerHeader>
            <DrawerTitle>Controls</DrawerTitle>
            <DrawerDescription>Use these controls to navigate.</DrawerDescription>
          </DrawerHeader>
          <Card.Root className="p-2 m-4 my-2 opacity-90">
            <CameraModeToggle />
          </Card.Root>
          <div className="p-4">
            <Tabs.Root defaultValue="keyboard">
              <Tabs.List {...{children: undefined} as any} className="grid w-full grid-cols-2">
                <Tabs.Trigger {...{children: undefined} as any} value="keyboard" className="data-[state=active]:bg-background">Keyboard</Tabs.Trigger>
                <Tabs.Trigger {...{children: undefined} as any} value="touch" className="data-[state=active]:bg-background">Touch</Tabs.Trigger>
              </Tabs.List>
              <CameraHelpTable />
            </Tabs.Root>
          </div>
          <DrawerFooter>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}