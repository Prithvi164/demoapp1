import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InfoIcon } from "lucide-react";

type TrainerBatchInsight = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
};

interface TrainerInsightsProps {
  trainerId: number | null;
}

export function TrainerInsights({ trainerId }: TrainerInsightsProps) {
  const { data: trainerBatches, isLoading } = useQuery({
    queryKey: ['trainer-batches', trainerId],
    queryFn: async () => {
      if (!trainerId) return [];
      const response = await fetch(`/api/trainers/${trainerId}/active-batches`);
      if (!response.ok) throw new Error('Failed to fetch trainer batches');
      return response.json();
    },
    enabled: !!trainerId
  });

  if (!trainerId) return null;

  // Sort batches by start date
  const sortedBatches = [...(trainerBatches || [])].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs font-normal text-muted-foreground hover:text-foreground flex items-center gap-1 h-auto py-1 px-2"
        >
          <InfoIcon className="h-3 w-3" />
          View Schedule
          {sortedBatches?.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
              {sortedBatches.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h3 className="font-medium">Current Batches</h3>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading trainer schedule...</p>
          ) : sortedBatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active batches found for this trainer.</p>
          ) : (
            <div className="space-y-2">
              {sortedBatches.map((batch) => (
                <div key={batch.id} className="rounded-md border p-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-sm font-medium">{batch.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(batch.startDate).toLocaleDateString()} - {new Date(batch.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={batch.status === 'planned' ? 'secondary' : 'default'} className="capitalize">
                      {batch.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}