import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useLocation } from "wouter";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Award, 
  Filter, 
  FileQuestion, 
  RefreshCw, 
  Check, 
  CalendarIcon 
} from "lucide-react";
import { format } from "date-fns";

type CertificationResult = {
  id: number;
  templateId: number;
  traineeId: number;
  evaluatorId: number;
  finalScore: number;
  evaluationType: string; 
  createdAt: string;
  organizationId: number;
  isPassed: boolean;
  trainee?: {
    fullName: string;
  };
  template?: {
    id: number;
    name: string;
    description: string | null;
  };
};

type BatchCertificationResultsProps = {
  organizationId: number;
  batchId: number;
  filter: "all" | "passed" | "failed";
};

export function BatchCertificationResults({
  organizationId,
  batchId,
  filter,
}: BatchCertificationResultsProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "failed">(
    filter || "all"
  );
  const [typeFilter, setTypeFilter] = useState<"all" | "standard" | "audio" | "certification">("all");
  const [, navigate] = useLocation();
  
  // For modal states
  const [refresherDialogOpen, setRefresherDialogOpen] = useState(false);
  const [refresherNotes, setRefresherNotes] = useState("");
  const [refresherReason, setRefresherReason] = useState<string>("");
  const [selectedTraineeId, setSelectedTraineeId] = useState<number | null>(null);
  const [refresherStartDate, setRefresherStartDate] = useState<Date | undefined>(undefined);
  const [refresherEndDate, setRefresherEndDate] = useState<Date | undefined>(undefined);
  // Keep track of which trainees have been set to refresher status
  const [refreshedTraineeIds, setRefreshedTraineeIds] = useState<number[]>(() => {
    const savedIds = localStorage.getItem(`refreshed-trainees-cert-${batchId}`);
    return savedIds ? JSON.parse(savedIds) : [];
  });

  // Fetch certification evaluations for the selected batch
  const {
    data: certificationResults = [],
    isLoading,
    error,
  } = useQuery<CertificationResult[]>({
    queryKey: [
      `/api/organizations/${organizationId}/batches/${batchId}/certification-evaluations`,
      statusFilter !== "all" || typeFilter !== "all" ? { status: statusFilter, type: typeFilter } : undefined,
    ],
    queryFn: async ({ queryKey }) => {
      console.log('Query key for certification evaluations:', queryKey);
      
      // Add debug info to help diagnose issue with batch 71
      console.log(`Fetching certification evaluations for batch ${batchId}, organization ${organizationId}`);
      
      // Build the URL with proper query parameters
      const url = new URL(queryKey[0] as string, window.location.origin);
      
      // Add status filter if present
      if (statusFilter !== "all") {
        url.searchParams.append('status', statusFilter);
      }
      
      // Add evaluation type filter if present
      if (typeFilter !== "all") {
        url.searchParams.append('type', typeFilter);
      }
      
      console.log('Fetching certification evaluations with URL:', url.toString());
      try {
        const response = await fetch(url, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          console.error('Error fetching certification evaluations:', response.status, response.statusText);
          throw new Error(`Failed to fetch certification evaluations: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Successfully fetched ${data.length} certification evaluation(s)`, data);
        return data;
      } catch (error) {
        console.error('Exception fetching certification evaluations:', error);
        throw error;
      }
    },
    enabled: !!batchId && !!organizationId,
    retryDelay: 1000, // Retry more quickly
    retry: 3,         // Retry up to 3 times
  });

  // Enable debug logging to see data flow
  React.useEffect(() => {
    console.log("Filters changed - Status:", statusFilter, "Type:", typeFilter);
    console.log("Certification evaluations:", certificationResults);
  }, [statusFilter, typeFilter, certificationResults]);

  // Handle view details click
  const handleViewDetails = (evaluationId: number) => {
    navigate(`/evaluations/${evaluationId}`);
  };

  // Mutation for scheduling refresher training
  const scheduleRefresherMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTraineeId || !refresherStartDate || !refresherEndDate) {
        throw new Error("Missing required information for scheduling refresher");
      }
      
      // Using fetch directly instead of apiRequest to ensure proper handling
      const response = await fetch(
        `/api/organizations/${organizationId}/batches/${batchId}/trainees/${selectedTraineeId}/refresher`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            notes: refresherNotes,
            startDate: refresherStartDate.toISOString(),
            endDate: refresherEndDate.toISOString(),
            reason: refresherReason
          }),
          credentials: 'include'
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to schedule refresher training");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Refresher Scheduled",
        description: "Refresher training has been scheduled successfully",
      });
      setRefresherDialogOpen(false);
      setRefresherNotes("");
      setSelectedTraineeId(null);
      setRefresherStartDate(undefined);
      setRefresherEndDate(undefined);
      // Refresh batch events if needed
      queryClient.invalidateQueries({ queryKey: [`/api/batches/${batchId}/events`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to schedule refresher training",
        variant: "destructive",
      });
    },
  });
  
  // Mutation for setting trainee status to refresher immediately
  const setRefresherStatusMutation = useMutation({
    mutationFn: async (userId: number) => {
      console.log('Setting trainee to refresher status:', userId);
      
      const response = await fetch(
        `/api/organizations/${organizationId}/batches/${batchId}/trainees/${userId}/set-refresher`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: refresherReason }),
          credentials: 'include'
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to set trainee to refresher status");
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Status Updated",
        description: "Trainee status changed to Refresher",
      });
      
      // Add the trainee ID to the list of refreshed trainees
      setRefreshedTraineeIds(prev => {
        const newIds = [...prev, variables];
        // Also store in localStorage for persistence
        localStorage.setItem(`refreshed-trainees-cert-${batchId}`, JSON.stringify(newIds));
        return newIds;
      });
      
      // Refresh trainee list to show updated status
      queryClient.invalidateQueries({ 
        queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`] 
      });
      
      // Also refresh certification evaluations as some UI elements might depend on status
      queryClient.invalidateQueries({ 
        queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/certification-evaluations`] 
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to set trainee status to refresher",
        variant: "destructive",
      });
    },
  });

  // Handler for refresher dialog
  const handleRefresherClick = (traineeId: number) => {
    // Set default dates: tomorrow for start date and day after tomorrow for end date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    setSelectedTraineeId(traineeId);
    setRefresherStartDate(tomorrow);
    setRefresherEndDate(dayAfterTomorrow);
    setRefresherDialogOpen(true);
  };

  // Handle conduct certification click - use standard evaluation type
  const handleConductCertification = (traineeId: number, traineeName: string) => {
    // Use standard evaluation type for certification
    navigate(`/conduct-evaluation?batchId=${batchId}&traineeId=${traineeId}&traineeName=${encodeURIComponent(traineeName || '')}&evaluationType=standard&purpose=certification`);
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Final Certification Results</CardTitle>
          <CardDescription>
            View certification evaluation results and trainee certification status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    console.log("Changing status filter to:", value);
                    setStatusFilter(value as "all" | "passed" | "failed");
                    // Force refetch with the new filter
                    queryClient.invalidateQueries({ 
                      queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/certification-evaluations`] 
                    });
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Results</SelectItem>
                    <SelectItem value="passed">Passed Only</SelectItem>
                    <SelectItem value="failed">Failed Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Type:</span>
                <Select
                  value={typeFilter}
                  onValueChange={(value) => {
                    console.log("Changing type filter to:", value);
                    setTypeFilter(value as "all" | "standard" | "audio" | "certification");
                    // Force refetch with the new filter
                    queryClient.invalidateQueries({ 
                      queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/certification-evaluations`] 
                    });
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="certification">Certification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : certificationResults && certificationResults.length > 0 ? (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Trainee</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certificationResults.map((result) => {
                    const passed = result.isPassed || result.finalScore >= 70;
                    const passingScore = 70; // Default passing score
                    return (
                      <TableRow key={result.id} className="border-b">
                        <TableCell className="font-medium">
                          {result.trainee?.fullName || `Trainee ID: ${result.traineeId}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{result.template?.name || `Template ID: ${result.templateId}`}</span>
                            <span className="text-xs text-muted-foreground capitalize">
                              {result.evaluationType} evaluation
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {result.finalScore}% <span className="text-xs text-muted-foreground">(Passing: {passingScore}%)</span>
                        </TableCell>
                        <TableCell>
                          {format(new Date(result.createdAt), "M/d/yyyy")}
                        </TableCell>
                        <TableCell>
                          {passed ? (
                            <Badge variant="outline" className="bg-green-500 text-white border-0 rounded-md font-normal">
                              Passed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500 text-white border-0 rounded-md font-normal">
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!passed ? (
                            <div className="flex justify-end space-x-2">
                              {hasPermission("manage_batches") && (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 px-2 text-green-600"
                                    onClick={() => {
                                      // First set the status to refresher
                                      setRefresherStatusMutation.mutate(result.traineeId, {
                                        onSuccess: () => {
                                          // Then open the schedule dialog
                                          handleRefresherClick(result.traineeId);
                                        }
                                      });
                                    }}
                                    disabled={setRefresherStatusMutation.isPending}
                                  >
                                    {setRefresherStatusMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : refreshedTraineeIds.includes(result.traineeId) ? (
                                      <Check className="h-4 w-4 mr-1 text-green-500" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4 mr-1" />
                                    )}
                                    Refresher
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 px-2"
                                    onClick={() => handleConductCertification(
                                      result.traineeId, 
                                      result.trainee?.fullName || `Trainee ID: ${result.traineeId}`
                                    )}
                                  >
                                    <Award className="h-4 w-4 mr-1" />
                                    Certify
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="flex justify-end space-x-2">
                              {hasPermission("manage_batches") && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-8 px-2"
                                  onClick={() => handleConductCertification(
                                    result.traineeId, 
                                    result.trainee?.fullName || `Trainee ID: ${result.traineeId}`
                                  )}
                                >
                                  <Award className="h-4 w-4 mr-1" />
                                  Certify
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableCaption className="mt-4 pb-2">
                  {(() => {
                    let statusText = statusFilter === "all" 
                      ? "All certification results" 
                      : statusFilter === "passed" 
                        ? "Certifications with passing scores" 
                        : "Certifications with failing scores";
                    
                    let typeText = typeFilter === "all" 
                      ? "" 
                      : ` (${typeFilter} evaluations only)`;
                    
                    return statusText + typeText;
                  })()}
                </TableCaption>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 border rounded-lg bg-muted/10">
              <FileQuestion className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No certification results found</p>
              <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
                {statusFilter === "all"
                  ? "No trainees have taken certification evaluations yet"
                  : statusFilter === "passed"
                  ? "No trainees have passed certification evaluations"
                  : "No trainees have failed certification evaluations"}
              </p>
              {hasPermission("manage_trainee_management") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/conduct-evaluation?batchId=${batchId}&evaluationType=standard&purpose=certification`)}
                >
                  Conduct Certification
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Refresher dialog for scheduling */}
      <Dialog open={refresherDialogOpen} onOpenChange={setRefresherDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Schedule Refresher Training</DialogTitle>
            <DialogDescription>
              Set a timeframe for the trainee to undergo refresher training.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reason" className="text-right">
                Reason
              </Label>
              <Select 
                value={refresherReason} 
                onValueChange={setRefresherReason}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select reason for refresher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="failed_certification">Failed Certification</SelectItem>
                  <SelectItem value="performance_issues">Performance Issues</SelectItem>
                  <SelectItem value="knowledge_gaps">Knowledge Gaps</SelectItem>
                  <SelectItem value="skill_enhancement">Skill Enhancement</SelectItem>
                  <SelectItem value="requested_by_trainee">Requested by Trainee</SelectItem>
                  <SelectItem value="process_updates">Process Updates</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Notes
              </Label>
              <Textarea
                id="notes"
                placeholder="Add details about the refresher training..."
                className="col-span-3"
                value={refresherNotes}
                onChange={(e) => setRefresherNotes(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startDate" className="text-right">
                Start Date
              </Label>
              <div className="col-span-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {refresherStartDate ? (
                        format(refresherStartDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={refresherStartDate}
                      onSelect={setRefresherStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="endDate" className="text-right">
                End Date
              </Label>
              <div className="col-span-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {refresherEndDate ? (
                        format(refresherEndDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={refresherEndDate}
                      onSelect={setRefresherEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRefresherDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => scheduleRefresherMutation.mutate()}
              disabled={scheduleRefresherMutation.isPending || !refresherStartDate || !refresherEndDate || !refresherReason}
            >
              {scheduleRefresherMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                'Schedule Refresher'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}