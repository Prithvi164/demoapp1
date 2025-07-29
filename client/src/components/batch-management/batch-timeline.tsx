import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

type TimelineEvent = {
  id: number;
  eventType: 'phase_change' | 'status_update' | 'milestone' | 'note';
  description: string;
  previousValue?: string;
  newValue?: string;
  date: string;
  user: {
    fullName: string;
  };
};

export function BatchTimeline({ batchId }: { batchId: string | undefined }) {
  const { user } = useAuth();

  const { data: events = [], isLoading, error } = useQuery<TimelineEvent[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/history`],
    enabled: !!user?.organizationId && !!batchId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-destructive">
        Error loading batch history. Please try again.
      </div>
    );
  }

  if (!events?.length) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No history events found for this batch. History events will appear here when changes are made to the batch.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event: TimelineEvent) => (
        <Card key={event.id} className="p-4 relative">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-lg" />
          <div className="ml-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-sm font-medium">
                {event.description}
              </h4>
              <time className="text-xs text-muted-foreground">
                {format(new Date(event.date), "PPp")}
              </time>
            </div>
            {(event.previousValue || event.newValue) && (
              <div className="text-sm text-muted-foreground">
                {event.previousValue && (
                  <span>From: {event.previousValue}</span>
                )}
                {event.previousValue && event.newValue && (
                  <span className="mx-2">→</span>
                )}
                {event.newValue && (
                  <span>To: {event.newValue}</span>
                )}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              By: {event.user.fullName}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}