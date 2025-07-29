import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { permissionEnum, roleEnum } from "@shared/schema";
import type { RolePermission } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Info, 
  Shield, 
  AlertTriangle, 
  Users, 
  FileText, 
  Settings, 
  Lock, 
  Edit, 
  CheckSquare, 
  FileDown, 
  FileUp,
  BarChart,
  HelpCircle,
  Building,
  Activity,
  BookOpen,
  MessageSquare,
  Save,
  SquareStack,
  GraduationCap
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
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

export function RolePermissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>(roleEnum.enumValues[1]); // Start with 'admin'
  const [currentRolePermissions, setCurrentRolePermissions] = useState<string[]>([]);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pendingPermissionChange, setPendingPermissionChange] = useState<{
    permission: string;
    newState: boolean;
    permissions: string[];
  } | null>(null);

  const { data: rolePermissions, isLoading } = useQuery<RolePermission[]>({
    queryKey: ["/api/permissions"],
    enabled: !!user,
    staleTime: 0 // Always fetch fresh data
  });
  
  // Update permissions when data is loaded
  useEffect(() => {
    if (rolePermissions) {
      const permissions = rolePermissions.find((rp: RolePermission) => rp.role === selectedRole)?.permissions || [];
      setCurrentRolePermissions(permissions);
    }
  }, [rolePermissions, selectedRole]);

  // Filter out owner and trainee from role selection
  const availableRoles = roleEnum.enumValues.filter(role => {
    if (user?.role !== 'owner') {
      return role !== 'owner' && role !== 'trainee';
    }
    return role !== 'trainee';
  });

  const getRoleDescription = (role: string) => {
    const descriptions: Record<string, string> = {
      owner: "Full system access and control",
      admin: "Organization-wide administration",
      manager: "Department and team management",
      team_lead: "Team supervision and coordination",
      quality_analyst: "Quality monitoring and assurance",
      trainer: "Training delivery and assessment",
      advisor: "Support and guidance provision"
    };
    return descriptions[role] || role;
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Lock className="h-5 w-5 text-primary" />;
      case 'admin': return <Settings className="h-5 w-5 text-primary" />;
      case 'manager': return <Users className="h-5 w-5 text-primary" />;
      case 'team_lead': return <Users className="h-5 w-5 text-primary" />;
      case 'quality_analyst': return <BarChart className="h-5 w-5 text-primary" />;
      case 'trainer': return <BookOpen className="h-5 w-5 text-primary" />;
      case 'advisor': return <HelpCircle className="h-5 w-5 text-primary" />;
      default: return <Users className="h-5 w-5 text-primary" />;
    }
  };

  // Organize permissions by functional areas
  interface PermissionCategory {
    name: string;
    icon: React.ReactNode;
    description: string;
    permissions: string[];
  }

  const permissionCategories: PermissionCategory[] = [
    {
      name: "User Management",
      icon: <Users className="h-5 w-5" />,
      description: "Control user accounts and access",
      permissions: ['view_users', 'upload_users', 'manage_users', 'add_users']
    },
    {
      name: "Organization Settings",
      icon: <Building className="h-5 w-5" />,
      description: "Manage organization structure and configuration",
      permissions: ['view_organization', 'manage_holidaylist', 'manage_locations', 'manage_processes', 'manage_lineofbusiness']
    },
    {
      name: "Training Management",
      icon: <BookOpen className="h-5 w-5" />,
      description: "Control training process and batches",
      permissions: ['manage_batches', 'manage_batch_users_add', 'manage_batch_users_remove']
    },
    {
      name: "Trainee Management",
      icon: <GraduationCap className="h-5 w-5" />,
      description: "Control trainee management section",
      permissions: ['view_trainee_management', 'manage_trainee_management']
    },
    {
      name: "Quiz Management",
      icon: <SquareStack className="h-5 w-5" />,
      description: "Control quiz creation and access",
      permissions: ['view_quiz', 'manage_quiz', 'take_quiz', 'view_take_quiz']
    },
    {
      name: "Performance & Evaluation",
      icon: <Activity className="h-5 w-5" />,
      description: "Manage evaluations and conduct forms",
      permissions: [
        'view_evaluation_form',
        'manage_conduct_form',
        'manage_evaluation_feedback'
      ]
    },
    {
      name: "Reporting & Analytics",
      icon: <FileText className="h-5 w-5" />,
      description: "Access to reports and analytics data",
      permissions: ['export_reports']
    },
    {
      name: "Feedback & Communication",
      icon: <MessageSquare className="h-5 w-5" />,
      description: "Manage feedback and allocation systems",
      permissions: ['view_feedback', 'manage_feedback', 'view_allocation', 'manage_allocation']
    },
    {
      name: "Billing & Subscription",
      icon: <FileDown className="h-5 w-5" />,
      description: "Control billing and subscription settings",
      permissions: ['manage_billing', 'manage_subscription']
    }
  ];

  // Get permission description - role-dependent for manage_users
  const getPermissionDescription = (permission: string) => {
    // Special case for manage_users - description depends on role
    if (permission === 'manage_users') {
      // For owner and admin roles, include delete capability in description
      if (selectedRole === 'owner' || selectedRole === 'admin') {
        return "Create, edit, and delete user accounts";
      }
      // For other roles (manager and below), only mention create and edit
      return "Create and edit user accounts";
    }
    
    const descriptions: Record<string, string> = {
      // User Management
      view_users: "View user profiles and information",
      edit_users: "Modify user account details",
      delete_users: "Remove user accounts",
      upload_users: "Bulk import user data",
      add_users: "Create new user accounts",
      
      // Organization Settings
      view_organization: "View organization structure and settings",
      manage_holidaylist: "Full access to holiday management (add, edit, delete holidays)",
      manage_locations: "Full access to manage office/center locations",
      manage_processes: "Full access to workflow processes management",
      manage_lineofbusiness: "Full access to line of business management",
      
      // Legacy - for backward compatibility
      manage_organization_settings: "Configure organization-wide parameters",
      manage_organization: "Control organization-wide settings",
      edit_organization: "Update organization settings",
      create_location: "Add new location entries",
      create_process: "Set up new workflow processes",
      
      // Performance
      manage_performance: "Access and manage performance metrics",
      view_performance: "View performance metrics",
      export_reports: "Generate and download reports",
      
      // Training Management
      manage_batches: "Create, edit, and delete training batches",
      manage_batch_users_add: "Add users to training batches",
      manage_batch_users_remove: "Remove users from training batches",
      view_trainee_management: "Read-only access to trainee management section",
      manage_trainee_management: "Full access to trainee management (add, edit, remove trainees)",
      
      // Quiz Management
      view_quiz: "View quiz details and questions",
      manage_quiz: "Full control over quiz management (create, edit, delete)",
      take_quiz: "Ability to take quizzes",
      view_take_quiz: "View quizzes that can be taken",
      
      // Evaluation Forms
      view_evaluation_form: "Manage evaluation form",
      edit_evaluation_form: "Modify existing evaluation forms",
      delete_evaluation_form: "Remove evaluation forms",
      create_evaluation_form: "Create new evaluation forms",
      manage_evaluation_form: "Full control over evaluation forms",
      manage_conduct_form: "Full control over conduct forms",
      manage_evaluation_feedback: "Full control over evaluation feedback",
      
      // Feedback & Allocation
      view_feedback: "View feedback data",
      manage_feedback: "Control feedback systems",
      view_allocation: "Display Azure storage for audio files",
      manage_allocation: "Enable import button for audio files",
      
      // Billing & Subscription
      manage_billing: "Control payment and billing settings",
      manage_subscription: "Handle subscription-related tasks",
    };
    return descriptions[permission] || permission.replace(/_/g, " ");
  };

  // Get custom display name for permission
  const getPermissionDisplayName = (permission: string) => {
    const displayNames: Record<string, string> = {
      view_evaluation_form: "Manage Evaluation Form",
    };
    return displayNames[permission] || permission.replace(/_/g, " ");
  };

  const getPermissionIcon = (permission: string) => {
    if (permission.startsWith('view_')) return <Info className="h-4 w-4 text-blue-500" />;
    if (permission.startsWith('manage_')) return <Settings className="h-4 w-4 text-purple-500" />;
    if (permission.startsWith('edit_')) return <Edit className="h-4 w-4 text-amber-500" />;
    if (permission.startsWith('create_')) return <CheckSquare className="h-4 w-4 text-green-500" />;
    if (permission.startsWith('delete_')) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (permission.startsWith('upload_')) return <FileUp className="h-4 w-4 text-teal-500" />;
    if (permission.startsWith('export_')) return <FileDown className="h-4 w-4 text-indigo-500" />;
    return <HelpCircle className="h-4 w-4 text-gray-500" />;
  };

  const updatePermissionMutation = useMutation({
    mutationFn: async ({
      role,
      permissions,
    }: {
      role: string;
      permissions: string[];
    }) => {
      // Filter out any obsolete quiz-specific permissions that have been consolidated under 'manage_quiz'
      const obsoletePermissions = ['edit_quiz', 'delete_quiz', 'create_quiz'];
      const validPermissions = permissions.filter(p => !obsoletePermissions.includes(p));
      
      console.log('Updating permissions for role:', role, 'New permissions:', validPermissions);
      
      const res = await apiRequest("PATCH", `/api/permissions/${role}`, {
        permissions: validPermissions,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update permissions');
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Force a refetch of the data instead of just invalidating
      queryClient.setQueryData(["/api/permissions"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((rp: any) => 
          rp.role === data.role ? data : rp
        );
      });
      
      // Also invalidate to ensure fresh data on next fetch
      queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
      
      // Also invalidate the specific role permissions
      queryClient.invalidateQueries({ queryKey: [`/api/permissions/${data.role}`] });
      
      toast({
        title: "Permissions updated",
        description: "Role permissions have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      console.error('Failed to update permissions:', error);
      toast({
        title: "Failed to update permissions",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation for resetting permissions to default values
  const resetPermissionsMutation = useMutation({
    mutationFn: async (role: string) => {
      console.log('Resetting permissions for role:', role);
      
      const res = await apiRequest("POST", `/api/permissions/${role}/reset`, {});
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to reset permissions');
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Update the local state with the reset permissions
      setCurrentRolePermissions(data.permissions);
      
      // Update the cached data
      queryClient.setQueryData(["/api/permissions"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((rp: any) => 
          rp.role === data.role ? data : rp
        );
      });
      
      // Invalidate queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/permissions/${data.role}`] });
      
      toast({
        title: "Permissions reset",
        description: `${data.role.replace(/_/g, " ")} permissions have been reset to default values.`,
      });
    },
    onError: (error: Error) => {
      console.error('Failed to reset permissions:', error);
      toast({
        title: "Failed to reset permissions",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update current permissions when selected role changes
  useEffect(() => {
    if (rolePermissions) {
      const permissions = rolePermissions.find((rp) => rp.role === selectedRole)?.permissions || [];
      setCurrentRolePermissions(permissions);
    }
  }, [selectedRole, rolePermissions]);

  // Define hierarchical permission relationships
  const permissionHierarchy = {
    // User Management: manage_users is the parent permission for all user-related permissions
    'manage_users': ['view_users', 'upload_users', 'add_users'],
  };

  const handlePermissionToggle = useCallback((permission: string) => {
    // Determine if this is enabling or disabling the permission
    const isEnabling = !currentRolePermissions.includes(permission);
    const action = isEnabling ? "enable" : "disable";
    
    // Calculate the new permissions array
    let newPermissions = isEnabling
      ? [...currentRolePermissions, permission]
      : currentRolePermissions.filter((p: string) => p !== permission);
    
    // Handle hierarchical permissions
    if (permission === 'manage_users') {
      // If enabling the parent permission, enable all child permissions
      if (isEnabling) {
        permissionHierarchy['manage_users'].forEach(childPermission => {
          if (!newPermissions.includes(childPermission)) {
            newPermissions.push(childPermission);
          }
        });
      } 
      // If disabling the parent permission, disable all child permissions
      else {
        newPermissions = newPermissions.filter(p => 
          !permissionHierarchy['manage_users'].includes(p)
        );
      }
    } 
    // If toggling a child permission of "manage_users"
    else if (permissionHierarchy['manage_users'].includes(permission)) {
      if (isEnabling) {
        // No need to adjust other permissions when enabling a child
      } else {
        // If disabling a child permission, also disable the parent permission
        newPermissions = newPermissions.filter(p => p !== 'manage_users');
      }
    }
    
    // Filter out any obsolete quiz-specific permissions
    const obsoletePermissions = ['edit_quiz', 'delete_quiz', 'create_quiz'];
    const validPermissions = newPermissions.filter(p => !obsoletePermissions.includes(p));
    
    // Set the pending permission change to show in confirmation dialog
    setPendingPermissionChange({
      permission,
      newState: isEnabling,
      permissions: validPermissions
    });
    
    // Open the confirmation dialog
    setConfirmationOpen(true);
    
  }, [currentRolePermissions]);
  
  // Function to apply the permission change after confirmation
  const applyPermissionChange = useCallback(() => {
    if (!pendingPermissionChange) return;
    
    // Update local state for responsive UI
    setCurrentRolePermissions(pendingPermissionChange.permissions);
    
    // Send the update to the server
    updatePermissionMutation.mutate({
      role: selectedRole,
      permissions: pendingPermissionChange.permissions,
    });
    
    // Close dialog and clear pending change
    setConfirmationOpen(false);
    setPendingPermissionChange(null);
  }, [pendingPermissionChange, selectedRole, updatePermissionMutation]);
  
  // Function to cancel the permission change
  const cancelPermissionChange = useCallback(() => {
    setConfirmationOpen(false);
    setPendingPermissionChange(null);
  }, []);

  type PermissionType = typeof permissionEnum.enumValues[number];

  const handleCategoryPermissions = useCallback((categoryPermissions: string[], enabled: boolean) => {
    // Filter to only include permissions that exist in the system
    const validPermissions = categoryPermissions.filter(p => 
      permissionEnum.enumValues.includes(p as PermissionType)
    ) as PermissionType[];
    
    let newPermissions = [...currentRolePermissions];
    
    // Check if we're dealing with the User Management category
    const isUserManagementCategory = validPermissions.includes('manage_users' as PermissionType);
    
    if (enabled) {
      // Add all permissions from this category that aren't already enabled
      validPermissions.forEach(p => {
        if (!newPermissions.includes(p)) {
          newPermissions.push(p);
        }
      });
      
      // If enabling all User Management permissions, add all child permissions too
      if (isUserManagementCategory) {
        permissionHierarchy['manage_users'].forEach(childPermission => {
          if (!newPermissions.includes(childPermission)) {
            newPermissions.push(childPermission);
          }
        });
      }
    } else {
      // Remove all permissions from this category
      newPermissions = newPermissions.filter(p => !validPermissions.includes(p as PermissionType));
      
      // If disabling all User Management permissions, remove all child permissions too
      if (isUserManagementCategory) {
        newPermissions = newPermissions.filter(p => 
          !permissionHierarchy['manage_users'].includes(p)
        );
      }
    }
    
    // Set the pending permission change to show in confirmation dialog
    setPendingPermissionChange({
      permission: enabled ? "enable all permissions in this category" : "disable all permissions in this category",
      newState: enabled,
      permissions: newPermissions
    });
    
    // Open the confirmation dialog
    setConfirmationOpen(true);
  }, [currentRolePermissions, permissionHierarchy]);

  const filterPermissions = (permissions: string[]) => {
    // Filter out course related permissions
    return permissions.filter(permission => 
      !permission.includes('course')
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Removed duplicate heading */}

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Changes to permissions take effect immediately. Users may need to refresh their page to see updates.
        </AlertDescription>
      </Alert>
      
      {/* Permission Change Confirmation Dialog */}
      <AlertDialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Permission Change</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPermissionChange?.newState
                ? `Are you sure you want to enable "${pendingPermissionChange?.permission}" for ${selectedRole.replace(/_/g, " ")} role?`
                : `Are you sure you want to disable "${pendingPermissionChange?.permission}" for ${selectedRole.replace(/_/g, " ")} role?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelPermissionChange}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyPermissionChange}>
              {pendingPermissionChange?.newState ? "Enable" : "Disable"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Role Management
          </CardTitle>
          <CardDescription>
            Define access levels and capabilities for different roles in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Role Hierarchy Panel */}
            <div className="lg:col-span-2 space-y-5">
              <div className="border rounded-lg overflow-hidden">
                <div className="p-3 border-b bg-muted/30">
                  <h3 className="font-medium">Role Hierarchy</h3>
                </div>
                <div className="p-4 space-y-3">
                  {availableRoles.map((role) => (
                    <div
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                        selectedRole === role 
                          ? 'bg-primary/10 border-primary' 
                          : 'bg-card hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(role)}
                          <div>
                            <h4 className="font-medium capitalize">
                              {role.replace(/_/g, " ")}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {getRoleDescription(role)}
                            </p>
                          </div>
                        </div>
                        {selectedRole === role && (
                          <Badge variant="outline">Selected</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Permissions Panel */}
            <div className="lg:col-span-3 border rounded-lg overflow-hidden">
              <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getRoleIcon(selectedRole)}
                  <div>
                    <h3 className="text-base font-medium capitalize">
                      {selectedRole.replace(/_/g, " ")} Permissions
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {getRoleDescription(selectedRole)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    disabled={resetPermissionsMutation.isPending || selectedRole === 'owner' && user?.role !== 'owner'}
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to reset ${selectedRole.replace(/_/g, " ")} permissions to defaults?`)) {
                        resetPermissionsMutation.mutate(selectedRole);
                      }
                    }}
                  >
                    {resetPermissionsMutation.isPending ? 'Resetting...' : 'Reset'}
                  </Button>
                </div>
              </div>
              
              <div className="p-4 space-y-6">
                {permissionCategories.map(category => {
                  const validCategoryPermissions = category.permissions.filter(p => 
                    permissionEnum.enumValues.includes(p as PermissionType)
                  ) as PermissionType[];
                  
                  if (validCategoryPermissions.length === 0) return null;
                  
                  const allChecked = validCategoryPermissions.every(p => 
                    currentRolePermissions.includes(p)
                  );
                  const someChecked = validCategoryPermissions.some(p => 
                    currentRolePermissions.includes(p)
                  ) && !allChecked;
                  
                  return (
                    <div key={category.name}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {category.icon}
                          <h3 className="font-medium">{category.name}</h3>
                        </div>
                        <Checkbox 
                          checked={allChecked} 
                          className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:opacity-70"
                          data-state={someChecked ? "indeterminate" : allChecked ? "checked" : "unchecked"}
                          disabled={selectedRole === 'owner' && user?.role !== 'owner'}
                          onCheckedChange={(checked) => handleCategoryPermissions(
                            category.permissions, 
                            checked === true ? true : false
                          )}
                        />
                      </div>
                      
                      <div className="space-y-3 pl-7">
                        {validCategoryPermissions.map(permission => (
                          <div key={permission} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getPermissionIcon(permission)}
                              <div>
                                <p className="text-sm capitalize">
                                  {getPermissionDisplayName(permission)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {getPermissionDescription(permission)}
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={currentRolePermissions.includes(permission)}
                              onCheckedChange={() => handlePermissionToggle(permission)}
                              disabled={
                                selectedRole === 'owner' && user?.role !== 'owner' ||
                                updatePermissionMutation.isPending
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to group permissions by category
function groupPermissionsByCategory(permissions: string[]) {
  return permissions.reduce((acc, permission) => {
    const category = permission.split("_")[0];
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(permission);
    return acc;
  }, {} as Record<string, string[]>);
}