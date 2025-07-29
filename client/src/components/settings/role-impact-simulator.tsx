import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, AlertTriangle, Users } from "lucide-react";
import { defaultPermissions } from "@shared/permissions";
import type { User, RolePermission } from "@shared/schema";
import { cn } from "@/lib/utils";
import { permissionEnum } from "@shared/schema";

interface RoleImpactSimulatorProps {
  selectedRole: string | null;
  proposedPermissions: string[];
}

export const RoleImpactSimulator = ({ 
  selectedRole, 
  proposedPermissions 
}: RoleImpactSimulatorProps) => {
  const [addedPermissions, setAddedPermissions] = useState<string[]>([]);
  const [removedPermissions, setRemovedPermissions] = useState<string[]>([]);

  // Memoize the query key to prevent unnecessary refetches
  const usersQueryKey = useMemo(() => 
    selectedRole ? [`/api/users`, { role: selectedRole }] : null,
    [selectedRole]
  );

  // Fetch users with the selected role
  const { data: affectedUsers = [] } = useQuery<User[]>({
    queryKey: usersQueryKey || [],
    enabled: !!selectedRole,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Memoize permissions query key
  const permissionsQueryKey = useMemo(() => 
    selectedRole ? [`/api/permissions`, selectedRole] : null,
    [selectedRole]
  );

  // Fetch current role permissions
  const { data: currentPermissions = [] } = useQuery<RolePermission[]>({
    queryKey: permissionsQueryKey || [],
    enabled: !!selectedRole,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Memoize the current role's default permissions
  const currentRolePermissions = useMemo(() => 
    selectedRole 
      ? defaultPermissions[selectedRole as keyof typeof defaultPermissions] || []
      : [],
    [selectedRole]
  );

  useEffect(() => {
    if (!selectedRole || !proposedPermissions || !currentRolePermissions) return;

    // Calculate added permissions
    const added = proposedPermissions.filter(p => 
      !currentRolePermissions.includes(p)
    );
    setAddedPermissions(added);

    // Calculate removed permissions
    const removed = currentRolePermissions.filter(p => 
      !proposedPermissions.includes(p)
    );
    setRemovedPermissions(removed);
  }, [selectedRole, proposedPermissions, currentRolePermissions]);

  if (!selectedRole) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Impact Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Affected Users */}
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5" />
            <span className="font-medium">
              {affectedUsers.length} user{affectedUsers.length !== 1 ? 's' : ''} will be affected
            </span>
          </div>

          {/* Permission Changes */}
          <div className="space-y-2">
            {/* Added Permissions */}
            {addedPermissions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">New Permissions:</h4>
                <div className="flex flex-wrap gap-2">
                  {addedPermissions.map(permission => (
                    <Badge 
                      key={permission}
                      variant="outline" 
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {permission.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Removed Permissions */}
            {removedPermissions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Removed Permissions:</h4>
                <div className="flex flex-wrap gap-2">
                  {removedPermissions.map(permission => (
                    <Badge 
                      key={permission}
                      variant="outline" 
                      className="bg-red-50 text-red-700 border-red-200"
                    >
                      <Minus className="h-3 w-3 mr-1" />
                      {permission.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Warning for significant changes */}
          {(addedPermissions.length > 2 || removedPermissions.length > 2) && (
            <div className="mt-4 p-3 bg-warning/10 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                This change will significantly alter the permissions for this role. 
                Please review carefully before proceeding.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};