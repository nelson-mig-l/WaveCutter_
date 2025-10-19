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
  const [pan, setPan] = useState(0); // 0 to 1

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const audioData = audioBuffer.getChannelData(0);

    const computedStyle = getComputedStyle(document.documentElement);
    const primaryColor = `hsl(${computedStyle.getPropertyValue('--primary').trim()})`;
    const destructiveColor = `hsl(${computedStyle.getPropertyValue('--destructive').trim()})`;
    const accentColor = `hsl(${computedStyle.getPropertyValue('--accent').trim()})`;

    const dpr = window.devicePixelRatio || 1;
    const containerWidth = containerRef.current.clientWidth;
    const canvasWidth = containerWidth * zoom;
    const canvasHeight = 150; // Fixed height

    if (canvas.width !== canvasWidth * dpr || canvas.height !== canvasHeight * dpr) {
        canvas.width = canvasWidth * dpr;
        canvas.height = canvasHeight * dpr;
    }
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const middle = canvasHeight / 2;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    const scrollLeft = pan * (canvasWidth - containerWidth);
    const viewStartSample = (scrollLeft / canvasWidth) * audioBuffer.length;
    const viewEndSample = viewStartSample + (containerWidth / canvasWidth) * audioBuffer.length;
    
    const samplesPerPixel = (viewEndSample - viewStartSample) / containerWidth;

    const sampleToX = (sample: number) => {
        return ((sample - viewStartSample) / (viewEndSample - viewStartSample)) * containerWidth;
    }

    // Draw selection
    if (selection) {
      ctx.fillStyle = playingSliceId === 'selection' || playingSliceId === 'selection_loop' ? 'rgba(120, 255, 120, 0.2)' : 'rgba(120, 255, 120, 0.1)';
      const startX = selection.start * containerWidth;
      const endX = selection.end * containerWidth;
      ctx.fillRect(startX, 0, endX - startX, canvasHeight);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, 0, endX - startX, canvasHeight);
    }
    
    // Draw slices
    slices.forEach((slice) => {
      const startX = sampleToX(slice.start);
      const endX = sampleToX(slice.end);
      if (startX < containerWidth && endX > 0) {
        if (playingSliceId === slice.id) {
            ctx.fillStyle = 'rgba(120, 255, 120, 0.2)';
            ctx.fillRect(startX, 0, endX - startX, canvasHeight);
        }
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, 0, endX - startX, canvasHeight);
      }
    });

    // Draw waveform
    ctx.lineWidth = 2;
    ctx.strokeStyle = primaryColor;
    ctx.beginPath();
    ctx.moveTo(0, middle);

    for (let i = 0; i < containerWidth; i++) {
        let min = 1.0;
        let max = -1.0;
        const startSampleForPixel = Math.floor(viewStartSample + i * samplesPerPixel);
        const endSampleForPixel = Math.floor(startSampleForPixel + samplesPerPixel);
        
        for (let j = startSampleForPixel; j < endSampleForPixel; j++) {
            if (j >= 0 && j < audioData.length) {
                const datum = audioData[j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
        }
        const x = i;
        ctx.lineTo(x, (1 + min) * middle);
        ctx.lineTo(x, (1 + max) * middle);
    }
    ctx.stroke();

    // Draw playback cursor
    if (playbackProgress !== null && playingSliceId) {
        const cursorSample = playbackProgress * audioBuffer.length;
        const x = sampleToX(cursorSample);
        if (x >= 0 && x <= containerWidth) {
            ctx.strokeStyle = destructiveColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
            ctx.stroke();
        }
    }

  }, [audioBuffer, slices, selection, playingSliceId, playbackProgress, zoom, pan]);

  useEffect(() => {
    draw();
  }, [draw, zoom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => draw();
    const handleScroll = () => {
        if(zoom > 1 && containerRef.current) {
            const newPan = containerRef.current.scrollLeft / (containerRef.current.scrollWidth - containerRef.current.clientWidth);
            setPan(newPan);
        }
    }
    
    window.addEventListener('resize', handleResize);
    container.addEventListener('scroll', handleScroll);
    
    return () => {
        window.removeEventListener('resize', handleResize);
        container.removeEventListener('scroll', handleScroll);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, zoom]);
  
  useEffect(() => {
    if(!playingSliceId) {
      setPlaybackProgress(null);
    }
  }, [playingSliceId, setPlaybackProgress]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsSelecting(true);
    if(playingSliceId) {
        stopAudio();
        setPlayingSliceId(null);
    }
    setIsLooping(false);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const start = x / rect.width;
    setSelection({ start, end: start });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !selection) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const end = Math.max(0, Math.min(1, x / rect.width));
    setSelection({ start: Math.min(selection.start, end), end: Math.max(selection.start, end) });
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };
  
  const handleCreateSlice = () => {
    if(selection && containerRef.current && selection.end - selection.start > 0.001) {
        const scrollLeft = pan * (containerRef.current.scrollWidth - containerRef.current.clientWidth);
        const containerWidth = containerRef.current.clientWidth;

        const startProgress = (selection.start * containerWidth + scrollLeft) / containerRef.current.scrollWidth;
        const endProgress = (selection.end * containerWidth + scrollLeft) / containerRef.current.scrollWidth;

        onSlice(startProgress, endProgress);
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
    if (!selection || !containerRef.current) return;

    const currentPlayingId = loop ? 'selection_loop' : 'selection';

    if (playingSliceId === currentPlayingId) {
      stopAudio();
      setPlayingSliceId(null);
      setIsLooping(false);
    } else {
      stopAudio();
      const scrollLeft = pan * (containerRef.current.scrollWidth - containerRef.current.clientWidth);
      const containerWidth = containerRef.current.clientWidth;
      const scrollWidth = containerRef.current.scrollWidth;

      const startProgress = (selection.start * containerWidth + scrollLeft) / scrollWidth;
      const endProgress = (selection.end * containerWidth + scrollLeft) / scrollWidth;
      
      const start = startProgress * audioBuffer.duration;
      const duration = (endProgress - startProgress) * audioBuffer.duration;

      playAudio(
        audioBuffer,
        start,
        duration,
        loop,
        () => {
          setPlayingSliceId(null);
          setIsLooping(false);
        },
        (progress) => setPlaybackProgress(progress)
      );
      setPlayingSliceId(currentPlayingId);
      setIsLooping(loop);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const zoomFactor = 1.1;
    let newZoom;
    if (e.deltaY < 0) {
        newZoom = Math.min(zoom * zoomFactor, 100);
    } else {
        newZoom = Math.max(zoom / zoomFactor, 1);
    }

    if (newZoom === zoom) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    const oldScrollWidth = containerRef.current.scrollWidth;
    const oldScrollLeft = containerRef.current.scrollLeft;

    const pointerTime = (oldScrollLeft + mouseX) / oldScrollWidth;
    
    setZoom(newZoom);

    requestAnimationFrame(() => {
      if(containerRef.current) {
        const newScrollWidth = containerRef.current.scrollWidth;
        const newScrollLeft = pointerTime * newScrollWidth - mouseX;
        containerRef.current.scrollLeft = newScrollLeft;
      }
    });
  };


  return (
    <div className="flex flex-col gap-4">
      <div 
        ref={containerRef}
        className="relative h-[150px] overflow-x-auto"
        onWheel={handleWheel}
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

    

    