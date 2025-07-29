import { useState, useEffect, useCallback } from "react";
import { motion, Reorder } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleEnum, permissionEnum } from "@shared/schema";
import { defaultPermissions } from "@shared/permissions";
import { RoleImpactSimulator } from "./role-impact-simulator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RolePermission } from "@shared/schema";

interface RoleCardProps {
  role: typeof roleEnum.enumValues[number];
  isSelected: boolean;
  onClick: () => void;
}

const RoleCard = ({ role, isSelected, onClick }: RoleCardProps) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className={`p-4 rounded-lg shadow-md mb-2 cursor-grab ${
      isSelected ? 'bg-primary text-primary-foreground' : 'bg-card'
    }`}
    onClick={onClick}
  >
    <h3 className="font-semibold capitalize">{role.replace('_', ' ')}</h3>
    <p className="text-sm opacity-80">
      {role === 'owner' && 'Full system access'}
      {role === 'admin' && 'Organization-wide administration'}
      {role === 'manager' && 'Department/team management'}
      {role === 'team_lead' && 'Team supervision'}
      {role === 'quality_analyst' && 'Quality monitoring and assurance'}
      {role === 'trainer' && 'Training delivery'}
      {role === 'advisor' && 'Support and guidance'}
    </p>
  </motion.div>
);

export const RoleHierarchyEditor = () => {
  // Filter out trainee from the roles list
  const availableRoles = roleEnum.enumValues.filter(role => role !== 'trainee');
  const [roles, setRoles] = useState<typeof roleEnum.enumValues>(availableRoles);
  const [selectedRole, setSelectedRole] = useState<typeof roleEnum.enumValues[number] | null>(null);
  const [editedPermissions, setEditedPermissions] = useState<typeof permissionEnum.enumValues>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Fetch all role permissions from the database
  const { data: rolePermissions, isLoading } = useQuery<RolePermission[]>({
    queryKey: ["/api/permissions"],
    staleTime: 0, // Always fetch fresh data
  });

  // Mutation for updating permissions
  const updatePermissionMutation = useMutation({
    mutationFn: async ({
      role,
      permissions,
    }: {
      role: string;
      permissions: string[];
    }) => {
      const res = await apiRequest("PATCH", `/api/permissions/${role}`, {
        permissions,
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
      setIsSaving(false);
      setIsEditing(false);
    },
    onError: (error: Error) => {
      console.error('Failed to update permissions:', error);
      toast({
        title: "Failed to update permissions",
        description: error.message,
        variant: "destructive",
      });
      setIsSaving(false);
    },
  });

  // Get permissions for a role from the database
  const getPermissionsForRole = useCallback((role: string) => {
    const permissions = rolePermissions?.find((rp) => rp.role === role)?.permissions || [];
    return permissions;
  }, [rolePermissions]);
  
  const handleRoleSelect = (role: typeof roleEnum.enumValues[number]) => {
    if (role === selectedRole) {
      setSelectedRole(null);
      setEditedPermissions([]);
      setIsEditing(false);
    } else {
      setSelectedRole(role);
      // Get permissions from the database if available, otherwise use defaults
      const existingPerms = getPermissionsForRole(role);
      const rolePerms = existingPerms.length > 0 
        ? existingPerms 
        : defaultPermissions[role] || [];
      
      setEditedPermissions([...rolePerms] as typeof permissionEnum.enumValues);
      setIsEditing(false);
    }
  };

  const handlePermissionToggle = (permission: typeof permissionEnum.enumValues[number]) => {
    if (!isEditing) return;

    setEditedPermissions(current => {
      if (current.includes(permission)) {
        return current.filter(p => p !== permission);
      } else {
        return [...current, permission];
      }
    });
  };

  const handleSavePermissions = () => {
    if (!selectedRole) return;
    
    setIsSaving(true);
    updatePermissionMutation.mutate({
      role: selectedRole,
      permissions: editedPermissions,
    });
  };

  // Get all available permissions for a specific role by checking the database first, then falling back to defaults
  const getAllPermissionsForRole = useCallback((role: string) => {
    // Get available permissions for the role from both the database and the default permissions
    const dbPerms = getPermissionsForRole(role);
    const defaultPerms = defaultPermissions[role as keyof typeof defaultPermissions] || [];
    
    // Combine both sources (preserving uniqueness)
    const allPerms = Array.from(new Set([...dbPerms, ...defaultPerms]));
    return allPerms;
  }, [getPermissionsForRole]);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Role Hierarchy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Role Hierarchy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Role Order (Drag to reorder)</h3>
            <Reorder.Group axis="y" values={roles} onReorder={setRoles}>
              {roles.map((role) => (
                <Reorder.Item key={role} value={role}>
                  <RoleCard
                    role={role}
                    isSelected={role === selectedRole}
                    onClick={() => handleRoleSelect(role)}
                  />
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Role Details</h3>
            {selectedRole && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold capitalize">
                    {selectedRole.replace('_', ' ')} Permissions
                  </h4>
                  {selectedRole !== 'owner' && (
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            variant="default"
                            onClick={handleSavePermissions}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Save Changes'
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setIsEditing(false)}
                            disabled={isSaving}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="default"
                          onClick={() => setIsEditing(true)}
                        >
                          Edit Permissions
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* Display all available permissions for this role */}
                  {getAllPermissionsForRole(selectedRole).map((permission) => (
                    <Badge
                      key={permission}
                      variant={isEditing ? "outline" : "secondary"}
                      className={`cursor-pointer ${
                        isEditing && !editedPermissions.includes(permission)
                          ? 'opacity-50'
                          : ''
                      }`}
                      onClick={() => handlePermissionToggle(permission)}
                    >
                      {isEditing && (
                        <>
                          {editedPermissions.includes(permission) ? (
                            <Check className="h-3 w-3 mr-1" />
                          ) : (
                            <X className="h-3 w-3 mr-1" />
                          )}
                        </>
                      )}
                      {permission.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>

                {/* Show impact simulation when editing */}
                {isEditing && (
                  <RoleImpactSimulator
                    selectedRole={selectedRole}
                    proposedPermissions={editedPermissions}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};