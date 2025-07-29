import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { User, Organization, OrganizationLocation, UserProcess, OrganizationLineOfBusiness, OrganizationProcess } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Search, Download, Upload, FileSpreadsheet, Check, Loader2, Users, Network, ChevronDown, ChevronRight, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import * as XLSX from "xlsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  getReportingChainUsers, 
  canEditUser, 
  isSubordinate, 
  getFormattedReportingPath
} from "@/lib/hierarchy-utils";
import { HierarchicalUserRow } from "./hierarchical-user-row";
import { FixedEditUserModal } from "./fixed-edit-user-modal";

// Extend the insertUserSchema for the edit form
// Using more explicit transformation to handle form values
const editUserSchema = insertUserSchema.extend({
  // Handle string IDs for select fields
  locationId: z.union([z.literal("none"), z.string()]).optional()
    .transform(val => val === "none" ? null : val),
  managerId: z.union([z.literal("none"), z.string()]).optional()
    .transform(val => val === "none" ? null : val),
  // String fields with proper handling for empty values
  dateOfJoining: z.string().optional()
    .transform(val => val === "" ? null : val),
  dateOfBirth: z.string().optional()
    .transform(val => val === "" ? null : val),
  education: z.string().optional()
    .transform(val => val === "" ? null : val),
  // Required fields
  category: z.string().default("active"),
  // Process selection
  processes: z.array(z.number()).optional().default([]),
}).omit({ certified: true }).partial();

type UserFormData = z.infer<typeof editUserSchema>;

export function UserManagement() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'flat' | 'hierarchy'>('hierarchy');
  const [expandedManagers, setExpandedManagers] = useState<number[]>([]);
  const [showHierarchicalFilter, setShowHierarchicalFilter] = useState<boolean>(false);
  
  // Auto-expand current user's node when switching to hierarchical view
  useEffect(() => {
    if (viewMode === 'hierarchy' && user?.id && !expandedManagers.includes(user.id)) {
      setExpandedManagers(prev => [...prev, user.id]);
    }
  }, [viewMode, user?.id]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Number of items to show per page

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      try {
        console.log('Attempting to deactivate user:', userId);
        const response = await apiRequest("DELETE", `/api/users/${userId}`);
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.message || "Failed to deactivate user");
        }

        if (!data?.success) {
          throw new Error(data?.message || "User deactivation failed");
        }

        return data;
      } catch (error) {
        console.error('Error in deactivate mutation:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "User deactivated successfully",
      });

      // Force refetch the users list
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.refetchQueries({ queryKey: ["/api/users"] });

      // Reset UI state
      setShowDeleteDialog(false);
      setUserToDelete(null);
      setDeleteConfirmation("");

      // Reset to first page if current page becomes empty
      if (currentUsers.length === 1 && currentPage > 1) {
        setCurrentPage(1);
      }
    },
    onError: (error: Error) => {
      console.error('Deactivate mutation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate user. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<User> }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update user");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      
      // Invalidate and refetch both users and user processes queries
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/processes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/batch-processes"] });
      
      // Force an immediate refetch
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
      queryClient.refetchQueries({ queryKey: ["/api/users/processes"] });
      queryClient.refetchQueries({ queryKey: ["/api/users/batch-processes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Function to toggle user status
  const toggleUserStatus = async (userId: number, currentStatus: boolean, userRole: string) => {
    try {
      if (userRole === "owner") {
        toast({
          title: "Error",
          description: "Owner status cannot be changed",
          variant: "destructive",
        });
        return;
      }

      await updateUserMutation.mutateAsync({
        id: userId,
        data: { active: !currentStatus }
      });
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  };

  // Add exportToExcel function after toggleUserStatus
  const exportToExcel = async () => {
    try {
      // Show an initial toast to let user know the export is processing
      toast({
        title: "Preparing Export",
        description: "Please wait while we prepare your Excel export...",
      });
      
      // First sheet with user details - Optimize by doing this once
      const usersDataToExport = users.map(user => ({
        'User ID': user.id,
        Username: user.username,
        'Full Name': user.fullName || '',
        Email: user.email,
        'Employee ID': user.employeeId || '',
        Role: user.role,
        Category: user.category || 'active',
        'Phone Number': user.phoneNumber || '',
        Location: getLocationName(user.locationId),
        Manager: getManagerName(user.managerId),
        'Date of Joining': user.dateOfJoining || '',
        'Date of Birth': user.dateOfBirth || '',
        Education: user.education || '',
        Status: user.active ? 'Active' : 'Inactive'
      }));

      // Second sheet with process details - Optimize by processing userProcesses once
      const processDataToExport = users.map(user => {
        const userProcessList = Array.isArray(userProcesses[user.id]) ? userProcesses[user.id] : [];
        return {
          'User ID': user.id,
          Username: user.username,
          'Full Name': user.fullName || '',
          Email: user.email,
          'Employee ID': user.employeeId || '',
          Category: user.category || 'active',
          'Processes': userProcessList.map((p: any) => p.processName || '').join(", ") || "No processes",
          'Process Count': userProcessList.length,
          'Process IDs': userProcessList.map((p: any) => p.processId || '').join(", ") || "",
          'Line of Business': userProcessList.map((p: any) => p.lineOfBusinessName || "").join(", ") || "",
          Status: user.active ? 'Active' : 'Inactive'
        };
      });

      // Create the third "user_batch" sheet with the requested columns
      const userBatchData = [];
      
      // Get all batches to retrieve additional batch information - reuse existing data if possible
      let allBatches: Record<number, any> = {};
      
      // Make a single API call for batches - use Promise to fetch data
      const batchPromise = fetch(`/api/organizations/${user?.organizationId}/batches`)
        .then(res => res.ok ? res.json() : [])
        .then(batchesData => {
          if (Array.isArray(batchesData)) {
            batchesData.forEach((batch: any) => {
              if (batch && batch.id) {
                allBatches[batch.id] = batch;
              }
            });
          }
          return allBatches;
        })
        .catch(err => {
          console.error("Error fetching batches:", err);
          return {};
        });
      
      // Use existing userBatchProcesses data if available to avoid extra API call
      let userBatchMap = userBatchProcesses;
      
      // Only fetch new data if existing data is empty or insufficient
      if (!userBatchMap || Object.keys(userBatchMap).length === 0) {
        try {
          const bpResponse = await fetch(`/api/users/batch-processes`);
          if (bpResponse.ok) {
            userBatchMap = await bpResponse.json();
          }
        } catch (error) {
          console.error("Error fetching batch processes:", error);
        }
      }
      
      // Wait for the batch data to be loaded
      allBatches = await batchPromise;
      
      // Process users in batches for better performance
      const processUserBatches = () => {
        // Iterate through each user efficiently
        for (const user of users) {
          // Get batch processes for this user
          const userBatchProcessList = Array.isArray(userBatchMap[user.id]) 
            ? userBatchMap[user.id] 
            : [];
            
          // Process each batch for this user
          for (const bp of userBatchProcessList) {
            // Skip if no batchId (avoid potential errors)
            if (!bp?.batchId) continue;
            
            // Get the batch information
            const batchInfo = allBatches[bp.batchId] || {};
            
            // Add a row to the export data
            userBatchData.push({
              // From User_Batch_Process table
              'User ID': user.id,
              'Batch ID': bp.batchId,
              'Role': user.role,
              
              // From Organisation_Batch table
              'Batch Name': bp.batchName || batchInfo.name || `Batch ${bp.batchId}`,
              'Batch Start Date': batchInfo.startDate 
                ? new Date(batchInfo.startDate).toISOString().split('T')[0] 
                : '',  
              'Batch End Date': batchInfo.endDate 
                ? new Date(batchInfo.endDate).toISOString().split('T')[0] 
                : '',
              'Status': bp.status || '',
              'Capacity': batchInfo.capacityLimit || '',
              'Batch Phase Status': batchInfo.status || '',
              'Trainer ID': bp.trainerId || batchInfo.trainerId || ''
            });
          }
        }
      };
      
      // Process the user batch data
      processUserBatches();

      // Create workbook and add the user details sheet
      const wb = XLSX.utils.book_new();
      const wsUsers = XLSX.utils.json_to_sheet(usersDataToExport);
      XLSX.utils.book_append_sheet(wb, wsUsers, "Users");
      
      // Add the process details sheet
      const wsProcesses = XLSX.utils.json_to_sheet(processDataToExport);
      XLSX.utils.book_append_sheet(wb, wsProcesses, "User Processes");
      
      // Add the new user_batch sheet with the requested columns
      const wsUserBatch = XLSX.utils.json_to_sheet(userBatchData);
      XLSX.utils.book_append_sheet(wb, wsUserBatch, "user_batch");
      
      // Save the file
      XLSX.writeFile(wb, `users_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      // Show success toast
      toast({
        title: "Export Successful",
        description: "User details, process information, and user batch data have been exported to Excel.",
      });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting the data. Please try again.",
        variant: "destructive"
      });
    }
  };


  // Find manager name for a user
  const getManagerName = (managerId: number | null) => {
    if (!managerId) return "No Manager";
    const manager = users.find(u => u.id === managerId);
    return manager ? manager.fullName || manager.username : "Unknown Manager";
  };

  // Find location name for a user
  const getLocationName = (locationId: number | null) => {
    if (!locationId) return "No Location";
    
    // First try from the dedicated locations array (from separate query)
    if (locations && locations.length > 0) {
      const location = locations.find(l => l.id === locationId);
      if (location) return location.name;
    }
    
    // Fallback to orgSettings locations
    if (orgSettings?.locations && Array.isArray(orgSettings.locations)) {
      const location = orgSettings.locations.find((l: OrganizationLocation) => l.id === locationId);
      if (location) return location.name;
    }
    
    // If neither source has the location, show a placeholder
    return isLoadingOrgSettings ? "Loading..." : "Unknown Location";
  };

  // Get hierarchy level
  const getHierarchyLevel = (userId: number): number => {
    let level = 0;
    let currentUser = users.find(u => u.id === userId);
    
    while (currentUser?.managerId) {
      level++;
      currentUser = users.find(u => u.id === currentUser?.managerId);
    }
    
    return level;
  };

  // Toggle expanded state for a manager
  const toggleManagerExpanded = (managerId: number) => {
    if (expandedManagers.includes(managerId)) {
      setExpandedManagers(expandedManagers.filter(id => id !== managerId));
    } else {
      setExpandedManagers([...expandedManagers, managerId]);
    }
  };
  
  // Expand all managers at once
  const expandAllManagers = () => {
    // Find all users who have direct reports (they are managers)
    const allManagerIds = users
      .filter(u => users.some(user => user.managerId === u.id))
      .map(u => u.id);
    setExpandedManagers(allManagerIds);
    
    toast({
      title: "Hierarchy Expanded",
      description: `Expanded all ${allManagerIds.length} managers in the hierarchy view.`
    });
  };
  
  // Collapse all expanded managers
  const collapseAllManagers = () => {
    setExpandedManagers([]);
    
    toast({
      title: "Hierarchy Collapsed",
      description: "Collapsed all managers in the hierarchy view."
    });
  };
  
  // Handle delete confirmation
  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  // Check if a user is in the current user's reporting chain
  const isInCurrentUserHierarchy = (targetUserId: number): boolean => {
    if (!user) return false;
    if (user.id === targetUserId) return true;
    return isSubordinate(user.id, targetUserId, users);
  };

  // Get all users visible to the current user based on hierarchy
  const getVisibleUsers = (): User[] => {
    if (!user) return [];
    
    // Owners and admins can see all users
    if (user.role === 'owner' || user.role === 'admin') {
      return users;
    }
    
    // Other roles can only see themselves and their subordinates
    return getReportingChainUsers(user.id, users);
  };

  // Get unique managers for filter dropdown
  const uniqueManagers = Array.from(
    new Map(
      getVisibleUsers()
        .filter(u => u.managerId !== null)
        .map(u => {
          const manager = users.find(m => m.id === u.managerId);
          return manager ? [manager.id, { id: manager.id, name: manager.fullName || manager.username }] : null;
        })
        .filter((item): item is [number, { id: number; name: string }] => item !== null)
    ).values()
  );

  // Filter users based on search term, filters, and hierarchy visibility
  const filteredUsers = getVisibleUsers().filter(u => {
    const matchesSearch = searchTerm === "" ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.fullName?.toLowerCase() || "").includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    
    // Add category filter
    const matchesCategory = categoryFilter === "all" || 
      (u.category || "active") === categoryFilter;

    // Enhanced manager filter to include hierarchical filtering
    const matchesManager = managerFilter === "all" ||
      (managerFilter === "none" && !u.managerId) ||
      (managerFilter === "direct" && u.managerId === user?.id) ||
      (managerFilter === "team" && isSubordinate(user?.id || 0, u.id, users)) ||
      (u.managerId?.toString() === managerFilter);

    return matchesSearch && matchesRole && matchesManager && matchesCategory;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  // For hierarchy view, we need to determine which root users to show on the current page
  const getRootUsersForCurrentPage = (usersToFilter: User[]) => {
    // Get root users (users without managers)
    const rootUsers = usersToFilter.filter(u => !u.managerId);
    
    // If we're showing the current user's hierarchy and they're not a root user, they become the "root" for display
    if (user?.role !== 'owner' && user?.role !== 'admin' && user?.managerId) {
      return [user];
    }
    
    // Apply pagination to root users
    return rootUsers.slice(startIndex, endIndex);
  };

  // Page change handler
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    
    // When changing pages, we may need to expand the appropriate managers
    if (viewMode === 'hierarchy') {
      // Reset expanded managers when changing pages
      setExpandedManagers([]);
      
      // If the user is logged in, auto-expand their node
      if (user?.id) {
        setExpandedManagers([user.id]);
      }
    }
  };

  // Generate page numbers array
  const getPageNumbers = () => {
    const delta = 2; // Number of pages to show before and after current page
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  // Add new state for LOB selection
  const [selectedLOBs, setSelectedLOBs] = useState<number[]>([]);

  // Add LOB and Process queries
  const { data: lineOfBusinesses = [], isLoading: isLoadingLOB } = useQuery<OrganizationLineOfBusiness[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/line-of-businesses`],
    enabled: !!user?.organizationId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: processes = [], isLoading: isLoadingProcesses } = useQuery<OrganizationProcess[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/processes`],
    enabled: !!user?.organizationId,
    staleTime: 5 * 60 * 1000,
  });

  const filteredProcesses = processes.filter(process =>
    selectedLOBs.includes(process.lineOfBusinessId)
  );

  // Helper function to handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!userToDelete) {
      console.error('No user selected for deletion');
      return;
    }

    try {
      console.log('Confirming deletion for user:', userToDelete.id);
      await deleteUserMutation.mutateAsync(userToDelete.id);
    } catch (error) {
      console.error("Error in handleDeleteConfirm:", error);
    }
  };

  // Query for organization settings - includes locations
  const { data: orgSettings, isLoading: isLoadingOrgSettings } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/settings`],
    enabled: !!user?.organizationId,
  });
  
  // Add a separate dedicated query for locations to ensure they load properly
  const { data: locations = [] } = useQuery<OrganizationLocation[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/locations`],
    enabled: !!user?.organizationId,
  });

  // Define explicit types for API responses
  interface ProcessData {
    processId: number;
    processName: string;
  }
  
  type UserProcessMap = Record<number, ProcessData[]>;
  type UserBatchMap = Record<number, any[]>;
  
  // Add new query for user processes with proper typing
  const { data: userProcesses = {} as UserProcessMap } = useQuery<UserProcessMap>({
    queryKey: ["/api/users/processes"],
    enabled: !!user,
  });
  
  // Add new query for user batch processes with proper typing
  const { data: userBatchProcesses = {} as UserBatchMap } = useQuery<UserBatchMap>({
    queryKey: ["/api/users/batch-processes"],
    enabled: !!user,
  });

  // Add helper function to get user processes
  const getUserProcesses = (userId: number) => {
    const processes = userProcesses[userId] || [];
    return processes.map((p: any) => p.processName).join(", ") || "No processes";
  };

  // Check for user management permissions
  const canManageUsers = hasPermission("manage_users");
  const canViewUsers = hasPermission("view_users");
  const canDeleteUsers = hasPermission("delete_users");
  const canExportReports = hasPermission("export_reports");

  // If user can't even view users, show restricted access message
  if (!canViewUsers) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              You don't have permission to view user information.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const deleteConfirmationText = userToDelete?.username || "";
  const deleteForm = useForm({
    defaultValues: { confirmText: "" },
  });

  // Edit user button with our new modal component
  const EditUserButton = ({ user: editUser }: { user: User }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Determine if the current user can edit this user
    const hasEditPermission = hasPermission("edit_users");
    
    // Check if the target user is admin/owner - should only be editable by higher roles
    const isTargetProtected = editUser.role === "admin" || editUser.role === "owner";
    const canLowerRoleEdit = !isTargetProtected || user?.role === "owner";
    
    const canEdit = hasEditPermission && canLowerRoleEdit;
    
    // Handle the save operation for the user
    const handleSaveUser = async (userId: number, data: any) => {
      try {
        await updateUserMutation.mutateAsync({
          id: userId,
          data: data
        });
        setIsModalOpen(false);
      } catch (error) {
        console.error('Error updating user:', error);
      }
    }
    
    if (!canEdit) {
      return (
        <Button variant="outline" size="icon" disabled title="You don't have permission to edit this user">
          <Edit2 className="h-4 w-4" />
        </Button>
      );
    }
    
    return (
      <>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsModalOpen(true)}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        
        {isModalOpen && (
          <FixedEditUserModal
            user={editUser}
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSaveUser}
            locations={locations || []}
            users={users}
            lineOfBusinesses={lineOfBusinesses || []}
            processes={processes || []}
            userProcesses={userProcesses || {}}
          />
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>
              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                  <SelectItem value="advisor">Advisor</SelectItem>
                  <SelectItem value="team_lead">Team Lead</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={categoryFilter}
                onValueChange={(value) => {
                  setCategoryFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trainee">Trainee</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={managerFilter}
                onValueChange={(value) => {
                  setManagerFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Managers</SelectItem>
                  <SelectItem value="none">No Manager</SelectItem>
                  {user && (
                    <>
                      <SelectItem value="direct">My Direct Reports</SelectItem>
                      <SelectItem value="team">My Team (All)</SelectItem>
                    </>
                  )}
                  {uniqueManagers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id.toString()}>
                      {manager.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => setViewMode(viewMode === 'hierarchy' ? 'flat' : 'hierarchy')}
                className="gap-2"
              >
                {viewMode === 'hierarchy' ? (
                  <>
                    <Users className="h-4 w-4" />
                    Flat View
                  </>
                ) : (
                  <>
                    <Network className="h-4 w-4" />
                    Hierarchy View
                  </>
                )}
              </Button>
              
              {/* Add expand/collapse all buttons for hierarchy view */}
              {viewMode === 'hierarchy' && (
                <div className="flex gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={expandAllManagers}
                          className="h-10 w-10"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Expand All</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={collapseAllManagers}
                          className="h-10 w-10"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Collapse All</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
              {canExportReports && (
                <Button onClick={exportToExcel} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[12%]">Username</TableHead>
                  <TableHead className="w-[14%]">Email</TableHead>
                  <TableHead className="w-[12%]">Full Name</TableHead>
                  <TableHead className="w-[7%]">Role</TableHead>
                  <TableHead className="w-[7%]">Category</TableHead>
                  <TableHead className="w-[9%]">Manager</TableHead>
                  <TableHead className="w-[9%]">Location</TableHead>
                  <TableHead className="w-[17%]">Processes</TableHead>
                  <TableHead className="w-[5%]">Active</TableHead>
                  {canManageUsers && (
                    <TableHead className="w-[8%] text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewMode === 'flat' ? (
                  // Flat view - simple list of users
                  currentUsers.map((user) => (
                    <TableRow key={user.id} className={cn(!user.active && "opacity-50")}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.fullName}</TableCell>
                      <TableCell>
                        <Badge>{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.category === 'trainee' ? 'secondary' : 'outline'}>
                          {user.category || 'active'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help underline decoration-dotted">
                                {getManagerName(user.managerId)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Reporting Path: {getFormattedReportingPath(user.id, users)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>{getLocationName(user.locationId)}</TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          {getUserProcesses(user.id) ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex flex-col space-y-1 cursor-help">
                                    {getUserProcesses(user.id).split(", ").map((process, idx) => (
                                      process ? (
                                        <Badge key={idx} variant="outline" className="justify-start text-left w-full truncate">
                                          {process}
                                        </Badge>
                                      ) : null
                                    ))}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                  <p className="font-medium text-sm">Assigned Processes:</p>
                                  <ul className="list-disc list-inside text-xs mt-1">
                                    {getUserProcesses(user.id).split(", ").map((process, idx) => (
                                      <li key={idx}>{process}</li>
                                    ))}
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground text-sm italic">No processes</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.role === "owner" ? (
                          <div className="flex items-center" title="Owner status cannot be changed">
                            <Switch
                              checked={true}
                              disabled={true}
                              className="opacity-50 cursor-not-allowed"
                            />
                          </div>
                        ) : canManageUsers ? (
                          <Switch
                            checked={user.active}
                            onCheckedChange={(checked) => toggleUserStatus(user.id, user.active, user.role)}
                          />
                        ) : (
                          <Switch checked={user.active} disabled={true} />
                        )}
                      </TableCell>
                      {canManageUsers && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <EditUserButton user={user} />
                            {user.role !== "owner" && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteClick(user)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  // Hierarchical view - tree structure based on current user and visible permissions
                  (() => {
                    // If no users match the filters, don't show anything
                    if (filteredUsers.length === 0) {
                      return null;
                    }

                    // Filter logic for specific category
                    const showTraineeOnly = categoryFilter === 'trainee';
                    const showActiveOnly = categoryFilter === 'active';
                    
                    // For hierarchy view, we need to include parents even if they don't match the filter
                    // This preserves the hierarchy while still highlighting the matched users
                    const hierarchyUsers = users.filter(u => {
                      // This is a direct match to our filters
                      const directMatch = filteredUsers.some(filtered => filtered.id === u.id);
                      
                      // If this is a direct match, include it
                      if (directMatch) return true;
                      
                      // Otherwise, check if any of this user's subordinates match our filters
                      // If so, we need to include this user to maintain the hierarchy
                      const hasMatchingSubordinate = filteredUsers.some(filtered => 
                        isSubordinate(u.id, filtered.id, users)
                      );
                      
                      return hasMatchingSubordinate;
                    });
                    
                    // Auto-expand managers that have matching subordinates
                    // This ensures that filtered results are visible in the hierarchy
                    if (categoryFilter !== 'all' || roleFilter !== 'all' || searchTerm || managerFilter !== 'all') {
                      // Identify managers who have subordinates that match the filter
                      const managersWithMatchingSubordinates = hierarchyUsers.filter(u => {
                        // Check if any direct reports of this user match the filter
                        return users.some(potentialReport => 
                          potentialReport.managerId === u.id && 
                          filteredUsers.some(filtered => filtered.id === potentialReport.id)
                        );
                      });
                      
                      // Add these managers to expanded list if not already there
                      managersWithMatchingSubordinates.forEach(manager => {
                        if (!expandedManagers.includes(manager.id)) {
                          setExpandedManagers(prev => [...prev, manager.id]);
                        }
                      });
                    }
                    
                    // If owner or admin, show the org hierarchy from paginated root users
                    if (user?.role === 'owner' || user?.role === 'admin') {
                      // Apply pagination to root users
                      const rootUsers = hierarchyUsers.filter(u => !u.managerId);
                      const paginatedRootUsers = getRootUsersForCurrentPage(hierarchyUsers);
                      
                      return paginatedRootUsers.map(rootUser => (
                        <HierarchicalUserRow
                          key={rootUser.id}
                          user={rootUser}
                          users={hierarchyUsers}
                          level={0}
                          expandedManagers={expandedManagers}
                          toggleExpanded={toggleManagerExpanded}
                          getManagerName={getManagerName}
                          getLocationName={getLocationName}
                          getProcessNames={getUserProcesses}
                          canManageUsers={canManageUsers}
                          canDeleteUsers={canDeleteUsers}
                          editUserComponent={(user) => <EditUserButton user={user} />}
                          toggleUserStatus={toggleUserStatus}
                          handleDeleteClick={handleDeleteClick}
                          getFormattedReportingPath={getFormattedReportingPath}
                        />
                      ));
                    } 
                    // For managers and other roles, show only their own hierarchy
                    else {
                      // Here we're not paginating by root users since we're showing the current user's hierarchy
                      // Ensure current user is in the filtered list for hierarchy
                      if (!hierarchyUsers.some(u => u.id === user?.id)) {
                        return <div className="p-4 text-center text-muted-foreground">No matching users in your team</div>;
                      }
                      
                      // We still need to apply pagination to the filtered hierarchy
                      // For non-admin users, there's effectively only one "root" (themselves)
                      // So we just check if we're on the first page, since they should only appear there
                      if (currentPage === 1) {
                        return (
                          <HierarchicalUserRow
                            key={user?.id}
                            user={user as User}
                            users={hierarchyUsers}
                            level={0}
                            expandedManagers={expandedManagers}
                            toggleExpanded={toggleManagerExpanded}
                            getManagerName={getManagerName}
                            getLocationName={getLocationName}
                            getProcessNames={getUserProcesses}
                            canManageUsers={canManageUsers}
                            canDeleteUsers={canDeleteUsers}
                            editUserComponent={(user) => <EditUserButton user={user} />}
                            toggleUserStatus={toggleUserStatus}
                            handleDeleteClick={handleDeleteClick}
                            getFormattedReportingPath={getFormattedReportingPath}
                          />
                        );
                      } else {
                        // Return empty on other pages since the user's hierarchy
                        // only appears on the first page
                        return <div className="p-4 text-center text-muted-foreground">No results on this page</div>;
                      }
                    }
                  })()
                )}
              </TableBody>
            </Table>
            
            {/* No results message */}
            {filteredUsers.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                No users match your current filters
              </div>
            )}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                {getPageNumbers().map((pageNum, idx) => (
                  <Button
                    key={idx}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => typeof pageNum === 'number' && handlePageChange(pageNum)}
                    disabled={pageNum === '...'}
                  >
                    {pageNum}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate User</DialogTitle>
            <DialogDescription>
              This action will deactivate the user, preventing them from logging in.
              Their data will be maintained in the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p>To confirm, type the username: <strong>{deleteConfirmationText}</strong></p>
              <Input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type username to confirm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteConfirmation !== deleteConfirmationText}
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deactivating...
                </>
              ) : (
                "Deactivate User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}