import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { User, Organization } from "@shared/schema";
import { Users, UserCircle, Shield, ChevronLeft, Network, CalendarDays, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { usePermissions, PermissionGuard } from "@/hooks/use-permissions";

// Feature flag to control whether the Role Order UI is visible
const SHOW_ROLE_ORDER_UI = false;

// Import existing components
import { UserManagement } from "@/components/settings/user-management";
import { UserProfile } from "@/components/settings/user-profile";
import { AddUser } from "@/components/settings/add-user";
import { RolePermissions } from "@/components/settings/role-permissions";
import { OrganizationTree } from "@/components/settings/organization-tree";
import { RoleHierarchyEditor } from "@/components/settings/role-hierarchy-editor";
import OrganizationSettings from "@/components/settings/organization-settings";

type SettingsTab = "profile" | "users" | "permissions" | "organization-tree" | "organization-settings";
type UsersSubTab = "add" | "manage";

export default function Settings(): React.JSX.Element {
  const { user } = useAuth();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [activeUserTab, setActiveUserTab] = useState<UsersSubTab>("manage");

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const { data: organization, isLoading: orgLoading } = useQuery<Organization>({
    queryKey: ["/api/organization"],
    enabled: !!user,
  });

  // If user is not authenticated, return a placeholder element instead of null
  if (!user) {
    return <div className="min-h-screen bg-background" />;
  }

  // Filter potential managers based on user's role
  const potentialManagers = users.filter(u => {
    if (user?.role === "admin") {
      return ["admin", "manager", "trainer"].includes(u.role);
    } else {
      return u.id === user?.id;
    }
  });


  const NavTab = ({
    active,
    icon: Icon,
    children,
    onClick
  }: {
    active: boolean;
    icon: any;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full p-2 rounded-lg text-left transition-colors",
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{children}</span>
    </button>
  );

  const getPageTitle = () => {
    if (activeTab === "profile") return "Profile Settings";
    if (activeTab === "users") {
      return activeUserTab === "manage" ? "Manage Users" : "Add New User";
    }
    if (activeTab === "organization-tree") return "Organization Structure";
    if (activeTab === "organization-settings") return "Organization Settings";
    return "Roles & Permissions";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* Settings Sidebar */}
        <div className="w-64 border-r bg-background flex flex-col">
          <div className="p-4 border-b">
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-5 w-5" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <div className="p-4 space-y-2 flex-1">
            <NavTab
              active={activeTab === "profile"}
              icon={UserCircle}
              onClick={() => setActiveTab("profile")}
            >
              Profile
            </NavTab>

            <NavTab
              active={activeTab === "users"}
              icon={Users}
              onClick={() => setActiveTab("users")}
            >
              Users
            </NavTab>

            {/* Show user sub-tabs only when users tab is active */}
            {activeTab === "users" && (
              <div className="pl-6 space-y-2 mt-2">
                <button
                  onClick={() => setActiveUserTab("manage")}
                  className={cn(
                    "w-full text-left p-2 rounded-lg transition-colors",
                    activeUserTab === "manage" ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Manage Users
                </button>
                <button
                  onClick={() => {
                    if (hasPermission("add_users")) {
                      setActiveUserTab("add");
                    } else {
                      toast({
                        title: "Permission Denied",
                        description: "You don't have permission to add new users",
                        variant: "destructive",
                      });
                    }
                  }}
                  className={cn(
                    "w-full text-left p-2 rounded-lg transition-colors",
                    activeUserTab === "add" && hasPermission("add_users") ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground",
                    !hasPermission("add_users") ? "opacity-60" : ""
                  )}
                >
                  Add User {!hasPermission("add_users") && <span className="inline-flex items-center"><Lock size={12} className="ml-1" /></span>}
                </button>
              </div>
            )}

            <NavTab
              active={activeTab === "permissions"}
              icon={Shield}
              onClick={() => setActiveTab("permissions")}
            >
              Roles & Permissions
            </NavTab>

            <NavTab
              active={activeTab === "organization-tree"}
              icon={Network}
              onClick={() => setActiveTab("organization-tree")}
            >
              Organization Tree
            </NavTab>

            <NavTab
              active={activeTab === "organization-settings"}
              icon={CalendarDays}
              onClick={() => setActiveTab("organization-settings")}
            >
              Organization Settings
            </NavTab>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">
            <h1 className="text-2xl font-semibold mb-6">{getPageTitle()}</h1>
            <div className="w-full">
              {usersLoading || orgLoading ? (
                <div>Loading...</div>
              ) : (
                <>
                  {activeTab === "profile" && <UserProfile />}
                  {activeTab === "users" && (
                    <>
                      {activeUserTab === "manage" && <UserManagement />}
                      {activeUserTab === "add" && hasPermission("add_users") && (
                        <div className="space-y-4">
                          <AddUser
                            users={users}
                            user={user}
                            organization={organization}
                            potentialManagers={potentialManagers}
                          />
                        </div>
                      )}
                      {activeUserTab === "add" && !hasPermission("add_users") && (
                        <div className="p-4 border rounded-md bg-yellow-50 text-yellow-800">
                          <h3 className="text-lg font-medium mb-2">Permission Required</h3>
                          <p>You do not have permission to add new users to the system.</p>
                        </div>
                      )}
                    </>
                  )}
                  {activeTab === "permissions" && (
                    <div className="space-y-6">
                      {SHOW_ROLE_ORDER_UI && <RoleHierarchyEditor />}
                      <RolePermissions />
                    </div>
                  )}
                  {activeTab === "organization-tree" && <OrganizationTree />}
                  {activeTab === "organization-settings" && (
                    <OrganizationSettings />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}