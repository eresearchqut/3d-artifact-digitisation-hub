// @ts-nocheck
"use client";

import { Slider } from "../slider";
import { useTimeline } from "./splat-viewer-context";
import { Button } from "../../Button/Button";
import { PauseIcon, PlayIcon } from "lucide-react";
import { Tooltip } from "../tooltip";

function PlayButton() {

    const { setIsPlaying, isPlaying } = useTimeline();

    return (
        <Tooltip 
            content={isPlaying ? "Pause" : "Play"} 
            contentProps={{ css: { "--tooltip-offset": "4px" } }}
        >
            <Button size='icon' variant='ghost' className="cursor-pointer" onClick={() => setIsPlaying(!isPlaying)}>
                { isPlaying ? <PauseIcon /> : <PlayIcon /> }
            </Button>
        </Tooltip>
    )
}

function Timeline() {
    
    const { getTime, setTime, setIsPlaying, onCommit } = useTimeline();

    const onValueChange = (e: { value: number[] }) => {
        setIsPlaying(false);
        setTime(e.value[0]);
    };
    
    const onValueChangeEnd = (e: { value: number[] }) => {
        onCommit?.(e.value[0]);
    }

    return (<>
        <PlayButton />
        <Slider 
            defaultValue={[getTime()]} 
            max={1} 
            min={0} 
            step={0.001} 
            onValueChange={onValueChange} 
            onValueChangeEnd={onValueChangeEnd}
        />
    </>)
}   

export { Timeline };