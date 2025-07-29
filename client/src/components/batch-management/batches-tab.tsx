import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { isSubordinate, getAllSubordinates } from "@/lib/hierarchy-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Plus, Trash2, Edit, Eye, Calendar as CalendarIcon, List, ArrowUpDown, Filter, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { CreateBatchForm } from "./create-batch-form";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { format } from "date-fns";
import type { OrganizationBatch, OrganizationLocation, OrganizationLineOfBusiness, OrganizationProcess, User } from "@shared/schema";
import { AddTraineeForm } from "./add-trainee-form";
import { Progress } from "@/components/ui/progress"; // Import Progress component
import { useLocation } from "wouter";
import { TraineeManagement } from "./trainee-management";

// Generic batch interface
interface BatchInterface {
  id: number;
  name: string;
  organizationId: number;
  processId: number | null;
  locationId: number | null;
  lineOfBusinessId: number | null;
  trainerId: number | null;
  capacityLimit?: number;
  enrolledCount?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
  inductionStartDate?: string;
  inductionEndDate?: string;
  trainingStartDate?: string;
  trainingEndDate?: string;
  certificationStartDate?: string;
  certificationEndDate?: string;
  ojtStartDate?: string;
  ojtEndDate?: string;
  ojtCertificationStartDate?: string;
  ojtCertificationEndDate?: string;
  handoverToOpsDate?: string;
  batchCategory?: 'new_training' | 'upskill';
  weeklyOffDays?: string[];
  considerHolidays?: boolean | null;
  createdAt?: Date;
}

// Extended type with relations for batch display
interface BatchWithRelations extends BatchInterface {
  userCount: number;
  location?: {
    id: number;
    name: string;
  } | null;
  line_of_business?: {
    id: number;
    name: string;
  } | null;
  process?: {
    id: number;
    name: string;
  } | null;
  trainer?: {
    id: number;
    fullName: string;
  } | null;
}

interface BatchesTabProps {
  onCreate?: () => void;
}

export function BatchesTab({ onCreate }: BatchesTabProps) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  // Removed isCreateDialogOpen state to prevent duplicate dialogs
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<BatchWithRelations | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedLineOfBusiness, setSelectedLineOfBusiness] = useState<string | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  const [isAddTraineeDialogOpen, setIsAddTraineeDialogOpen] = useState(false);
  const [selectedBatchForTrainee, setSelectedBatchForTrainee] = useState<BatchWithRelations | null>(null);
  const [selectedBatchForDetails, setSelectedBatchForDetails] = useState<BatchWithRelations | null>(null);
  const [isTraineeDialogOpen, setIsTraineeDialogOpen] = useState(false);

  const canManageBatches = hasPermission("manage_batches");
  const canAddBatchUsers = hasPermission("manage_batch_users_add");
  const canRemoveBatchUsers = hasPermission("manage_batch_users_remove");

  // Query to get all users for hierarchy checking
  const {
    data: allUsers = [],
    isLoading: isLoadingUsers
  } = useQuery<User[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/users`],
    enabled: !!user?.organizationId
  });

  const {
    data: batches = [],
    isLoading,
    error
  } = useQuery<BatchWithRelations[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId
  });

  const locations = Array.from(new Set(batches.map(batch => batch.location?.name).filter(Boolean) as string[]));
  const lineOfBusinesses = Array.from(new Set(batches.map(batch => batch.line_of_business?.name).filter(Boolean) as string[]));
  const processes = Array.from(new Set(batches.map(batch => batch.process?.name).filter(Boolean) as string[]));
  const statuses = Array.from(new Set(batches.map(batch => batch.status)));

  // Calculate subordinates for the current user with detailed debug logging
  const userSubordinates = useMemo(() => {
    if (!user || !allUsers || allUsers.length === 0) {
      console.warn('Cannot calculate subordinates - missing user or allUsers data');
      return [];
    }
    
    console.log('HIERARCHY DEBUG - Current user:', {
      id: user.id,
      name: user.fullName || user.username,
      role: user.role,
      managerId: user.managerId
    });
    
    console.log('HIERARCHY DEBUG - All users reporting relationships:', 
      allUsers.map(u => ({
        id: u.id,
        name: u.fullName || u.username,
        role: u.role,
        reportsTo: u.managerId
      }))
    );
    
    // For roles other than manager, return empty array
    if (user.role !== 'manager' && user.role !== 'admin' && user.role !== 'owner') {
      console.log('HIERARCHY DEBUG - User is not a manager/admin/owner, no subordinates');
      return [];
    }
    
    // Get all subordinates using hierarchy utils
    try {
      // Get direct reports first for clearer debugging
      const directReports = allUsers.filter(u => u.managerId === user.id);
      console.log('HIERARCHY DEBUG - Direct reports:', 
        directReports.map(u => ({ id: u.id, name: u.fullName || u.username, role: u.role }))
      );
      
      // Get all subordinates (direct + indirect)
      const allSubs = getAllSubordinates(user.id, allUsers);
      console.log('HIERARCHY DEBUG - All subordinates (including indirect):', 
        allSubs.map(u => ({ id: u.id, name: u.fullName || u.username, role: u.role }))
      );
      
      return allSubs;
    } catch (error) {
      console.error('Error calculating subordinates:', error);
      return [];
    }
  }, [user, allUsers]);
  
  // Debug logging for reporting hierarchy
  useEffect(() => {
    if (userSubordinates.length > 0) {
      console.log('HIERARCHY DEBUG - Trainer subordinates:', 
        userSubordinates
          .filter(u => u.role === 'trainer')
          .map(u => ({ 
            id: u.id, 
            name: u.fullName || u.username,
            managerId: u.managerId 
          }))
      );
    } else {
      console.warn('HIERARCHY DEBUG - No subordinates found for current user');
    }
  }, [userSubordinates, user]);

  // Apply role-based permissions for batch filtering
  const roleBatchFilter = (batch: BatchWithRelations) => {
    if (!user) return false;
    
    // Owner/Admin can see all batches
    if (user.role === 'owner' || user.role === 'admin') {
      console.log(`BATCH FILTER - User ${user.fullName} (${user.role}) has full access to batch ${batch.name} (ID: ${batch.id})`);
      return true;
    }
    
    // Trainers can only see their assigned batches
    if (user.role === 'trainer') {
      const hasAccess = batch.trainerId === user.id;
      console.log(`BATCH FILTER - Trainer ${user.fullName} checking access to batch ${batch.name} (ID: ${batch.id}): ${hasAccess ? 'GRANTED' : 'DENIED'}`);
      return hasAccess;
    }
    
    // Managers can see batches where they are the manager or batches assigned to trainers that report to them
    if (user.role === 'manager') {
      // Direct assignment to manager
      if (batch.trainerId === user.id) {
        console.log(`BATCH FILTER - Manager ${user.fullName} has direct access to batch ${batch.name} (ID: ${batch.id}) as trainer`);
        return true;
      }
      
      // If the batch has a trainer, check if that trainer reports DIRECTLY to this manager
      if (batch.trainerId) {
        // STRICT CHECK: Only direct reports can be seen
        const isDirectReport = allUsers.some(u => 
          u.id === batch.trainerId && u.managerId === user.id
        );
        
        const trainerName = batch.trainer?.fullName || `Trainer ID: ${batch.trainerId}`;
        
        console.log(`BATCH FILTER - Manager ${user.fullName} (ID: ${user.id}) checking access to batch ${batch.name} (ID: ${batch.id}) assigned to ${trainerName}: ${isDirectReport ? 'GRANTED' : 'DENIED'}`);
        
        return isDirectReport;
      }
      
      console.log(`BATCH FILTER - Cannot determine trainer for batch ${batch.name} (ID: ${batch.id})`);
      return false;
    }
    
    // For other roles, show batches based on general permissions
    const hasAccess = hasPermission("view_batches");
    console.log(`BATCH FILTER - User ${user.fullName} (${user.role}) checking access to batch ${batch.name} (ID: ${batch.id}) based on permissions: ${hasAccess ? 'GRANTED' : 'DENIED'}`);
    return hasAccess;
  };

  const filteredBatches = batches.filter(batch => {
    // First apply role-based permissions filter
    if (!roleBatchFilter(batch)) {
      return false;
    }

    // Then apply user-selected filters
    return (
      (searchQuery === '' ||
        batch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (batch.status?.toLowerCase() || '').includes(searchQuery.toLowerCase())) &&
      (selectedCategory === null || batch.batchCategory === selectedCategory) &&
      (selectedStatus === null || batch.status === selectedStatus) &&
      (selectedLocation === null || batch.location?.name === selectedLocation) &&
      (selectedLineOfBusiness === null || batch.line_of_business?.name === selectedLineOfBusiness) &&
      (selectedProcess === null || batch.process?.name === selectedProcess) &&
      (!dateRange.from || (batch.startDate && new Date(batch.startDate) >= dateRange.from)) &&
      (!dateRange.to || (batch.startDate && new Date(batch.startDate) <= dateRange.to))
    );
  });

  const formatBatchCategory = (category: string | undefined | null) => {
    if (!category) return 'N/A';
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: number) => {
      try {
        const response = await fetch(`/api/organizations/${user?.organizationId}/batches/${batchId}`, {
          method: 'DELETE',
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.traineesCount) {
            throw {
              ...data,
              type: 'TRAINEES_EXIST'
            };
          }
          throw new Error(data.message || 'Failed to delete batch');
        }

        return data;
      } catch (error: any) {
        if (error.type === 'TRAINEES_EXIST') {
          throw error;
        }
        throw new Error('Failed to process delete request');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/batches`] });
      toast({
        title: "Success",
        description: "Batch deleted successfully",
      });
      setDeleteDialogOpen(false);
      setDeleteConfirmation('');
    },
    onError: (error: any) => {
      console.log('Delete batch error:', error);

      if (error.type === 'TRAINEES_EXIST') {
        // Close delete dialog and open trainee management
        setDeleteDialogOpen(false);
        setDeleteConfirmation('');
        setSelectedBatchForDetails(selectedBatch);
        setIsTraineeDialogOpen(true);

        toast({
          title: "Cannot Delete Batch",
          description: `This batch has ${error.traineesCount || 'active'} trainees assigned. Please use the trainee management window to transfer or remove all trainees before deleting the batch.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to delete batch",
          variant: "destructive",
        });
        setDeleteDialogOpen(false);
        setDeleteConfirmation('');
      }
    }
  });

  const handleDeleteClick = (batch: BatchWithRelations) => {
    if (batch.status !== 'planned') {
      toast({
        title: "Cannot Delete",
        description: "Only batches with 'Planned' status can be deleted",
        variant: "destructive",
      });
      return;
    }
    setSelectedBatch(batch);
    setSelectedBatchId(batch.id);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (batch: BatchWithRelations) => {
    if (batch.status !== 'planned') {
      toast({
        title: "Cannot Edit",
        description: "Only batches with 'Planned' status can be edited",
        variant: "destructive",
      });
      return;
    }
    setSelectedBatch(batch);
    setIsEditDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedBatch || !selectedBatchId) return;

    if (deleteConfirmation !== selectedBatch.name) {
      toast({
        title: "Error",
        description: "Batch name confirmation does not match",
        variant: "destructive",
      });
      return;
    }

    try {
      await deleteBatchMutation.mutateAsync(selectedBatchId);
    } catch (error) {
      // Error will be handled by onError callback
      console.error('Delete batch error:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ongoing':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'planned':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'completed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderCalendarDay = (day: Date) => {
    const dayBatches = getBatchesForDate(day);
    const maxVisibleBatches = 4;
    const hasMoreBatches = dayBatches.length > maxVisibleBatches;
    const visibleBatches = hasMoreBatches ? dayBatches.slice(0, maxVisibleBatches) : dayBatches;
    const extraBatchesCount = dayBatches.length - maxVisibleBatches;

    return (
      <div className="w-full h-full min-h-[100px] p-2 relative">
        <div className="font-medium border-b border-gray-100 dark:border-gray-800 pb-1 mb-2">
          {format(day, 'd')}
        </div>
        {dayBatches.length > 0 && (
          <div className="absolute bottom-2 left-0 right-0 flex flex-wrap gap-1 justify-center">
            {visibleBatches.map((batch) => (
              <Popover key={batch.id}>
                <PopoverTrigger asChild>
                  <div
                    className={`
                      w-2 h-2 rounded-full cursor-pointer
                      transform transition-all duration-200 ease-in-out
                      hover:scale-150
                      ${batch.status === 'planned'
                        ? 'bg-blue-500 hover:bg-blue-600'
                        : batch.status === 'completed'
                        ? 'bg-gray-500 hover:bg-gray-600'
                        : 'bg-green-500 hover:bg-green-600'}
                    `}
                  />
                </PopoverTrigger>
                <PopoverContent
                  className="w-96 p-4 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                  align="start"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start border-b pb-2">
                      <div>
                        <h4 className="font-semibold text-lg group-hover:text-primary transition-colors">
                          {batch.name}
                        </h4>
                        <Badge
                          variant="outline"
                          className="mt-2 transition-colors hover:bg-secondary"
                        >
                          {formatBatchCategory(batch.batchCategory)}
                        </Badge>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${getStatusColor(batch.status || 'planned')} transition-all hover:scale-105`}
                      >
                        {batch.status ? batch.status.charAt(0).toUpperCase() + batch.status.slice(1) : 'Planned'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="col-span-2 space-y-2">
                        {[
                          { label: 'Process', value: batch.process?.name },
                          { label: 'Location', value: batch.location?.name },
                          { label: 'Trainer', value: batch.trainer?.fullName },
                          { label: 'Capacity', value: `${batch.userCount} / ${batch.capacityLimit}` },
                          {
                            label: 'Timeline',
                            value: batch.startDate && batch.endDate ? 
                              `${format(new Date(batch.startDate), 'MMM d, yyyy')} - ${format(new Date(batch.endDate), 'MMM d, yyyy')}` :
                              'Not set'
                          }
                        ].map(({ label, value }) => (
                          <div
                            key={label}
                            className="flex justify-between items-center p-1 rounded hover:bg-secondary/10 transition-colors"
                          >
                            <span className="text-muted-foreground">{label}:</span>
                            <span className="font-medium">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {canManageBatches && batch.status === 'planned' && (
                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(batch)}
                          className="transition-all hover:scale-105 hover:bg-secondary/20"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(batch)}
                          className="transition-all hover:scale-105 hover:bg-destructive/20"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            ))}
            {hasMoreBatches && (
              <Popover>
                <PopoverTrigger asChild>
                  <div className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-primary transition-colors">
                    +{extraBatchesCount} more
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                  <div className="space-y-1">
                    {dayBatches.slice(maxVisibleBatches).map((batch) => (
                      <div
                        key={batch.id}
                        className="flex items-center justify-between p-2 rounded hover:bg-secondary/10 transition-colors"
                      >
                        <span className="text-sm font-medium">{batch.name}</span>
                        <Badge
                          variant="secondary"
                          className={getStatusColor(batch.status || 'planned')}
                        >
                          {batch.status ? batch.status.charAt(0).toUpperCase() + batch.status.slice(1) : 'Planned'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
      </div>
    );
  };

  const sortData = (data: BatchWithRelations[], key: string, direction: 'asc' | 'desc') => {
    return [...data].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch(key) {
        case 'location':
          aValue = a.location?.name ?? '';
          bValue = b.location?.name ?? '';
          break;
        case 'line_of_business':
          aValue = a.line_of_business?.name ?? '';
          bValue = b.line_of_business?.name ?? '';
          break;
        case 'process':
          aValue = a.process?.name ?? '';
          bValue = b.process?.name ?? '';
          break;
        case 'startDate':
          aValue = a.startDate ? new Date(a.startDate).getTime() : 0;
          bValue = b.startDate ? new Date(b.startDate).getTime() : 0;
          break;
        case 'batchCategory':
          aValue = a.batchCategory ?? '';
          bValue = b.batchCategory ?? '';
          break;
        default:
          aValue = (a as any)[key] ?? '';
          bValue = (b as any)[key] ?? '';
      }

      if (direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';

    if (sortConfig && sortConfig.key === key) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }

    setSortConfig({ key, direction });
  };

  const sortedBatches = sortConfig
    ? sortData(filteredBatches, sortConfig.key, sortConfig.direction)
    : filteredBatches;


  const getBatchesForDate = (date: Date) => {
    return filteredBatches.filter(batch => {
      if (!batch.startDate || !batch.endDate) return false;
      const startDate = new Date(batch.startDate);
      const endDate = new Date(batch.endDate);
      return date >= startDate && date <= endDate;
    });
  };

  const resetFilters = () => {
    setSelectedStatus(null);
    setSelectedLocation(null);
    setSelectedLineOfBusiness(null);
    setSelectedProcess(null);
    setDateRange({ from: undefined, to: undefined });
    setSearchQuery('');
    setSelectedCategory(null);
  };

  const batchCategories = ['new_training', 'upskill'] as const;

  const handleCategoryChange = (value: string) => {
    console.log('Debug - Category Changed:', {
      newValue: value,
      willBecome: value === 'all' ? null : value
    });
    setSelectedCategory(value === 'all' ? null : value);
  };

  const handleAddTraineeClick = (batch: BatchWithRelations) => {
    if (!canAddBatchUsers) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to add trainees to batches",
        variant: "destructive",
      });
      return;
    }
    setSelectedBatchForTrainee(batch);
    setIsAddTraineeDialogOpen(true);
  };

  const handleBatchClick = (batch: BatchWithRelations) => {
    setSelectedBatchForDetails(batch);
    setIsTraineeDialogOpen(true);
  };

  const renderBatchTable = (batchList: BatchWithRelations[]) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead
              className="w-[150px] text-center cursor-pointer hover:bg-muted/70 transition-colors"
              onClick={() => handleSort('startDate')}
            >
              <div className="flex items-center justify-center gap-1">
                Start Date
                {sortConfig?.key === 'startDate' && (
                  <ArrowUpDown className={`h-4 w-4 ${sortConfig.direction === 'asc' ? 'rotate-0' : 'rotate-180'}`} />
                )}
              </div>
            </TableHead>
            <TableHead
              className="text-center cursor-pointer hover:bg-muted/70 transition-colors"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center justify-center gap-1">
                Batch Name
                {sortConfig?.key === 'name' && (
                  <ArrowUpDown className={`h-4 w-4 ${sortConfig.direction === 'asc' ? 'rotate-0' : 'rotate-180'}`} />
                )}
              </div>
            </TableHead>
            <TableHead
              className="text-center cursor-pointer hover:bg-muted/70 transition-colors"
              onClick={() => handleSort('batchCategory')}
            >
              <div className="flex items-center justify-center gap-1">
                Category
                {sortConfig?.key === 'batchCategory' && (
                  <ArrowUpDown className={`h-4 w-4 ${sortConfig.direction === 'asc' ? 'rotate-0' : 'rotate-180'}`} />
                )}
              </div>
            </TableHead>
            <TableHead className="text-center">Location</TableHead>
            <TableHead className="text-center">Line of Business</TableHead>
            <TableHead className="text-center">Process</TableHead>
            <TableHead className="text-center">Trainer</TableHead>
            <TableHead className="text-center">Capacity</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batchList.map((batch) => (
            <TableRow
              key={batch.id}
              className="hover:bg-muted/50 transition-colors group cursor-pointer"
              onClick={(e) => {
                // Prevent click if clicking on action buttons
                if ((e.target as HTMLElement).closest('.action-buttons')) {
                  e.stopPropagation();
                  return;
                }
                handleBatchClick(batch);
              }}
            >
              <TableCell className="font-medium text-center whitespace-nowrap">
                {batch.startDate ? format(new Date(batch.startDate), 'MMM d, yyyy') : 'Not set'}
              </TableCell>
              <TableCell className="text-center">
                <div className="font-semibold group-hover:text-primary transition-colors">
                  {batch.name}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant="outline"
                  className={`
                    ${batch.batchCategory === 'new_training' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : ''}
                    ${batch.batchCategory === 'upskill' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' : ''}
                    px-2 py-1 inline-flex justify-center
                  `}
                >
                  {formatBatchCategory(batch.batchCategory)}
                </Badge>
              </TableCell>
              <TableCell className="text-center">{batch.location?.name || '-'}</TableCell>
              <TableCell className="text-center">{batch.line_of_business?.name || '-'}</TableCell>
              <TableCell className="text-center">{batch.process?.name || '-'}</TableCell>
              <TableCell className="text-center">{batch.trainer?.fullName || '-'}</TableCell>
              <TableCell className="text-center">
                <div className="font-medium">
                  {`${batch.userCount} / ${batch.capacityLimit}` || '-'}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant="secondary"
                  className={`${getStatusColor(batch.status || 'planned')} px-2 py-1 inline-flex justify-center`}
                >
                  {batch.status ? batch.status.charAt(0).toUpperCase() + batch.status.slice(1) : 'Planned'}
                </Badge>
              </TableCell>
              <TableCell className="text-right p-2 min-w-[120px]">
                <div className="flex items-center justify-end gap-1 action-buttons">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/batch-dashboard/${batch.id}`);
                          }}
                          className="h-7 w-7 p-0 text-blue-600"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View Dashboard</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>View Batch Dashboard</p>
                      </TooltipContent>
                    </Tooltip>
                    
                    {canAddBatchUsers && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAddTraineeClick(batch)}
                            className="h-7 w-7 p-0 text-green-600"
                          >
                            <UserPlus className="h-4 w-4" />
                            <span className="sr-only">Add Trainee</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>Add Trainee to Batch</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    {canManageBatches && batch.status === 'planned' && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditClick(batch)}
                              className="h-7 w-7 p-0 text-primary"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Edit Batch</p>
                          </TooltipContent>
                        </Tooltip>
                        
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(batch)}
                              className="h-7 w-7 p-0 text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Delete Batch</p>
                          </TooltipContent>
                        </Tooltip>
                      </>
                    )}
                  </TooltipProvider>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  // All debug logging has been removed

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-destructive">
        Error loading batches. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search batches..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {canManageBatches && (
            <Button
              onClick={() => {
                // Only trigger the onCreate callback which is handled by BatchDetail parent component
                try {
                  onCreate?.();
                } catch (error) {
                  console.error('Error opening create dialog:', error);
                  // Fallback in case of errors
                  toast({
                    title: "Action in progress",
                    description: "Opening create batch form...",
                  });
                }
              }}
              className="gap-2 ml-4"
            >
              <Plus className="h-4 w-4" />
              Create Batch
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Select
            value={selectedCategory || 'all'}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="new_training">New Training</SelectItem>
              <SelectItem value="upskill">Upskill</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus || 'all'} onValueChange={(value) => setSelectedStatus(value === 'all' ? null : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedLocation || 'all'} onValueChange={(value) => setSelectedLocation(value === 'all' ? null : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location} value={location}>
                  {location}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedLineOfBusiness || 'all'} onValueChange={(value) => setSelectedLineOfBusiness(value === 'all' ? null : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Line of Business" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lines of Business</SelectItem>
              {lineOfBusinesses.map((lob) => (
                <SelectItem key={lob} value={lob}>
                  {lob}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedProcess || 'all'} onValueChange={(value) => setSelectedProcess(value === 'all' ? null : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Process" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Processes</SelectItem>
              {processes.map((process) => (
                <SelectItem key={process} value={process}>
                  {process}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={resetFilters}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Reset Filters
          </Button>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={dateRange.from ? 'text-primary w-full' : 'w-full'}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                "Filter by Date Range"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={{
                from: dateRange.from,
                to: dateRange.to,
              }}
              onSelect={(range) => setDateRange({
                from: range?.from,
                to: range?.to,
              })}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
        {batches.length > 0 ? (
          <Tabs defaultValue="table" className="w-full">
            <TabsList>
              <TabsTrigger value="table" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                Table View
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Calendar View
              </TabsTrigger>
            </TabsList>

            <TabsContent value="table" className="space-y-6">
              {renderBatchTable(sortedBatches)}
            </TabsContent>

            <TabsContent value="calendar" className="space-y-6">
              <div className="rounded-md border p-6">
                <Calendar
                  mode="single"
                  disabled={false}
                  components={{
                    Day: ({ date }) => renderCalendarDay(date)
                  }}
                  className="w-full"
                  classNames={{
                    cell: "h-24 w-24 p-0 border-2 border-gray-100 dark:border-gray-800",
                    head_cell: "text-muted-foreground font-normal border-b-2 border-gray100 dark:border-gray-800 p-2",
                    table: "border-collapse border-spacing-0 border-2 border-gray-100 dark:border-gray-800",
                    day: "h-full rounded-none hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:bg-gray-50 dark:focus-visible:bg-gray800",
                    nav_button: "h-12 w-12 bg-primary/10 hover:bg-primary/20 p-0 opacity-90 hover:opacity-100 absolute top-[50%] -translate-y-1/2 flex items-center justify-center rounded-full transition-all shadow-sm hover:shadowmd border border-primary/20",                    nav_button_previous:"left-4",
                    nav_button_next: "right-4",
                    nav: "relative flex items-center justify-between pt-4 pb-10 px-2 border-b-2 border-gray-100 dark:border-gray-800 mb-4",
                    caption: "text-2xl font-semibold text-center flex-1px-10",
                    caption_label: "text-lg font-medium"
                  }}
                />
                <div className="mt-6 flex items-center gap-6 text-sm border-t pt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="font-medium">Planned</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h3 h-3 rounded-full bg-green-500" />
                    <span className="font-medium">Ongoing</span></div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-500" />
                    <span className="font-medium">Completed</span>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed p-8 text-center animate-in fade-in-50">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
              <h3 className="mt-4 text-lg font-semibold">No batches found</h3>
              <p className="mb-4 mt-2 text-sm text-muted-foreground">
                You haven't created any batches yet. Start by creating a new batch.
              </p>
              {canManageBatches && (
                <Button
                  size="sm"
                  className="relative"
                  onClick={() => {
                    // Only trigger the onCreate callback which is handled by BatchDetail parent component
                    try {
                      onCreate?.();
                    } catch (error) {
                      console.error('Error opening create dialog:', error);
                      // Fallback in case of errors
                      toast({
                        title: "Action in progress",
                        description: "Opening create batch form...",
                      });
                    }
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Batch
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Create Batch Dialog was removed to prevent duplicate dialogs
            The dialog is now managed by the BatchDetail parent component */}

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Edit Batch</DialogTitle>
              <DialogDescription>
                Make changes to the batch details.
              </DialogDescription>
            </DialogHeader>
            {selectedBatch && (
              <CreateBatchForm
                editMode={true}
                batchData={selectedBatch}
                onSuccess={() => setIsEditDialogOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>Only batches with no trainees and 'Planned' status can be deleted.</p>
                  <p className="font-medium">To confirm deletion, type the batch name:</p>
                  <p className="text-primary font-mono">{selectedBatch?.name}</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Input
                  type="text"
                  placeholder="Type batch name to confirm"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="w-full"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteConfirmation('');
                }}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  disabled={!selectedBatch || deleteConfirmation !== selectedBatch.name}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Batch
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>

        </AlertDialog>
        <Dialog 
          open={isAddTraineeDialogOpen} 
          onOpenChange={setIsAddTraineeDialogOpen}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Trainee to Batch</DialogTitle>
              <DialogDescription>
                Add a new trainee to batch: {selectedBatchForTrainee?.name}
              </DialogDescription>
            </DialogHeader>
            {selectedBatchForTrainee && (
              <AddTraineeForm 
                batch={selectedBatchForTrainee}
                onSuccess={() => {
                  setIsAddTraineeDialogOpen(false);
                  queryClient.invalidateQueries({ 
                    queryKey: [`/api/organizations/${user?.organizationId}/batches`] 
                  });
                }}
              />
            )}
          </DialogContent>
        </Dialog>
        {/* Trainee Management Dialog */}
        <Dialog open={isTraineeDialogOpen} onOpenChange={setIsTraineeDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Manage Trainees - {selectedBatchForDetails?.name}
              </DialogTitle>
            </DialogHeader>
            {selectedBatchForDetails && (
              <TraineeManagement
                batchId={selectedBatchForDetails.id}
                organizationId={user?.organizationId || 0}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}