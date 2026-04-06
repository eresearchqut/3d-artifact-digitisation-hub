// @ts-nocheck
"use client";

import { Button } from "../../Button/Button";
import { MenuRoot, MenuCheckboxItem, MenuContent, MenuItemGroup, MenuItem, MenuItemCommand, MenuRadioItemGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "../menu";
import { useMediaQuery } from "./help-dialog";
import { EllipsisVerticalIcon, DownloadIcon, MinimizeIcon, MaximizeIcon, HelpCircleIcon, Rotate3dIcon, Move3DIcon, RotateCcwIcon } from "lucide-react";
import { DrawerRoot as Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "../drawer";
import { useAssetViewer } from "./splat-viewer-context";
import { Card, Flex, Separator, Box } from "@chakra-ui/react";
import { Switch } from "../switch";
import { CameraMode } from "./splat-viewer";

function MenuItemsDesktop({
    mode,
    setMode,
    setOverlay,
    triggerDownload,
    toggleFullscreen,
    resetCamera
  }: ReturnType<typeof useAssetViewer>) {
    return (
      <>
        <MenuItemGroup {...{children: undefined} as any} title="Settings">
          <MenuSeparator />
          <MenuItem {...{children: undefined} as any} value="help" onClick={() => setOverlay("help")}>
            Help
            <MenuItemCommand>⇧F</MenuItemCommand>
          </MenuItem>
          <MenuItem {...{children: undefined} as any} value="download" onClick={() => triggerDownload()}>
            Download
            <MenuItemCommand>⇧⌘D</MenuItemCommand>
          </MenuItem>
          <MenuItem {...{children: undefined} as any} value="fullscreen" onClick={() => toggleFullscreen()}>
            Fullscreen
            <MenuItemCommand>⇧⌘F</MenuItemCommand>
          </MenuItem>
          <MenuItem {...{children: undefined} as any} value="reset" onClick={() => resetCamera()}>
            Reset View
            <MenuItemCommand>R</MenuItemCommand>
          </MenuItem>
          <MenuCheckboxItem {...{children: undefined} as any}
            value="auto-rotate"
            checked={true}
            disabled
          >
            Auto Rotate
            <MenuItemCommand>⇧⌘R</MenuItemCommand>
          </MenuCheckboxItem>
        </MenuItemGroup>
  
        <MenuSeparator />
        <MenuItemGroup {...{children: undefined} as any} title="Controls">
          <MenuRadioItemGroup value={mode} onValueChange={(e) => setMode(e.value as CameraMode)}>
            <MenuRadioItem {...{children: undefined} as any} value="orbit">
              Orbit
              <MenuItemCommand>⌘O</MenuItemCommand>
            </MenuRadioItem>
            <MenuRadioItem {...{children: undefined} as any} value="fly">
              Fly
              <MenuItemCommand>⌘F</MenuItemCommand>
            </MenuRadioItem>
          </MenuRadioItemGroup>
        </MenuItemGroup>
      </>
    )
  }

  export function CameraModeToggle() {
    const { mode, setMode } = useAssetViewer();

    const safeSetMode = (mode: string) => {
        if (mode === "orbit" || mode === "fly") {
            setMode(mode);
        }
    }

    return (
        <div className="flex items-center justify-between px-2 py-2 text-foreground">
            <div className="flex gap-1 flex-col">
                <span className="font-medium">Camera mode</span>
                <div className="text-muted-foreground text-xs">
                    { mode === "orbit" && <span>Great for inspecting an object.</span> }
                    { mode === "fly" && <span>Ideal for navigating larger scenes.</span> }
                </div>
            </div>
            <Flex className="bg-muted p-1 rounded-lg">
                <Box 
                    as="button"
                    onClick={() => safeSetMode("orbit")}
                    className={`px-3 py-1 rounded-md cursor-pointer ${mode === "orbit" ? "bg-background shadow-sm" : ""}`}>
                    <Rotate3dIcon />
                </Box>
                <Box 
                    as="button"
                    onClick={() => safeSetMode("fly")}
                    className={`px-3 py-1 rounded-md cursor-pointer ${mode === "fly" ? "bg-background shadow-sm" : ""}`}>
                    <Move3DIcon />
                </Box>
            </Flex>
        </div>
    )
  }

  function MenuItemsMobile({
    setOverlay,
    triggerDownload,
    toggleFullscreen,
    isFullscreen,
    autoRotate,
    setAutoRotate,
    resetCamera
  }: ReturnType<typeof useAssetViewer>) {
    return (
      <div className="space-y-2 text-sm">
        
        <Card.Root className="m-4 px-2 py-2">
            <CameraModeToggle />
        </Card.Root>

        {/* Auto rotate */}
        <Card.Root className="m-4 mb-8 p-4">
            <div className="flex items-center justify-between ">
                <div className="flex flex-col gap-1">
                    <span className="font-medium">Auto rotate</span>
                    <span className="text-muted-foreground text-xs">
                        { autoRotate 
                            ? <span>Automatically rotate the camera around the object.</span> 
                            : <span>Disable automatic rotation.</span> 
                        }
                    </span>
                </div>
                <Switch checked={autoRotate} onCheckedChange={(e) => {
                    setAutoRotate(e.checked);
                    setOverlay(null);
                }}/>
            </div>
        </Card.Root>

        <Separator />
        
        <div className="p-2 text-sm">
          <h4 className="my-2 mb-4 text-muted-foreground text-xs font-semibold px-2">Settings</h4>
          <Button variant="ghost" onClick={() => setOverlay("help")} className="w-full justify-between">
            Help
            <MenuItemCommand>
                <HelpCircleIcon />
            </MenuItemCommand>
          </Button>
          <Button variant="ghost" className="w-full justify-between" onClick={() => {
            triggerDownload();
            setOverlay(null);
          }}>
            Download
            <MenuItemCommand>
                <DownloadIcon />
            </MenuItemCommand>
          </Button>
          <Button variant="ghost" className="w-full justify-between" onClick={() => {
            toggleFullscreen();
            setOverlay(null);
          }}>
            { isFullscreen ? "Exit Fullscreen" : "Fullscreen" }
            <MenuItemCommand>
                { isFullscreen ? <MinimizeIcon /> : <MaximizeIcon /> }
            </MenuItemCommand>
          </Button>
          <Button variant="ghost" className="w-full justify-between" onClick={() => {
            resetCamera();
            setOverlay(null);
          }}>
            Reset View
            <MenuItemCommand>
                <RotateCcwIcon />
            </MenuItemCommand>
          </Button>
        </div>
      </div>
    )
  }

function MenuButton() {

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const props = useAssetViewer();
  const {overlay, setOverlay} = props
  
    if (isDesktop) {
        return (
            <MenuRoot>
                <MenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="cursor-pointer pointer-events-auto">
                      <EllipsisVerticalIcon />
                    </Button>
                </MenuTrigger>
                <MenuContent className="w-56">
                    <MenuItemsDesktop {...props} />
                </MenuContent>
            </MenuRoot>
        )
    }

    return (
    <>
        <Button variant="ghost" size="icon" className="cursor-pointer pointer-events-auto" onClick={() => setOverlay("settings")}>
            <EllipsisVerticalIcon />
        </Button>
        <Drawer open={overlay === "settings"} onOpenChange={() => setOverlay(null)}>
        <DrawerContent>
            <div className="mx-auto w-full max-w-md px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
                <DrawerHeader>
                    <DrawerTitle>Settings</DrawerTitle>
                    <DrawerDescription>Viewer options and controls.</DrawerDescription>
                </DrawerHeader>
                <MenuItemsMobile {...props} />
                <DrawerFooter>
                </DrawerFooter>
            </div>
        </DrawerContent>
        </Drawer>
    </>
    )   
}

export { MenuButton };