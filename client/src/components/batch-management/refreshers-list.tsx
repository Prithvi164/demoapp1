import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CalendarClock, FileText, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RefreshersListProps {
  batchId: number;
  organizationId: number;
}

interface RefresherEvent {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  eventType: 'refresher';
  status: string;
  refresherReason: string | null;
  createdAt: string;
  trainee?: {
    id: number;
    fullName: string;
    employeeId: string;
  };
}

export function RefreshersList({ batchId, organizationId }: RefreshersListProps) {
  // Fetch refresher events for this batch
  const { data: refresherEvents, isLoading, error } = useQuery({
    queryKey: ['/api/organizations', organizationId, 'batches', batchId, 'refresher-events'],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${organizationId}/batches/${batchId}/refresher-events`);
      if (!response.ok) {
        throw new Error('Failed to fetch refresher events');
      }
      return response.json();
    }
  });

  // For demo purposes, fallback to trainees with "refresher" status if the API isn't implemented yet
  const { data: trainees } = useQuery({
    queryKey: ['/api/organizations', organizationId, 'batches', batchId, 'trainees'],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${organizationId}/batches/${batchId}/trainees`);
      if (!response.ok) {
        throw new Error('Failed to fetch trainees');
      }
      return response.json();
    }
  });

  // Find trainees with refresher status
  const refresherTrainees = trainees?.filter((trainee: any) => 
    trainee.traineeStatus === 'refresher' && trainee.isManualStatus
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load refresher data. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  // If we have specific refresher events data, use that
  if (refresherEvents && refresherEvents.length > 0) {
    return (
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trainee</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {refresherEvents.map((event: RefresherEvent) => (
              <TableRow key={event.id}>
                <TableCell>{event.trainee?.fullName || 'Unknown'}</TableCell>
                <TableCell>{event.trainee?.employeeId || 'N/A'}</TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center space-x-1">
                          <span>{event.refresherReason || 'Not specified'}</span>
                          {!event.refresherReason && <Info className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {event.refresherReason ? 
                          `Reason: ${event.refresherReason}` : 
                          'No specific reason provided for this refresher'
                        }
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-1">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {event.startDate ? format(new Date(event.startDate), 'MMM dd, yyyy') : 'Not set'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-1">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {event.endDate ? format(new Date(event.endDate), 'MMM dd, yyyy') : 'Not set'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={event.status === 'scheduled' ? 'outline' : 
                            event.status === 'completed' ? 'default' : 'secondary'}>
                    {event.status || 'pending'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center space-x-1 cursor-help">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="max-w-[150px] truncate">
                            {event.description || 'No notes'}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-md">
                        <p className="font-semibold">Notes:</p>
                        <p>{event.description || 'No additional notes provided.'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // If no specific refresher events but we have trainees with refresher status
  if (refresherTrainees && refresherTrainees.length > 0) {
    return (
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trainee</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {refresherTrainees.map((trainee: any) => (
              <TableRow key={trainee.id}>
                <TableCell>
                  {trainee.fullName || (trainee.user && trainee.user.fullName) || 'No name'}
                </TableCell>
                <TableCell>
                  {trainee.employeeId || (trainee.user && trainee.user.employeeId) || 'No ID'}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">Refresher</Badge>
                </TableCell>
                <TableCell>
                  {trainee.updatedAt ? format(new Date(trainee.updatedAt), "MMM dd, yyyy") : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <Alert>
          <AlertDescription>
            These trainees are marked for refresher training, but full details like start/end dates and reasons
            are not available. Use the Schedule Refresher option when marking a trainee as a refresher to provide
            these details.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No refresher trainees found
  return (
    <Alert className="bg-muted">
      <AlertDescription>
        No trainees in refresher status found for this batch.
      </AlertDescription>
    </Alert>
  );
}