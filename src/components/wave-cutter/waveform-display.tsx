"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import type { Slice } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Scissors, Play, Pause, Repeat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { playAudio, stopAudio } from "@/lib/audio-utils";

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
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const { toast } = useToast();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const audioData = audioBuffer.getChannelData(0);

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const middle = height / 2;

    ctx.clearRect(0, 0, width, height);
    
    // Draw selection
    if (selection) {
      ctx.fillStyle = playingSliceId === 'selection' || playingSliceId === 'selection_loop' ? "hsla(var(--primary), 0.2)" : "hsla(var(--primary), 0.1)";
      const startX = selection.start * width;
      const endX = selection.end * width;
      ctx.fillRect(startX, 0, endX - startX, height);
      ctx.strokeStyle = "hsl(var(--primary))";
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, 0, endX - startX, height);
    }

    // Draw slices
    slices.forEach((slice) => {
      const startX = (slice.start / audioBuffer.length) * width;
      const endX = (slice.end / audioBuffer.length) * width;
      if (playingSliceId === slice.id) {
          ctx.fillStyle = "hsla(var(--primary), 0.2)";
          ctx.fillRect(startX, 0, endX - startX, height);
      }
      ctx.strokeStyle = "hsl(var(--primary))";
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, 0, endX - startX, height);
    });

    // Draw waveform
    ctx.lineWidth = 2;
    ctx.strokeStyle = "hsl(var(--primary))";
    ctx.beginPath();
    ctx.moveTo(0, middle);

    const step = Math.ceil(audioData.length / width);
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = audioData[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.lineTo(i, (1 + min) * middle);
      ctx.lineTo(i, (1 + max) * middle);
    }
    ctx.stroke();

    // Draw playback cursor
    if (playbackProgress !== null && playingSliceId) {
        ctx.strokeStyle = "hsl(var(--destructive))";
        ctx.lineWidth = 1;
        const x = playbackProgress * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

  }, [audioBuffer, slices, selection, playingSliceId, playbackProgress]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);
  
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
      stopAudio(); // Stop any previous playback
      const start = selection.start * audioBuffer.duration;
      const duration = (selection.end - selection.start) * audioBuffer.duration;
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

  return (
    <div className="flex flex-col gap-4 flex-grow">
      <div className="flex-grow bg-background relative" style={{ minHeight: '100px' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-full cursor-crosshair"
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
