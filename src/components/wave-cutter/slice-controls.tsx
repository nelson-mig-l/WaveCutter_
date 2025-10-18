"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface SliceControlsProps {
  onAutoSlice: (threshold: number) => void;
}

const SliceControls: React.FC<SliceControlsProps> = ({
  onAutoSlice,
}) => {
  const [threshold, setThreshold] = useState(5);

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-t border-primary/50 pt-4">
      <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[200px]">
        <Label htmlFor="threshold" className="flex justify-between">
          <span>Auto-Slice Threshold</span>
          <span>{threshold}%</span>
        </Label>
        <Slider
          id="threshold"
          min={1}
          max={50}
          step={1}
          value={[threshold]}
          onValueChange={(value) => setThreshold(value[0])}
        />
      </div>
      <div className="flex gap-2 flex-wrap justify-end">
        <Button onClick={() => onAutoSlice(threshold)} variant="outline">
          <Zap className="mr-2 h-4 w-4" />
          Auto-Slice
        </Button>
      </div>
    </div>
  );
};

export default SliceControls;
