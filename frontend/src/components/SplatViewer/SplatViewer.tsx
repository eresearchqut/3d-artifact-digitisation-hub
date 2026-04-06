// @ts-nocheck
import React from 'react';
import * as Splat from '../ui/splat-viewer';

export interface SplatViewerProps {
  url: string;
  width?: string | number;
  height?: string | number;
}

export const SplatViewer: React.FC<SplatViewerProps> = ({ url, width = '100%', height = '500px' }) => {
  return (
    <div style={{ width, height, position: 'relative' }}>
      <Splat.Viewer 
        src={url} 
        autoPlay 
        className="rounded-t-lg lg:rounded-lg shadow-xl cursor-grab active:cursor-grabbing" 
      >
        <Splat.Controls autoHide>
          <div style={{ display: 'flex', gap: '0.25rem', pointerEvents: 'auto', flexGrow: 1 }}>
            <Splat.FullScreenButton />
            <Splat.DownloadButton />
          </div>
          <div style={{ display: 'flex', gap: '0.25rem', pointerEvents: 'auto' }}>
            <Splat.CameraModeToggle />
            <Splat.HelpButton />
            <Splat.MenuButton />
          </div>
        </Splat.Controls>
      </Splat.Viewer>
    </div>
  );
};
