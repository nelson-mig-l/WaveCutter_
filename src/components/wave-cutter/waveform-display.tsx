"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import type { Slice } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Scissors, Play, Pause, Repeat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { playAudio, stopAudio } from "@/lib/audio-utils";
import { cn } from "@/lib/utils";

interface WaveformDisplayProps {
  audioBuffer: AudioBuffer;
  slices: Slice[];
  onSlice: (start: number, end: number) => void;
  playingSliceId: string | null;
  setPlayingSliceId: (id: string | null) => void;
  playbackProgress: number | null;
  setPlaybackProgress: (progress: number | null) => void;
}

const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  audioBuffer,
  slices,
  onSlice,
  playingSliceId,
  setPlayingSliceId,
  playbackProgress,
  setPlaybackProgress,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const { toast } = useToast();

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0); // 0 to 1, representing scroll percentage

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;

    const computedStyle = getComputedStyle(document.documentElement);
    const primaryColor = `hsl(${computedStyle.getPropertyValue('--primary').trim()})`;
    const destructiveColor = `hsl(${computedStyle.getPropertyValue('--destructive').trim()})`;
    const accentColor = `hsl(${computedStyle.getPropertyValue('--accent').trim()})`;

    const dpr = window.devicePixelRatio || 1;
    const containerWidth = containerRef.current.clientWidth;
    const canvasWidth = containerWidth * zoom;
    const canvasHeight = 150;

    if (canvas.width !== canvasWidth * dpr || canvas.height !== canvasHeight * dpr) {
      canvas.width = canvasWidth * dpr;
      canvas.height = canvasHeight * dpr;
    }
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const middle = canvasHeight / 2;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const audioData = audioBuffer.getChannelData(0);
    
    // --- Waveform Drawing ---
    ctx.lineWidth = 2;
    ctx.strokeStyle = primaryColor;
    ctx.beginPath();
    
    const samplesPerPixel = audioBuffer.length / canvasWidth;

    for (let i = 0; i < canvasWidth; i++) {
        let min = 1.0;
        let max = -1.0;
        const startSample = Math.floor(i * samplesPerPixel);
        const endSample = Math.floor((i + 1) * samplesPerPixel);
        for (let j = startSample; j < endSample; j++) {
            const datum = audioData[j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        ctx.moveTo(i, (1 + min) * middle);
        ctx.lineTo(i, (1 + max) * middle);
    }
    ctx.stroke();

    // --- Overlay Drawing (Slices, Selection, Cursor) ---
    // These are drawn relative to the full canvas width
    
    // Draw selection
    if (selection) {
      ctx.fillStyle = playingSliceId === 'selection' || playingSliceId === 'selection_loop' ? 'rgba(120, 255, 120, 0.2)' : 'rgba(120, 255, 120, 0.1)';
      const startX = selection.start * canvasWidth;
      const endX = selection.end * canvasWidth;
      ctx.fillRect(startX, 0, endX - startX, canvasHeight);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, 0, endX - startX, canvasHeight);
    }
    
    // Draw slices
    slices.forEach((slice) => {
      const startX = (slice.start / audioBuffer.length) * canvasWidth;
      const endX = (slice.end / audioBuffer.length) * canvasWidth;
      
      if (playingSliceId === slice.id) {
          ctx.fillStyle = 'rgba(120, 255, 120, 0.2)';
          ctx.fillRect(startX, 0, endX - startX, canvasHeight);
      }
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, 0, endX - startX, canvasHeight);
    });

    // Draw playback cursor
    if (playbackProgress !== null && playingSliceId) {
        const x = playbackProgress * canvasWidth;
        ctx.strokeStyle = destructiveColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
    }

  }, [audioBuffer, slices, selection, playingSliceId, playbackProgress, zoom]);

  useEffect(() => {
    draw();
  }, [draw, pan]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);
  
  useEffect(() => {
    if(!playingSliceId) {
      setPlaybackProgress(null);
    }
  }, [playingSliceId, setPlaybackProgress]);

  const screenXToProgress = (screenX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const canvasWidth = containerRef.current.scrollWidth;
    return (screenX - rect.left + scrollLeft) / canvasWidth;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsSelecting(true);
    if(playingSliceId) {
        stopAudio();
        setPlayingSliceId(null);
    }
    setIsLooping(false);
    const start = screenXToProgress(e.clientX);
    setSelection({ start, end: start });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !selection) return;
    const end = screenXToProgress(e.clientX);
    setSelection({ start: Math.min(selection.start, end), end: Math.max(selection.start, end) });
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };
  
  const handleCreateSlice = () => {
    if(selection && selection.end - selection.start > 0.001) {
        onSlice(selection.start, selection.end);
        setSelection(null);
        setIsLooping(false);
    } else {
        toast({
            variant: "destructive",
            title: "Selection too small",
            description: "Click and drag on the waveform to make a selection."
        })
    }
  }

  const handlePlaySelection = (loop = false) => {
    if (!selection) return;

    const currentPlayingId = loop ? 'selection_loop' : 'selection';

    if (playingSliceId === currentPlayingId) {
      stopAudio();
      setPlayingSliceId(null);
      setIsLooping(false);
    } else {
      stopAudio();
      const startInSeconds = selection.start * audioBuffer.duration;
      const durationInSeconds = (selection.end - selection.start) * audioBuffer.duration;

      playAudio(
        audioBuffer,
        startInSeconds,
        durationInSeconds,
        loop,
        () => {
          setPlayingSliceId(null);
          setIsLooping(false);
        },
        (progressInSegment) => {
            const overallProgress = (startInSeconds + progressInSegment) / audioBuffer.duration;
            setPlaybackProgress(overallProgress);
        }
      );
      setPlayingSliceId(currentPlayingId);
      setIsLooping(loop);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = e.currentTarget;
    const maxScroll = scrollWidth - clientWidth;
    setPan(maxScroll > 0 ? scrollLeft / maxScroll : 0);
  };
  
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? Math.min(zoom * zoomFactor, 100) : Math.max(zoom / zoomFactor, 1);

    if (newZoom === zoom) return;

    const mouseX = e.clientX - container.getBoundingClientRect().left;
    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    
    const zoomTargetX = scrollLeft + mouseX;
    
    setZoom(newZoom);

    requestAnimationFrame(() => {
      const newScrollWidth = container.scrollWidth;
      const newScrollLeft = (zoomTargetX / scrollWidth) * newScrollWidth - mouseX;
      container.scrollLeft = newScrollLeft;
      const maxScroll = newScrollWidth - container.clientWidth;
      setPan(maxScroll > 0 ? newScrollLeft / maxScroll : 0);
    });
  }, [zoom, pan]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);


  return (
    <div className="flex flex-col gap-4">
      <div 
        ref={containerRef}
        className="relative h-[150px] overflow-x-auto"
        onScroll={handleScroll}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn("h-full cursor-crosshair", zoom > 1 ? "w-auto" : "w-full")}
          style={{ width: `${zoom * 100}%` }}
        />
      </div>
      {selection && (
          <div className="flex justify-end gap-2">
               <Button onClick={() => handlePlaySelection(false)} variant="outline">
                  {playingSliceId === 'selection' && !isLooping ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                  Play Selection
              </Button>
              <Button onClick={() => handlePlaySelection(true)} variant={playingSliceId === 'selection_loop' ? "default" : "outline"}>
                  <Repeat className="mr-2 h-4 w-4" />
                  Loop
              </Button>
              <Button onClick={handleCreateSlice}>
                  <Scissors className="mr-2 h-4 w-4" />
                  Create Slice
              </Button>
          </div>
      )}
    </div>
  );
};

export default WaveformDisplay;
