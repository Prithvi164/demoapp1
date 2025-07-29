import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BatchNavigationProps {
  orgId: number;
  batchId: number;
}

interface AdjacentBatch {
  id: number;
  name: string;
}

interface AdjacentBatchResponse {
  previousBatch: AdjacentBatch | null;
  nextBatch: AdjacentBatch | null;
}

export function BatchNavigation({ orgId, batchId }: BatchNavigationProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Fetch adjacent batches (previous and next)
  const { data: adjacentBatches, isLoading } = useQuery<AdjacentBatchResponse>({
    queryKey: [`/api/organizations/${orgId}/batches/${batchId}/adjacent`],
    enabled: !!user && !!orgId && !!batchId,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const navigateToBatch = (id: number) => {
    navigate(`/batch-dashboard/${id}`);
  };

  return (
    <div className="flex items-center space-x-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              disabled={isLoading || !adjacentBatches?.previousBatch}
              onClick={() => adjacentBatches?.previousBatch && navigateToBatch(adjacentBatches.previousBatch.id)}
              aria-label="Previous Batch"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {adjacentBatches?.previousBatch 
              ? `Previous: ${adjacentBatches.previousBatch.name}` 
              : "No previous batch available"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              disabled={isLoading || !adjacentBatches?.nextBatch}
              onClick={() => adjacentBatches?.nextBatch && navigateToBatch(adjacentBatches.nextBatch.id)}
              aria-label="Next Batch"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {adjacentBatches?.nextBatch 
              ? `Next: ${adjacentBatches.nextBatch.name}` 
              : "No next batch available"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}