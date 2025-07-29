import { createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import type { RolePermission } from "@shared/schema";
import { defaultPermissions } from "@shared/permissions";

type PermissionsContextType = {
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  isLoading: boolean;
  error: Error | null;
};

const PermissionsContext = createContext<PermissionsContextType | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const { data: rolePermissions, isLoading, error } = useQuery<RolePermission>({
    queryKey: [`/api/permissions/${user?.role}`],
    enabled: !!user,
  });

  const hasPermission = (permission: string): boolean => {
    if (!user || !rolePermissions) return false;

    // Owner has all permissions
    if (user.role === 'owner') return true;

    // Enhanced logging for debugging
    const hasPermission = rolePermissions.permissions.includes(permission);
    console.log(`Permission check: "${permission}" for role: "${user.role}" - Result: ${hasPermission}`);
    console.log(`All permissions for role ${user.role}:`, rolePermissions.permissions);
    
    // Specific check for manage_holidaylist
    if (permission === 'manage_holidaylist') {
      console.log('HOLIDAY PERMISSION CHECK - Default permissions include it?', 
                 defaultPermissions[user.role as keyof typeof defaultPermissions]?.includes('manage_holidaylist'));
      console.log('HOLIDAY PERMISSION CHECK - Actual permissions include it?', hasPermission);
    }

    return hasPermission;
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    return permissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    return permissions.every(permission => hasPermission(permission));
  };

  return (
    <PermissionsContext.Provider
      value={{
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isLoading,
        error: error as Error | null,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}

export function PermissionGuard({
  permission,
  fallback = null,
  children,
}: {
  permission: string;
  fallback?: React.ReactNode;
  children: ReactNode;
}) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return fallback;
  }

  return <>{children}</>;
}

// Multiple permissions guard
export function MultiPermissionGuard({
  permissions,
  type = "any", // "any" or "all"
  fallback = null,
  children,
}: {
  permissions: string[];
  type?: "any" | "all";
  fallback?: React.ReactNode;
  children: ReactNode;
}) {
  const { hasAnyPermission, hasAllPermissions } = usePermissions();

  const hasPermission = type === "any" 
    ? hasAnyPermission(permissions)
    : hasAllPermissions(permissions);

  if (!hasPermission) {
    return fallback;
  }

  return <>{children}</>;
}