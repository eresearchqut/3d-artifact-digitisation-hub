// @ts-nocheck
"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "../../Button/Button";
import { useAssetViewer } from "./splat-viewer-context";
import { Tooltip } from "../tooltip";

type DownloadButtonProps = {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
}

function DownloadButton({ variant = "ghost" }: DownloadButtonProps) {
  const { src, triggerDownload } = useAssetViewer(); // assume src is a URL string

  return (
    <Tooltip 
        content="Download" 
        contentProps={{ css: { "--tooltip-offset": "4px" } }}
    >
        <Button
            className="cursor-pointer pointer-events-auto"
            variant={variant} 
            size="icon"
            onClick={triggerDownload}
            disabled={!src}
            title="Download asset"
        >
            <DownloadIcon />
        </Button>
    </Tooltip>
  );
}

export { DownloadButton };