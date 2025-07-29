import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchCertificationResults } from "@/components/batch-management/batch-certification-results";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle, AlertCircle, Clock, ChevronLeft, Award, Trash2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { BatchTimeline } from "./batch-timeline";
import { BatchQuizAttempts } from "./batch-quiz-attempts";
import { RefreshersList } from "./refreshers-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Textarea
} from "@/components/ui/textarea";

const statusColors = {
  present: 'text-green-500',
  absent: 'text-red-500',
  late: 'text-yellow-500',
  leave: 'text-blue-500',
  half_day: 'text-orange-500',
  public_holiday: 'text-purple-500',
  weekly_off: 'text-gray-500',
  left_job: 'text-red-700'
} as const;

type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'half_day' | 'public_holiday' | 'weekly_off' | 'left_job';

type Trainee = {
  id: number;
  status: string;
  name: string;
  employeeId?: string;
  user?: {
    id: number;
    fullName: string;
    employeeId: string;
    email: string;
    role: string;
    category: string;
  };
  lastUpdated?: string;
};

const getStatusIcon = (status: AttendanceStatus | null) => {
  switch (status) {
    case 'present':
      return <CheckCircle className={`h-4 w-4 ${statusColors.present}`} />;
    case 'absent':
      return <AlertCircle className={`h-4 w-4 ${statusColors.absent}`} />;
    case 'late':
      return <Clock className={`h-4 w-4 ${statusColors.late}`} />;
    case 'leave':
      return <Clock className={`h-4 w-4 ${statusColors.leave}`} />;
    case 'half_day':
      return <Clock className={`h-4 w-4 ${statusColors.half_day}`} />;
    case 'public_holiday':
      return <AlertCircle className={`h-4 w-4 ${statusColors.public_holiday}`} />;
    case 'weekly_off':
      return <AlertCircle className={`h-4 w-4 ${statusColors.weekly_off}`} />;
    case 'left_job':
      return <XCircle className={`h-4 w-4 ${statusColors.left_job}`} />;
    default:
      return null;
  }
};

const LoadingSkeleton = () => (
  <div className="space-y-4 p-8 animate-fade-in">
    {/* Header with batch name and info */}
    <div className="flex justify-between items-start">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-6 w-24 rounded-full" /> {/* Badge */}
    </div>
    
    {/* Batch capacity card */}
    <div className="border rounded-lg p-6 space-y-4">
      <Skeleton className="h-5 w-32" />
      <div className="space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-30" />
          <Skeleton className="h-4 w-8" />
        </div>
      </div>
    </div>
    
    {/* Tabs */}
    <div className="space-y-4">
      <div className="flex space-x-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-28" />
      </div>
      
      {/* Tab content */}
      <div className="border rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-6 w-40" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        
        {/* Table */}
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          
          {/* Table rows */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-5 gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const phaseChangeFormSchema = z.object({
  action: z.string().min(1, "Action is required"),
  requestedPhase: z.enum(['planned', 'induction', 'training', 'certification', 'ojt', 'ojt_certification']),
  justification: z.string().min(1, "Justification is required"),
  managerId: z.string().min(1, "Manager is required"),
});

export function BatchDetailsPage() {
  const { batchId } = useParams();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("attendance");
  const currentDate = format(new Date(), "PPP");
  
  // Format current date as YYYY-MM-DD for API and initialize selectedDate state
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);

  // Initialize form
  const form = useForm({
    resolver: zodResolver(phaseChangeFormSchema),
    defaultValues: {
      action: "",
      requestedPhase: undefined,
      justification: "",
      managerId: "",
    },
  });

  // Define the Batch type to fix type errors
  type Batch = {
    id: number;
    name: string;
    status: string;
    capacityLimit: number;
    userCount: number;
    location?: {
      name: string;
    };
    process?: {
      name: string;
    };
    trainer?: {
      id: number;
      fullName: string;
    };
    trainingPlan?: any[];
  };

  // Query hooks with improved error handling
  const { data: batch, isLoading: batchLoading, error: batchError } = useQuery<Batch>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}`],
    enabled: !!user?.organizationId && !!batchId,
  });

  const { data: trainees = [], isLoading: traineesLoading } = useQuery<any[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`, selectedDate],
    queryFn: async ({ queryKey }) => {
      const [baseUrl, date] = queryKey;
      const url = `${baseUrl}?date=${date}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch trainees');
      }
      return response.json();
    },
    enabled: !!user?.organizationId && !!batchId && !!batch,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0 // Always refetch the data
  });

  const { data: allUsers } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/users`],
    enabled: !!user?.organizationId,
  });
  
  // Filter to get only the user's reporting manager
  const managers = useMemo(() => {
    if (!allUsers || !user) return [];
    
    // Find the current user's manager
    const currentUser = allUsers.find((u: any) => u.id === user.id);
    if (!currentUser || !currentUser.managerId) return [];
    
    // Return only the reporting manager
    return allUsers.filter((u: any) => u.id === currentUser.managerId && u.role === 'manager');
  }, [allUsers, user]);

  const { 
    data: trainerRequests,
    refetch: fetchTrainerRequests
  } = useQuery({
    queryKey: [`/api/trainers/${user?.id}/phase-change-requests`],
    enabled: !!user?.id && user?.role === 'trainer',
  });

  const { 
    data: managerRequests,
    refetch: fetchManagerRequests
  } = useQuery({
    queryKey: [`/api/managers/${user?.id}/phase-change-requests`, batchId],
    queryFn: async ({ queryKey }) => {
      const [baseUrl, currentBatchId] = queryKey;
      const url = `${baseUrl}?batchId=${currentBatchId}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch phase change requests');
      }
      return response.json();
    },
    enabled: !!user?.id && !!batchId && user?.role === 'manager',
  });

  // Define a type for phase requests
  type PhaseRequest = {
    id: number;
    trainerId: number;
    managerId: number;
    currentPhase: string;
    requestedPhase: string;
    status: string;
    action: string;
    justification: string;
    trainer?: {
      fullName: string;
    };
  };
  
  // Type for quiz attempts
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
    };
  };
  
  // Initialize phase requests with proper typing
  const phaseRequests: PhaseRequest[] = user?.role === 'trainer' 
    ? (trainerRequests as PhaseRequest[] || []) 
    : user?.role === 'manager' 
      ? (managerRequests as PhaseRequest[] || []) 
      : [];

  const updateAttendanceMutation = useMutation({
    mutationFn: async ({ traineeId, status }: { traineeId: number; status: AttendanceStatus }) => {
      // Use a try-catch to debug what's going on
      try {
        console.log(`Sending attendance request: traineeId=${traineeId}, status=${status}, date=${selectedDate}`);
        
        const response = await fetch(`/api/attendance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            traineeId,
            status,
            date: selectedDate, // Use the selected date
            organizationId: user?.organizationId,
            batchId: parseInt(batchId!),
            phase: batch?.status,
            markedById: user?.id
          }),
        });
        
        // Log the full response for debugging
        console.log(`Attendance API response: status=${response.status}, ok=${response.ok}`);
        
        const data = await response.json();
        console.log("Full API response data:", JSON.stringify(data));
        
        if (!response.ok) {
          throw new Error(data.message || data.reason || 'Failed to update attendance');
        }
        
        return data;
      } catch (error) {
        console.error("Error in attendance mutation:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Updating cache with data:", JSON.stringify(data));
      
      // First, immediately refetch the data to ensure the UI is updated
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/batches/${batchId}/trainees`, selectedDate],
        refetchType: 'active',
        exact: true
      });
      
      toast({
        title: "Success",
        description: "Attendance marked successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Creating phase change request:', data);
      const response = await fetch(`/api/batches/${batchId}/phase-change-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          managerId: parseInt(data.managerId),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create request');
      }

      return response.json();
    },
    onSuccess: () => {
      console.log('Phase change request created successfully, refreshing data...');
      
      // Invalidate queries
      queryClient.invalidateQueries({ 
        queryKey: [
          `/api/trainers/${user?.id}/phase-change-requests`,
          [`/api/managers/${user?.id}/phase-change-requests`, batchId]
        ],
        // Force immediate refetch
        refetchType: 'active',
        exact: false
      });
      
      // Force explicit refresh depending on user role
      if (user?.role === 'trainer') {
        console.log('Executing fetchTrainerRequests()...');
        fetchTrainerRequests();
      } else if (user?.role === 'manager') {
        console.log('Executing fetchManagerRequests()...');
        fetchManagerRequests();
      }
      
      toast({
        title: "Success",
        description: "Phase change request submitted successfully",
      });
      
      form.reset();
      const closeButton = document.querySelector('[data-dialog-close]');
      if (closeButton instanceof HTMLElement) {
        closeButton.click();
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to submit request",
      });
    },
  });

  const onSubmit = (data: any) => {
    console.log('Submitting form data:', data);
    createRequestMutation.mutate(data);
  };

  const handleApprove = async (requestId: number) => {
    try {
      console.log(`Approving phase change request with ID: ${requestId}`);
      
      const response = await fetch(`/api/phase-change-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'approved',
        }),
      });
      
      console.log(`Approve response status: ${response.status}`);
      
      // Invalidate queries
      queryClient.invalidateQueries({ 
        queryKey: [
          `/api/trainers/${user?.id}/phase-change-requests`,
          [`/api/managers/${user?.id}/phase-change-requests`, batchId]
        ],
        // Force immediate refetch
        refetchType: 'active',
        exact: false
      });
      
      // Force explicit refresh depending on user role
      if (user?.role === 'trainer') {
        console.log('Executing fetchTrainerRequests()...');
        fetchTrainerRequests();
      } else if (user?.role === 'manager') {
        console.log('Executing fetchManagerRequests()...');
        fetchManagerRequests();
      }
      
      toast({
        title: "Success",
        description: "Request approved successfully",
      });
    } catch (error) {
      console.error(`Error approving request:`, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to approve request",
      });
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      console.log(`Rejecting phase change request with ID: ${requestId}`);
      
      const response = await fetch(`/api/phase-change-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'rejected',
        }),
      });
      
      console.log(`Reject response status: ${response.status}`);
      
      // Invalidate queries
      queryClient.invalidateQueries({ 
        queryKey: [
          `/api/trainers/${user?.id}/phase-change-requests`,
          [`/api/managers/${user?.id}/phase-change-requests`, batchId]
        ],
        // Force immediate refetch
        refetchType: 'active',
        exact: false
      });
      
      // Force explicit refresh depending on user role
      if (user?.role === 'trainer') {
        console.log('Executing fetchTrainerRequests()...');
        fetchTrainerRequests();
      } else if (user?.role === 'manager') {
        console.log('Executing fetchManagerRequests()...');
        fetchManagerRequests();
      }
      
      toast({
        title: "Success",
        description: "Request rejected successfully",
      });
    } catch (error) {
      console.error(`Error rejecting request:`, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reject request",
      });
    }
  };
  
  const handleDelete = async (requestId: number) => {
    try {
      console.log(`Attempting to delete phase change request with ID: ${requestId}`);
      
      const response = await fetch(`/api/phase-change-requests/${requestId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`Delete response status: ${response.status}`);
      
      let responseData;
      try {
        responseData = await response.json();
        console.log(`Delete response data:`, responseData);
      } catch (jsonError) {
        console.error(`Error parsing JSON response:`, jsonError);
        responseData = { message: "No response data available" };
      }
      
      if (!response.ok) {
        throw new Error(responseData.message || `Server responded with status: ${response.status}`);
      }
      
      console.log(`Successfully deleted request, invalidating queries`);
      
      queryClient.invalidateQueries({ 
        queryKey: [
          `/api/trainers/${user?.id}/phase-change-requests`,
          [`/api/managers/${user?.id}/phase-change-requests`, batchId]
        ],
        // Force immediate refetch
        refetchType: 'active',
        exact: false
      });
      
      toast({
        title: "Success",
        description: "Request deleted successfully",
      });
      
      // Force refresh the requests after deletion
      if (user?.role === 'trainer') {
        fetchTrainerRequests();
      } else if (user?.role === 'manager') {
        fetchManagerRequests();
      }
      
    } catch (error) {
      console.error(`Error deleting request:`, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete request",
      });
    }
  };

  if (batchLoading || traineesLoading) {
    return <LoadingSkeleton />;
  }

  if (batchError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load batch details. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!batch) {
    return (
      <Alert>
        <AlertDescription>
          Batch not found. Please make sure you have access to this batch.
        </AlertDescription>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-4"
          onClick={() => setLocation('/batches')}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Batches
        </Button>
      </Alert>
    );
  }

  const canAccessPhaseRequests = user?.role === 'trainer' || user?.role === 'manager';

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{batch.name}</h1>
          <p className="text-muted-foreground">
            {batch.location?.name} • {batch.process?.name}
          </p>
          {batch.trainer && (
            <p className="text-sm text-muted-foreground mt-1">
              Assigned Trainer: <span className="font-medium">{batch.trainer.fullName}</span>
            </p>
          )}
        </div>
        <Badge variant="secondary" className="capitalize">
          {batch.status}
        </Badge>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <h3 className="font-medium">Batch Capacity</h3>
            <div className="grid gap-2">
              <div className="flex justify-between font-medium">
                <span>Total Capacity:</span>
                <span>{batch.capacityLimit}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Current Trainees:</span>
                <span>{batch.userCount}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Remaining Slots:</span>
                <span>{batch.capacityLimit - batch.userCount}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="training-plan">Training Planner</TabsTrigger>
          <TabsTrigger value="assessments">Assessment Results</TabsTrigger>
          <TabsTrigger value="certifications">Certification Results</TabsTrigger>
          <TabsTrigger value="refreshers">Refreshers</TabsTrigger>
          {canAccessPhaseRequests && (
            <TabsTrigger value="phase-requests">Phase Requests</TabsTrigger>
          )}
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Attendance Tracking</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label htmlFor="date" className="text-sm font-medium">Date:</label>
                    <input 
                      type="date" 
                      id="date" 
                      className="border rounded p-1 text-sm" 
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>
                  <p className="text-muted-foreground">{currentDate}</p>
                </div>
              </div>

              {trainees && trainees.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainee Name</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainees.map((trainee: any) => {
                      return (
                        <TableRow key={trainee.id}>
                          <TableCell>
                            {trainee.fullName || (trainee.user && trainee.user.fullName) || 'No name'}
                          </TableCell>
                          <TableCell>
                            {trainee.employeeId || (trainee.user && trainee.user.employeeId) || 'No ID'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(trainee.status as AttendanceStatus)}
                              <span className={`capitalize ${statusColors[trainee.status as AttendanceStatus] || ''}`}>
                                {trainee.status || 'Not marked'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {trainee.lastUpdated ? format(new Date(trainee.lastUpdated), "hh:mm a") : '-'}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={trainee.status || ''}
                              onValueChange={(value: AttendanceStatus) =>
                                updateAttendanceMutation.mutate({ traineeId: trainee.id, status: value })
                              }
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="Mark attendance" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="present" className={statusColors.present}>Present</SelectItem>
                                <SelectItem value="absent" className={statusColors.absent}>Absent</SelectItem>
                                <SelectItem value="late" className={statusColors.late}>Late</SelectItem>
                                <SelectItem value="leave" className={statusColors.leave}>Leave</SelectItem>
                                <SelectItem value="half_day" className={statusColors.half_day}>Half Day</SelectItem>
                                <SelectItem value="public_holiday" className={statusColors.public_holiday}>Public Holiday</SelectItem>
                                <SelectItem value="weekly_off" className={statusColors.weekly_off}>Weekly Off</SelectItem>
                                <SelectItem value="left_job" className={statusColors.left_job}>Left Job</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <Alert>
                  <AlertDescription>
                    No trainees found in this batch.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training-plan" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Training Schedule</h2>
              <Alert>
                <AlertDescription>
                  Training planner interface will be implemented here.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessments" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              {batchId && user?.organizationId && (
                <BatchQuizAttempts 
                  batchId={parseInt(batchId)} 
                  organizationId={user.organizationId} 
                  filter="all" 
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certifications" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              {batchId && user?.organizationId && (
                <BatchCertificationResults
                  batchId={parseInt(batchId)}
                  organizationId={user.organizationId}
                  filter="all"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canAccessPhaseRequests && (
          <TabsContent value="phase-requests" className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Phase Change Requests</h2>
                  {user?.role === 'trainer' && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button>Request Phase Change</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Request Phase Change</DialogTitle>
                          <DialogDescription>
                            Submit a request to change the batch phase. This will need approval from your reporting manager.
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                              control={form.control}
                              name="action"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Action</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select action" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Change phase to planned">Change phase to Planned</SelectItem>
                                      <SelectItem value="Change phase to induction">Change phase to Induction</SelectItem>
                                      <SelectItem value="Change phase to training">Change phase to Training</SelectItem>
                                      <SelectItem value="Change phase to certification">Change phase to Certification</SelectItem>
                                      <SelectItem value="Change phase to ojt">Change phase to OJT</SelectItem>
                                      <SelectItem value="Change phase to ojt_certification">Change phase to OJT Certification</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="requestedPhase"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Requested Phase</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select phase" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="planned">Planned</SelectItem>
                                      <SelectItem value="induction">Induction</SelectItem>
                                      <SelectItem value="training">Training</SelectItem>
                                      <SelectItem value="certification">Certification</SelectItem>
                                      <SelectItem value="ojt">OJT</SelectItem>
                                      <SelectItem value="ojt_certification">OJT Certification</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="justification"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Justification</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Explain why this phase change is needed..."
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="managerId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Reporting Manager</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select manager" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {managers?.map((manager: any) => (
                                        <SelectItem key={manager.id} value={manager.id.toString()}>
                                          {manager.fullName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <DialogFooter>
                              <Button 
                                type="submit" 
                                disabled={createRequestMutation.isPending}
                              >
                                {createRequestMutation.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                  </>
                                ) : (
                                  'Submit Request'
                                )}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                {phaseRequests && phaseRequests.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Batch Name</TableHead>
                        <TableHead>Current Phase</TableHead>
                        <TableHead>Requested Phase</TableHead>
                        <TableHead>Action Details</TableHead>
                        <TableHead>Justification</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phaseRequests.map((request: any) => (
                        <TableRow key={request.id}>
                          <TableCell>{request.trainer?.fullName}</TableCell>
                          <TableCell>{batch.name}</TableCell>
                          <TableCell className="capitalize">{request.currentPhase}</TableCell>
                          <TableCell className="capitalize">{request.requestedPhase}</TableCell>
                          <TableCell>{request.action || `Change phase to ${request.requestedPhase}`}</TableCell>
                          <TableCell>
                            <span className="line-clamp-2" title={request.justification}>
                              {request.justification || "No justification provided"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                request.status === 'pending' 
                                  ? 'outline' 
                                  : request.status === 'approved' 
                                    ? 'default'
                                    : 'destructive'
                              }
                            >
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {request.status === 'pending' && (
                              <div className="flex gap-2">
                                {user?.id === request.managerId && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleApprove(request.id)}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleReject(request.id)}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}
                                {(user?.id === request.trainerId || user?.id === request.managerId) && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      console.log(`Delete button clicked for request ${request.id}`);
                                      console.log(`Request details:`, request);
                                      handleDelete(request.id);
                                    }}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Alert>
                    <AlertDescription>
                      No phase change requests found.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
        <TabsContent value="refreshers" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Refresher Trainings</h2>
              {batchId && user?.organizationId ? (
                <RefreshersList 
                  batchId={parseInt(batchId)} 
                  organizationId={user.organizationId} 
                />
              ) : (
                <p>Loading refresher data...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Batch History</h2>
              </div>
              <BatchTimeline batchId={batchId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}