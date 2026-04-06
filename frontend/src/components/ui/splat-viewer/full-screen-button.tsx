// @ts-nocheck
"use client";

import { MaximizeIcon, MinimizeIcon } from "lucide-react";
import { Button } from "../../Button/Button";
import { useAssetViewer } from "./splat-viewer-context";
import { Tooltip } from "../tooltip";

const FullScreenToggleIcon = ({ isFullscreen }: { isFullscreen: boolean }) => {
    return isFullscreen ? <MinimizeIcon /> : <MaximizeIcon />;
}

type FullScreenButtonProps = {
    variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
}

function FullScreenButton({ variant = "ghost" }: FullScreenButtonProps) {
    const { isFullscreen, toggleFullscreen } = useAssetViewer();

    return (
    <Tooltip 
        content={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"} 
        contentProps={{ css: { "--tooltip-offset": "4px" } }}
    >
        <Button className="cursor-pointer pointer-events-auto" variant={variant} size="icon" onClick={toggleFullscreen}>
            <FullScreenToggleIcon isFullscreen={isFullscreen} />
        </Button>
    </Tooltip>);
}

export { FullScreenButton };