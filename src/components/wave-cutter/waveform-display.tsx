"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import type { Slice } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Scissors } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WaveformDisplayProps {
  audioBuffer: AudioBuffer;
  slices: Slice[];
  onSlice: (start: number, end: number) => void;
}

const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  audioBuffer,
  slices,
  onSlice,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const { toast } = useToast();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const audioData = audioBuffer.getChannelData(0);
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.scale(dpr, dpr);
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const middle = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Draw selection
    if (selection) {
      ctx.fillStyle = "hsla(var(--primary), 0.2)";
      const startX = selection.start * width;
      const endX = selection.end * width;
      ctx.fillRect(startX, 0, endX - startX, height);
    }

    // Draw slices
    ctx.fillStyle = "hsla(var(--primary), 0.1)";
    ctx.strokeStyle = "hsl(var(--primary))";
    ctx.lineWidth = 1;
    slices.forEach((slice) => {
      const startX = (slice.start / audioBuffer.length) * width;
      const endX = (slice.end / audioBuffer.length) * width;
      ctx.fillRect(startX, 0, endX - startX, height);
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

  }, [audioBuffer, slices, selection]);

  useEffect(() => {
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsSelecting(true);
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
    } else {
        toast({
            variant: "destructive",
            title: "Selection too small",
            description: "Click and drag on the waveform to make a selection."
        })
    }
  }

  return (
    <div className="flex flex-col gap-4 flex-grow">
      <div className="flex-grow bg-background relative" style={{ minHeight: '200px' }}>
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
          <div className="flex justify-end">
              <Button onClick={handleCreateSlice}>
                  <Scissors className="mr-2 h-4 w-4" />
                  Create Slice From Selection
              </Button>
          </div>
      )}
    </div>
  );
};

export default WaveformDisplay;
