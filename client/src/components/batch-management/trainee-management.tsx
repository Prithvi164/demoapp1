import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Edit, 
  Trash2, 
  ArrowRightLeft, 
  Loader2, 
  ClipboardCheck, 
  RefreshCcw, 
  CheckCircle, 
  XCircle, 
  FileText, 
  BarChart 
} from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { isSubordinate, getAllSubordinates } from "@/lib/hierarchy-utils";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Updated type to match actual API response
type Trainee = {
  id: number;
  userId: number;
  userBatchProcessId: number; // The ID of the user_batch_processes record
  employeeId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  dateOfJoining: string;
  // New fields for trainee status tracking
  traineeStatus?: 'planned' | 'induction' | 'training' | 'certification' | 'ojt' | 'ojt_certification' | 'completed' | 'refresher' | 'refer_to_hr' | 'left_job' | null;
  isManualStatus?: boolean;
};

// Type for quiz attempts
type QuizAttempt = {
  id: number;
  userId: number;
  quizId: number;
  score: number;
  completedAt: string;
  isPassed: boolean;
  user?: {
    id: number;
    fullName: string;
    employeeId?: string;
  };
  quiz?: {
    id: number;
    name: string;
    description?: string | null;
    passingScore: number;
  };
};

interface TraineeManagementProps {
  batchId: number;
  organizationId: number;
}

export function TraineeManagement({ batchId, organizationId }: TraineeManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(null);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [isManualStatusOverride, setIsManualStatusOverride] = useState(false);
  
  // Check permissions for managing trainees
  const { hasPermission } = usePermissions();
  // Check if user has full trainee management permissions
  const hasFullAccess = hasPermission('manage_trainee_management');
  // For backward compatibility, still check the batch-specific permissions
  const canRemoveBatchUsers = hasFullAccess || hasPermission('manage_batch_users_remove');
  
  // Use hierarchy utility functions for permission checks
  
  // Define User type
  type User = {
    id: number;
    username?: string;
    fullName?: string;
    employeeId?: string;
    role: 'owner' | 'admin' | 'manager' | 'team_lead' | 'quality_analyst' | 'trainer' | 'advisor' | 'trainee';
    managerId?: number | null;
    email?: string;
    phoneNumber?: string;
    dateOfJoining?: string;
    organizationId?: number;
    processId?: number;
    status?: string;
  };
  
  // Get user for hierarchy checks
  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });
  
  // Get all users for hierarchy checks
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: [`/api/organizations/${organizationId}/users`],
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
  
  // Define Batch type
  type Batch = {
    id: number;
    name: string;
    startDate: string;
    endDate?: string;
    status: string;
    location?: {
      id: number;
      name: string;
    };
    process?: {
      id: number;
      name: string;
    };
    line_of_business?: {
      id: number;
      name: string;
    };
    capacityLimit: number;
    trainer?: {
      id: number;
      fullName: string;
      email?: string;
      phoneNumber?: string;
    } | null;
  };
  
  // Fetch batch details to get trainer info
  const { data: batchDetails } = useQuery<Batch>({
    queryKey: [`/api/organizations/${organizationId}/batches/${batchId}`],
    enabled: !!batchId && !!organizationId,
  });

  // Check if the current user can view this batch based on hierarchy
  const canViewBatch = () => {
    if (!currentUser || !batchDetails || !allUsers.length) return false;
    
    // Admins and owners can see all batches
    if (currentUser.role === 'admin' || currentUser.role === 'owner') return true;
    
    // Trainers can only see their assigned batches
    if (currentUser.role === 'trainer') {
      return batchDetails.trainer?.id === currentUser.id;
    }
    
    // Managers can see all batches - they should have broader access
    if (currentUser.role === 'manager') {
      return true; // Allow managers to view all batches
    }
    
    // Team leads can see batches they're the trainer for OR batches assigned to trainers who report to them
    if (currentUser.role === 'team_lead') {
      // Direct assignment to team lead
      if (batchDetails.trainer?.id === currentUser.id) return true;
      
      // Check if trainer reports to this team lead
      return batchDetails.trainer && isSubordinate(currentUser.id, batchDetails.trainer.id, allUsers);
    }
    
    return false;
  };

  // Fetch trainees for the current batch
  const { data: trainees = [], isLoading, error } = useQuery<Trainee[]>({
    queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`],
    enabled: !!batchId && !!organizationId && canViewBatch(),
  });

  // Fetch quiz attempts for trainees in this batch
  const { data: quizAttempts = [], isLoading: isLoadingAttempts } = useQuery<QuizAttempt[]>({
    queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/quiz-attempts`],
    enabled: !!batchId && !!organizationId && canViewBatch() && batchDetails?.status === 'training',
  });

  // Fetch all other batches for transfer (filtered by hierarchy)
  const { data: allBatchesRaw = [] } = useQuery<Batch[]>({
    queryKey: [`/api/organizations/${organizationId}/batches`],
    enabled: !!organizationId,
  });
  
  // Filter batches for transfers based on reporting hierarchy
  const allBatches = allBatchesRaw.filter((batch: Batch) => {
    if (!currentUser) return false;
    
    // Admins and owners can see all batches
    if (currentUser.role === 'admin' || currentUser.role === 'owner') return true;
    
    // Trainers can only see their assigned batches
    if (currentUser.role === 'trainer') {
      return batch.trainer?.id === currentUser.id;
    }
    
    // Managers can see all batches for consistency with canViewBatch
    if (currentUser.role === 'manager') {
      return true;
    }
    
    // Team leads can see batches they're the trainer for OR batches assigned to trainers who report to them
    if (currentUser.role === 'team_lead') {
      // Direct assignment to team lead
      if (batch.trainer?.id === currentUser.id) return true;
      
      // Check if trainer reports to this team lead
      return batch.trainer && isSubordinate(currentUser.id, batch.trainer.id, allUsers);
    }
    
    return false;
  });

  // Helper function to safely format dates
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PP') : 'N/A';
  };

  // Debug logging with proper type handling
  console.log('Debug - Trainees:', { 
    trainees, 
    isLoading, 
    error,
    sampleTrainee: Array.isArray(trainees) && trainees.length > 0 ? trainees[0] : null,
    traineeCount: Array.isArray(trainees) ? trainees.length : 0 
  });

  // Delete trainee mutation - using user_batch_process.id
  const deleteTraineeMutation = useMutation({
    mutationFn: async (userBatchProcessId: number) => {
      console.log('Deleting trainee batch process:', userBatchProcessId);
      const response = await fetch(
        `/api/organizations/${organizationId}/batches/${batchId}/trainees/${userBatchProcessId}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete trainee");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate the current batch's trainee list
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`]
      });

      // Invalidate batches to update counts
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${organizationId}/batches`]
      });

      toast({
        title: "Success",
        description: "Trainee removed from batch successfully",
      });
      setIsDeleteDialogOpen(false);
      setSelectedTrainee(null);
    },
    onError: (error: Error) => {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update trainee status mutation
  const updateTraineeStatusMutation = useMutation({
    mutationFn: async ({ 
      traineeId, 
      status, 
      isManualStatus 
    }: { 
      traineeId: number; 
      status: string | null; 
      isManualStatus: boolean 
    }) => {
      console.log('Updating trainee status:', { traineeId, status, isManualStatus });

      const response = await fetch(
        `/api/organizations/${organizationId}/batches/${batchId}/trainees/${traineeId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            traineeStatus: status,
            isManualStatus
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update trainee status");
      }

      const result = await response.json();
      console.log('Status update response:', result);
      return result;
    },
    onSuccess: () => {
      // Invalidate the current batch's trainee list
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`]
      });

      // Close dialogs and reset state
      setIsStatusDialogOpen(false);
      setSelectedTrainee(null);
      setSelectedStatus(null);
      setIsManualStatusOverride(false);

      toast({
        title: "Success",
        description: "Trainee status updated successfully",
      });
    },
    onError: (error: Error) => {
      console.error('Status update error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Transfer trainee mutation
  const transferTraineeMutation = useMutation({
    mutationFn: async ({ traineeId, newBatchId }: { traineeId: number; newBatchId: number }) => {
      console.log('Starting transfer:', { traineeId, newBatchId, currentBatchId: batchId });

      const response = await fetch(
        `/api/organizations/${organizationId}/batches/${batchId}/trainees/${traineeId}/transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newBatchId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to transfer trainee");
      }

      const result = await response.json();
      console.log('Transfer response:', result);
      return result;
    },
    onSuccess: () => {
      // Invalidate queries for both the source and destination batch
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${organizationId}/batches`]
      });

      // Invalidate the current batch's trainee list
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/trainees`]
      });

      // Close dialogs and reset state
      setIsTransferDialogOpen(false);
      setSelectedTrainee(null);

      toast({
        title: "Success",
        description: "Trainee transferred successfully",
      });
    },
    onError: (error: Error) => {
      console.error('Transfer error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check if the user has permission to view this batch
  if (batchDetails && currentUser && !canViewBatch()) {
    return (
      <div className="text-center py-8 text-destructive">
        <div className="mb-2 text-lg font-semibold">Access Denied</div>
        <p>You don't have permission to view trainees in this batch.</p>
        <p className="text-sm text-muted-foreground mt-2">
          This batch is assigned to a trainer who is not in your reporting hierarchy.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading trainees...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Error loading trainees. Please try again.
      </div>
    );
  }

  if (!trainees || trainees.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No trainees found in this batch.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <h2 className="text-lg font-semibold">Batch Trainees</h2>
        {batchDetails?.trainer && (
          <p className="text-sm text-muted-foreground">
            Trainer: <span className="font-medium">{batchDetails.trainer.fullName}</span>
          </p>
        )}
      </div>

      {/* Regular view for all batches - we've removed the Assessments & Certifications tab from here */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Date of Joining</TableHead>
              <TableHead>Trainee Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.isArray(trainees) && trainees.map((trainee: Trainee) => (
              <TableRow key={trainee.id}>
                <TableCell>{trainee.fullName}</TableCell>
                <TableCell>{trainee.employeeId}</TableCell>
                <TableCell>{trainee.email}</TableCell>
                <TableCell>{trainee.phoneNumber}</TableCell>
                <TableCell>{formatDate(trainee.dateOfJoining)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {trainee.traineeStatus ? (
                      <Badge variant={trainee.isManualStatus ? "secondary" : "default"} className="capitalize">
                        {trainee.traineeStatus.replace(/_/g, ' ')}
                        {trainee.isManualStatus && (
                          <span className="ml-1 text-xs opacity-70">(Manual)</span>
                        )}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Not set</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {canRemoveBatchUsers && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTrainee(trainee);
                          setIsTransferDialogOpen(true);
                        }}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                      </Button>
                    )}
                    {/* Edit status button - only visible for users with full management access */}
                    {hasFullAccess && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTrainee(trainee);
                          setSelectedStatus(trainee.traineeStatus || null);
                          setIsManualStatusOverride(trainee.isManualStatus || false);
                          setIsStatusDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canRemoveBatchUsers && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTrainee(trainee);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>


      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will remove the trainee
              from this batch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedTrainee) {
                  // Pass the user_batch_process.id directly
                  deleteTraineeMutation.mutate(selectedTrainee.id);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Trainee to Another Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a batch to transfer {selectedTrainee?.fullName} to:
            </p>
            <div className="space-y-2">
              {allBatches
                .filter((batch: Batch) => batch.id !== batchId && batch.status === 'planned')
                .map((batch: Batch) => (
                  <Button
                    key={batch.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      if (selectedTrainee) {
                        // Pass the correct IDs for transfer
                        transferTraineeMutation.mutate({
                          traineeId: selectedTrainee.id,
                          newBatchId: batch.id,
                        });
                      }
                    }}
                    disabled={transferTraineeMutation.isPending}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{batch.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(batch.startDate)} - {formatDate(batch.endDate)}
                      </span>
                    </div>
                  </Button>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trainee Status Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Trainee Status</DialogTitle>
            <DialogDescription>
              You can manually set a trainee's status, which will override the automatic status updates from batch phases.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="status">Trainee Status</Label>
              <Select 
                value={selectedStatus || undefined} 
                onValueChange={(value) => setSelectedStatus(value)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="induction">Induction</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="certification">Certification</SelectItem>
                  <SelectItem value="ojt">OJT</SelectItem>
                  <SelectItem value="ojt_certification">OJT Certification</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="refresher">Refresher</SelectItem>
                  <SelectItem value="refer_to_hr">Refer to HR</SelectItem>
                  <SelectItem value="left_job">Left Job</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="manual-override" 
                checked={isManualStatusOverride}
                onCheckedChange={(checked) => {
                  setIsManualStatusOverride(checked === true);
                }}
              />
              <Label
                htmlFor="manual-override"
                className="text-sm font-normal"
              >
                Set as manual override (prevents automatic updates from batch phases)
              </Label>
            </div>

            <div className="pt-4 flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsStatusDialogOpen(false);
                  setSelectedTrainee(null);
                  setSelectedStatus(null);
                  setIsManualStatusOverride(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedTrainee) {
                    updateTraineeStatusMutation.mutate({
                      traineeId: selectedTrainee.userBatchProcessId,
                      status: selectedStatus,
                      isManualStatus: isManualStatusOverride
                    });
                  }
                }}
                disabled={updateTraineeStatusMutation.isPending}
              >
                {updateTraineeStatusMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Status"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}