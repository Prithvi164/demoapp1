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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle, Check, XCircle, Award, RefreshCw, FileQuestion, Filter, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

type QuizAttempt = {
  id: number;
  userId: number;
  score: number;
  completedAt: string;
  isPassed: boolean;
  user?: {
    fullName: string;
  };
  quiz?: {
    id: number;
    name: string | null;
    description: string | null;
    passingScore: number | null;
    quizType: 'internal' | 'final';
  };
};

type BatchQuizAttemptsProps = {
  organizationId: number;
  batchId: number;
  filter: "all" | "passed" | "failed";
};

export function BatchQuizAttempts({ organizationId, batchId, filter }: BatchQuizAttemptsProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "failed">(filter || "all");
  
  // For modal states
  const [refresherDialogOpen, setRefresherDialogOpen] = useState(false);
  const [refresherNotes, setRefresherNotes] = useState("");
  const [selectedTraineeId, setSelectedTraineeId] = useState<number | null>(null);
  const [refresherStartDate, setRefresherStartDate] = useState<Date | undefined>(undefined);
  const [refresherEndDate, setRefresherEndDate] = useState<Date | undefined>(undefined);
  // Keep track of which trainees have been set to refresher status
  const [refreshedTraineeIds, setRefreshedTraineeIds] = useState<number[]>([]);
  
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);
  
  const [certificationDialogOpen, setCertificationDialogOpen] = useState(false);
  const [selectedQuizAttemptId, setSelectedQuizAttemptId] = useState<number | null>(null);

  // Fetch quizzes for reassignment
  const { data: quizzes } = useQuery({
    queryKey: [`/api/organizations/${organizationId}/quizzes`],
    enabled: reassignDialogOpen
  });

  // Fetch quiz attempts
  const { data: quizAttempts, isLoading } = useQuery({
    queryKey: [
      `/api/organizations/${organizationId}/batches/${batchId}/quiz-attempts`,
      statusFilter !== "all" ? { status: statusFilter } : undefined,
    ],
    queryFn: async ({ queryKey }) => {
      console.log('Query key for attempts:', queryKey);
      // Build the URL with proper query parameters
      const url = new URL(queryKey[0] as string, window.location.origin);
      
      // Add status filter if present
      if (statusFilter !== "all") {
        url.searchParams.append('status', statusFilter);
      }
      
      console.log('Fetching quiz attempts with URL:', url.toString());
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch quiz attempts');
      }
      
      return response.json();
    }
  });
  
  // Enable debug logging to see data flow
  React.useEffect(() => {
    console.log("Status filter changed to:", statusFilter);
    console.log("Quiz attempts:", quizAttempts);
    if (quizAttempts) {
      console.log("Final quiz attempts:", quizAttempts?.filter((attempt: any) => attempt.quiz?.quizType === 'final'));
    }
  }, [statusFilter, quizAttempts]);

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
            endDate: refresherEndDate.toISOString()
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

  // Mutation for reassigning quiz
  const reassignQuizMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTraineeId || !selectedQuizId) return;
      
      const response = await fetch(
        `/api/organizations/${organizationId}/batches/${batchId}/trainees/${selectedTraineeId}/reassign-quiz`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quizId: selectedQuizId }),
          credentials: 'include'
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reassign quiz");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Quiz Reassigned",
        description: "Quiz has been reassigned to the trainee",
      });
      setReassignDialogOpen(false);
      setSelectedQuizId(null);
      setSelectedTraineeId(null);
      // Refresh relevant data
      queryClient.invalidateQueries({ queryKey: [`/api/batches/${batchId}/events`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to reassign quiz",
        variant: "destructive",
      });
    },
  });

  // Mutation for creating certification
  const createCertificationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTraineeId || !selectedQuizAttemptId) return;
      
      const response = await fetch(
        `/api/organizations/${organizationId}/batches/${batchId}/trainees/${selectedTraineeId}/certification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quizAttemptId: selectedQuizAttemptId }),
          credentials: 'include'
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create certification");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Certification Created",
        description: "Certification has been created successfully",
      });
      setCertificationDialogOpen(false);
      setSelectedQuizAttemptId(null);
      setSelectedTraineeId(null);
      // Refresh relevant data
      queryClient.invalidateQueries({ queryKey: [`/api/batches/${batchId}/events`] });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create certification",
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
      setRefreshedTraineeIds(prev => [...prev, variables]);
      
      // Refresh trainee list to show updated status
      queryClient.invalidateQueries({ 
        queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`] 
      });
      
      // Also refresh quiz attempts as some UI elements might depend on status
      queryClient.invalidateQueries({ 
        queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/quiz-attempts`] 
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

  // Handler for reassign dialog
  const handleReassignClick = (traineeId: number) => {
    setSelectedTraineeId(traineeId);
    setReassignDialogOpen(true);
  };

  const [, navigate] = useLocation();
  
  // Handler for certification dialog
  const handleCertificationClick = (traineeId: number, quizAttemptId: number, traineeName: string) => {
    // Option 1: Show the certification dialog first
    // setSelectedTraineeId(traineeId);
    // setSelectedQuizAttemptId(quizAttemptId);
    // setCertificationDialogOpen(true);
    
    // Option 2: Directly navigate to the conduct evaluation page with pre-selected values
    navigate(`/conduct-evaluation?batchId=${batchId}&traineeId=${traineeId}&traineeName=${encodeURIComponent(traineeName || '')}`);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Final Assessment Results</CardTitle>
        <CardDescription>
          View final quiz results and manage trainee certifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Status Filter:</span>
          </div>
          <Select 
            value={statusFilter} 
            onValueChange={(value) => {
              console.log('Changing status filter to:', value);
              setStatusFilter(value as "all" | "passed" | "failed");
              // Force refetch with the new filter
              queryClient.invalidateQueries({ 
                queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/quiz-attempts`] 
              });
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assessments</SelectItem>
              <SelectItem value="passed">Passed Only</SelectItem>
              <SelectItem value="failed">Failed Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : quizAttempts && quizAttempts.length > 0 ? (
          (() => {
            // Get only final quizzes
            const finalQuizAttempts = quizAttempts
              .filter((attempt: QuizAttempt) => attempt.quiz?.quizType === 'final');
            
            if (finalQuizAttempts.length > 0) {
              return (
                <Table>
                  <TableCaption>
                    {statusFilter === "all" 
                      ? "All final assessment results" 
                      : statusFilter === "passed" 
                        ? "Final assessments with passing scores" 
                        : "Final assessments with failing scores"}
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainee</TableHead>
                      <TableHead>Quiz</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finalQuizAttempts.map((attempt: QuizAttempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell className="font-medium">
                          {attempt.user?.fullName || `User ${attempt.userId}`}
                        </TableCell>
                        <TableCell>{attempt.quiz?.name || "Unknown Quiz"}</TableCell>
                        <TableCell>
                          {attempt.score}%
                          {attempt.quiz?.passingScore && (
                            <span className="text-xs text-muted-foreground ml-1">
                              (Passing: {attempt.quiz.passingScore}%)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(attempt.completedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {attempt.isPassed ? (
                            <Badge className="bg-green-500">Passed</Badge>
                          ) : (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!attempt.isPassed ? (
                            <div className="flex justify-end space-x-2">
                              {hasPermission("manage_batches") && (
                                <>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      // First set the status to refresher
                                      setRefresherStatusMutation.mutate(attempt.userId, {
                                        onSuccess: () => {
                                          // Then open the schedule dialog
                                          handleRefresherClick(attempt.userId);
                                        }
                                      });
                                    }}
                                    disabled={setRefresherStatusMutation.isPending}
                                  >
                                    {setRefresherStatusMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : refreshedTraineeIds.includes(attempt.userId) ? (
                                      <Check className="h-4 w-4 mr-1 text-green-500" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4 mr-1" />
                                    )}
                                    Refresher
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleReassignClick(attempt.userId)}
                                  >
                                    <FileQuestion className="h-4 w-4 mr-1" />
                                    Reassign
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="flex justify-end space-x-2">
                              {hasPermission("manage_batches") && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleCertificationClick(attempt.userId, attempt.id, attempt.user?.fullName || `User ${attempt.userId}`)}
                                >
                                  <Award className="h-4 w-4 mr-1" />
                                  Certify
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            } else {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  No final quiz attempts found for this filter
                </div>
              );
            }
          })()
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No quiz attempts found
          </div>
        )}
      </CardContent>

      {/* Refresher Training Dialog */}
      <Dialog open={refresherDialogOpen} onOpenChange={setRefresherDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Refresher Training</DialogTitle>
            <DialogDescription>
              Add notes about what specific areas need focus during the refresher
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              id="refresherNotes"
              placeholder="Notes for the refresher training..."
              value={refresherNotes}
              onChange={(e) => setRefresherNotes(e.target.value)}
            />
            
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    id="startDate"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {refresherStartDate ? format(refresherStartDate, 'PPP') : <span>Pick a start date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={refresherStartDate}
                    onSelect={(date) => setRefresherStartDate(date || new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    id="endDate"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {refresherEndDate ? format(refresherEndDate, 'PPP') : <span>Pick an end date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={refresherEndDate}
                    onSelect={(date) => setRefresherEndDate(date || new Date())}
                    initialFocus
                    disabled={(date) => 
                      refresherStartDate ? date < refresherStartDate : false
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRefresherDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => scheduleRefresherMutation.mutate()}
              disabled={scheduleRefresherMutation.isPending}
            >
              {scheduleRefresherMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                "Schedule Refresher"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Quiz Dialog */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Quiz</DialogTitle>
            <DialogDescription>
              Select a quiz to reassign to the trainee
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Select 
              onValueChange={(value) => setSelectedQuizId(Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a quiz to reassign" />
              </SelectTrigger>
              <SelectContent>
                {quizzes?.map((quiz: any) => (
                  <SelectItem key={quiz.id} value={quiz.id.toString()}>
                    {quiz.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setReassignDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => reassignQuizMutation.mutate()}
              disabled={reassignQuizMutation.isPending || !selectedQuizId}
            >
              {reassignQuizMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reassigning...
                </>
              ) : (
                "Reassign Quiz"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certification Dialog */}
      <Dialog open={certificationDialogOpen} onOpenChange={setCertificationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Certification</DialogTitle>
            <DialogDescription>
              Create a certification based on the passed assessment
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-6">
            <Award className="h-16 w-16 text-primary" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            This will create an official certification for the trainee and mark them as certified in the system.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCertificationDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={() => createCertificationMutation.mutate()}
              disabled={createCertificationMutation.isPending}
            >
              {createCertificationMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Certification"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}