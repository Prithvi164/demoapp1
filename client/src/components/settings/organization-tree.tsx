import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Building, 
  Map, 
  ZoomIn, 
  ZoomOut, 
  Users, 
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Briefcase,
  Calendar,
  GraduationCap
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { User } from "@shared/schema";

// Helper function to get initials from name
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase();
};

// Helper function to get a random color based on name
const getAvatarColor = (name: string) => {
  // Using vibrant gradient colors for better visibility (similar to reference image)
  const colors = [
    'bg-gradient-to-br from-purple-500 to-purple-700',
    'bg-gradient-to-br from-pink-500 to-pink-700',
    'bg-gradient-to-br from-blue-500 to-blue-700',
    'bg-gradient-to-br from-cyan-500 to-cyan-700',
    'bg-gradient-to-br from-teal-500 to-teal-700',
    'bg-gradient-to-br from-green-500 to-green-700',
    'bg-gradient-to-br from-yellow-500 to-yellow-700',
    'bg-gradient-to-br from-orange-500 to-orange-700',
    'bg-gradient-to-br from-red-500 to-red-700',
    'bg-gradient-to-br from-rose-500 to-rose-700',
  ];
  
  // Generate a hash from the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use the hash to select a color
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

interface TreeNode {
  user: User;
  children: TreeNode[];
}

// Helper function to build the tree structure
const buildOrgTree = (users: User[], rootUserId: number | null = null, searchTerm: string = ""): TreeNode[] => {
  // If no search term, just build the regular organizational hierarchy
  if (!searchTerm) {
    const children = users.filter(user => user.managerId === rootUserId);
    if (!children.length) return [];

    return children.map(child => ({
      user: child,
      children: buildOrgTree(users, child.id, searchTerm)
    }));
  } 
  // When searching, we need a more sophisticated approach to maintain hierarchy
  else {
    const searchTermLower = searchTerm.toLowerCase();
    
    // Find all users matching the search term
    const matchingUsers = users.filter(user => {
      // Exact match for username (prioritize this for IDs like P_Ganesh1)
      if (user.username && user.username.toLowerCase() === searchTermLower) {
        return true;
      }
      
      // Partial match for username, fullName, or role
      return (
        (user.fullName && user.fullName.toLowerCase().includes(searchTermLower)) || 
        (user.username && user.username.toLowerCase().includes(searchTermLower)) ||
        (user.role && user.role.toLowerCase().includes(searchTermLower))
      );
    });
    
    // If no matching users, return empty array
    if (matchingUsers.length === 0) return [];
    
    // Create a set of all user IDs that should be visible in the tree
    const visibleUserIds = new Set<number>();
    
    // Function to add a user and all their ancestors to the visible set
    const addUserWithAncestors = (userId: number) => {
      // Add this user
      visibleUserIds.add(userId);
      
      // Find the user object
      const user = users.find(u => u.id === userId);
      if (!user) return;
      
      // If this user has a manager and it's not the current root, add the manager too
      if (user.managerId !== null && user.managerId !== rootUserId) {
        addUserWithAncestors(user.managerId);
      }
    };
    
    // Function to add all descendants of a user to the visible set
    const addUserDescendants = (userId: number) => {
      // Find all immediate children
      const children = users.filter(u => u.managerId === userId);
      
      // For each child, add them and their descendants
      for (const child of children) {
        visibleUserIds.add(child.id);
        addUserDescendants(child.id);
      }
    };
    
    // For each matching user, add them, their ancestors, and their descendants
    for (const user of matchingUsers) {
      // Add the user and their ancestors
      addUserWithAncestors(user.id);
      
      // Add all of the user's descendants
      addUserDescendants(user.id);
    }
    
    // Now build the tree using only the visible users
    // Get immediate children of the current root
    const children = users.filter(user => 
      user.managerId === rootUserId && 
      (visibleUserIds.has(user.id) || hasChildInSet(user.id, users, visibleUserIds))
    );
    
    if (!children.length) return [];
    
    // Build the tree with only visible users
    return children.map(child => ({
      user: child,
      children: buildChildrenTree(users, child.id, visibleUserIds)
    }));
  }
};

// Helper function to build a children tree with only users from a specific set
const buildChildrenTree = (users: User[], parentId: number, visibleUserIds: Set<number>): TreeNode[] => {
  const children = users.filter(user => 
    user.managerId === parentId && 
    (visibleUserIds.has(user.id) || hasChildInSet(user.id, users, visibleUserIds))
  );
  
  if (!children.length) return [];
  
  return children.map(child => ({
    user: child,
    children: buildChildrenTree(users, child.id, visibleUserIds)
  }));
};

// Helper function to check if a user has any children in the visible set
const hasChildInSet = (userId: number, users: User[], visibleUserIds: Set<number>): boolean => {
  const directChildren = users.filter(user => user.managerId === userId);
  
  return directChildren.some(child => 
    visibleUserIds.has(child.id) || hasChildInSet(child.id, users, visibleUserIds)
  );
};

// Helper function to check if a user has any descendants that match the search
const hasMatchingDescendant = (userId: number, users: User[], matchingIds: Set<number>): boolean => {
  const directChildren = users.filter(user => user.managerId === userId);
  
  return directChildren.some(child => 
    matchingIds.has(child.id) || hasMatchingDescendant(child.id, users, matchingIds)
  );
};

// Find a user's reporting hierarchy
const findUserHierarchy = (
  userId: number, 
  allUsers: User[],
  searchTerm: string = ""
): TreeNode | null => {
  const currentUser = allUsers.find(u => u.id === userId);
  if (!currentUser) return null;
  
  return {
    user: currentUser,
    children: buildOrgTree(allUsers, currentUser.id, searchTerm)
  };
};

interface UserCardProps {
  user: User;
  color?: string;
  department?: string;
  location?: string;
  processName?: string;
  batchInfo?: {
    name: string;
    status: string;
  } | null;
  reportCount?: number;
  onClick?: () => void;
  expanded?: boolean;
  highlighted?: boolean;
}

// User Card Component
const UserCard = ({ 
  user, 
  color, 
  department = "", 
  location = "", 
  processName = "", 
  batchInfo = null, 
  reportCount = 0,
  onClick,
  expanded = false,
  highlighted = false
}: UserCardProps) => {
  const avatarColor = color || getAvatarColor(user.fullName || user.username);
  // Enhanced gradients for the role-based header (similar to reference image)
  const roleColor = user.role === "owner" ? "bg-gradient-to-r from-primary to-primary-600" : 
                    user.role === "admin" ? "bg-gradient-to-r from-indigo-500 to-indigo-700" : 
                    user.role === "manager" ? "bg-gradient-to-r from-emerald-500 to-emerald-700" : 
                    user.role === "trainer" ? "bg-gradient-to-r from-orange-500 to-orange-700" : 
                    "bg-gradient-to-r from-blue-500 to-blue-700";
  
  return (
    <Card className={`min-w-[250px] max-w-[250px] shadow-lg hover:shadow-xl transition-all p-0 overflow-hidden border-2 
      ${expanded ? 'border-primary/70' : 'border-muted'}`}>
      {/* Gradient colored header based on role */}
      <div className={`${roleColor} h-2 w-full`}></div>
      
      <div className="p-1.5">
        <div className="flex flex-col items-center text-center mb-0.5">
          <div className="font-bold text-xs truncate w-full">{user.fullName || user.username}</div>
        </div>
        
        <div className="flex justify-center mb-2">
          <Badge 
            variant={user.role === "owner" ? "default" : "outline"} 
            className={`capitalize text-xs ${
              user.role === "owner" ? "bg-gradient-to-r from-primary to-primary-600 border-0 shadow-md" : 
              user.role === "admin" ? "border-indigo-500 text-indigo-600 shadow-sm" :
              user.role === "manager" ? "border-emerald-500 text-emerald-600 shadow-sm" :
              user.role === "trainer" ? "border-orange-500 text-orange-600 shadow-sm" :
              "border-blue-500 text-blue-600 shadow-sm"
            } px-2 py-0.5 font-medium`}
          >
            {user.role}
          </Badge>
        </div>
        
        <div className="space-y-1 mt-1">
          {/* Department - Enhanced with gradient border */}
          {department && (
            <div className="flex items-center gap-0.5 bg-gradient-to-r from-muted/20 to-muted/40 py-0.5 px-1.5 rounded-md text-xs shadow-sm border-l-[2px] border-primary/70">
              <Building className="h-2.5 w-2.5 text-primary" />
              <span className="truncate font-medium">{department}</span>
            </div>
          )}
          
          {/* Location - Enhanced with gradient */}
          {location && (
            <div className="flex items-center gap-0.5 bg-gradient-to-r from-blue-50 to-blue-100/80 dark:from-blue-900/20 dark:to-blue-900/40 py-0.5 px-1.5 rounded-md text-xs border-l-[2px] border-blue-500 shadow-sm my-0.5">
              <Map className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
              <span className="truncate font-medium">{location}</span>
            </div>
          )}
          
          {/* Process Name - Enhanced with gradient */}
          {processName && (
            <div className="flex items-center gap-0.5 bg-gradient-to-r from-emerald-50 to-emerald-100/80 dark:from-emerald-900/20 dark:to-emerald-900/40 py-0.5 px-1.5 rounded-md text-xs border-l-[2px] border-emerald-500 shadow-sm my-0.5">
              <Briefcase className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate font-medium">{processName}</span>
            </div>
          )}
          
          {/* Batch Info - Enhanced with gradient */}
          {batchInfo && (
            <div className="flex items-center gap-0.5 bg-gradient-to-r from-amber-50 to-amber-100/80 dark:from-amber-900/20 dark:to-amber-900/40 py-0.5 px-1.5 rounded-md text-xs border-l-[2px] border-amber-500 shadow-sm my-0.5">
              <GraduationCap className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
              <div className="flex items-center justify-between w-full">
                <span className="truncate font-medium">{batchInfo.name}</span>
                <span className={`ml-1 inline-flex items-center px-1 py-0 rounded-full text-[0.65rem] ${
                  batchInfo.status === 'active' ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 dark:from-green-900/40 dark:to-green-900/60 dark:text-green-300' : 
                  batchInfo.status === 'completed' ? 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 dark:from-blue-900/40 dark:to-blue-900/60 dark:text-blue-300' : 
                  batchInfo.status === 'on_hold' ? 'bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 dark:from-amber-900/40 dark:to-amber-900/60 dark:text-amber-300' : 
                  'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 dark:from-gray-800/40 dark:to-gray-800/60 dark:text-gray-300'
                }`}>
                  {batchInfo.status}
                </span>
              </div>
            </div>
          )}
        </div>
        
        {reportCount > 0 && (
          <div className="mt-1 pt-0.5 border-t border-border flex justify-center">
            <Badge 
              variant={expanded ? "default" : "secondary"}
              className={`text-xs px-1.5 py-0.5 ${
                expanded 
                  ? "bg-gradient-to-r from-primary/80 to-primary shadow-md text-primary-foreground" 
                  : "bg-gradient-to-r from-muted/30 to-muted/60 shadow-sm hover:shadow-md"
              } cursor-pointer transition-all flex items-center gap-0.5 font-medium`}
              onClick={(e) => {
                e.stopPropagation();
                if (typeof onClick === 'function') onClick();
              }}
            >
              {reportCount} {reportCount === 1 ? 'report' : 'reports'}
              {onClick && (
                <ChevronDown 
                  className={`h-2.5 w-2.5 transition-transform ${expanded ? 'rotate-180' : ''}`} 
                />
              )}
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
};

interface OrgNodeProps {
  node: TreeNode;
  level: number;
}

interface OrgNodeProps {
  node: TreeNode;
  level: number;
  searchTerm?: string;
}

// Organization Node Component for horizontal tree
const OrgNode = ({ node, level, searchTerm = "" }: OrgNodeProps) => {
  const { user: currentUser } = useAuth();
  const isRoot = level === 0;
  const hasChildren = node.children.length > 0;
  
  // Determine if this user is directly matching the search
  const isHighlighted = searchTerm ? 
    (node.user.username?.toLowerCase() === searchTerm.toLowerCase() ||
     (node.user.fullName && node.user.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
     (node.user.username && node.user.username.toLowerCase().includes(searchTerm.toLowerCase())))
    : false;
    
  // Auto-expand if there's a search term and this node is highlighted,
  // or if it's a root node in search mode
  const [expanded, setExpanded] = useState<boolean>(
    searchTerm ? (isHighlighted || isRoot) : false
  );
  
  // Get the location information from the API using React Query
  const { data: locations = [] } = useQuery<{ id: number; name: string; }[]>({
    queryKey: ["/api/organizations", currentUser?.organizationId, "locations"],
    enabled: !!currentUser?.organizationId,
  });
  
  // Get processes for the organization
  const { data: processes = [] } = useQuery<{ id: number; name: string; }[]>({
    queryKey: ["/api/organizations", currentUser?.organizationId, "processes"],
    enabled: !!currentUser?.organizationId,
  });
  
  // Get batch information
  const { data: batches = [] } = useQuery<{ 
    id: number; 
    name: string; 
    status: string;
    processId: number;
  }[]>({
    queryKey: ["/api/organizations", currentUser?.organizationId, "batches"],
    enabled: !!currentUser?.organizationId,
  });
  
  // Get all user processes (user to process mappings) with process name
  const { data: userProcesses = [] } = useQuery<{ 
    userId: number; 
    processId: number;
    processName?: string; // Added process name from our enhanced API
  }[]>({
    queryKey: ["/api/user-processes"],
    enabled: !!currentUser,
  });
  
  // Get user batch associations with batch name and process name
  const { data: userBatchProcesses = [] } = useQuery<{
    userId: number;
    batchId: number;
    processId: number;
    status: string;
    batchName?: string; // Added batch name from our enhanced API
    processName?: string; // Added process name from our enhanced API
  }[]>({
    queryKey: ["/api/user-batch-processes"],
    enabled: !!currentUser,
  });
  
  // Get user locations data from our dedicated endpoint
  const { data: userLocations = [] } = useQuery<{
    userId: number;
    locationId: number | null;
    locationName: string | null;
  }[]>({
    queryKey: ["/api/user-locations"],
    enabled: !!currentUser,
  });
  
  // Function to get location name based on locationId
  const getLocationName = (user: User): string => {
    // First try to get location name from our dedicated user locations API
    const userLocation = userLocations.find(ul => ul.userId === user.id);
    if (userLocation?.locationName) {
      return userLocation.locationName;
    }
    
    // Fallback to using the locations API
    if (user.locationId) {
      const location = locations.find(loc => loc.id === user.locationId);
      if (location?.name) {
        return location.name;
      }
    }
    
    return "Headquarters";
  };
  
  // Function to get process name for a user from their assigned processes
  const getProcessName = (user: User): string => {
    // First check if the user has any processes assigned
    if (userProcesses.length > 0) {
      // Get all processes assigned to this user (there might be multiple)
      const userProcessList = userProcesses.filter(up => up.userId === user.id);
      
      // If user has at least one process assigned
      if (userProcessList.length > 0) {
        // Use the first process name directly from our enhanced API response
        if (userProcessList[0]?.processName) {
          return userProcessList[0].processName;
        }
        
        // Fallback to old way if name isn't in the response
        if (userProcessList[0] && processes.length > 0) {
          const process = processes.find(p => p.id === userProcessList[0].processId);
          if (process?.name) {
            return process.name;
          }
        }
      }
    }
    
    // Based on the role, provide role-specific default processes
    if (user.role === "owner") return "Organization Management";
    if (user.role === "admin") return "Complaint Resolution";
    if (user.role === "manager") return "Team Management";
    if (user.role === "team_lead") return "Team Leadership";
    if (user.role === "trainer") return "Training Process";
    if (user.role === "trainee") return "Learning Process";
    if (user.role === "quality_analyst") return "QA Process";
    if (user.role === "advisor") return "Customer Support";
    
    return "General Process";
  };
  
  // Function to get batch information for a user based on their batch assignment
  const getBatchInfo = (user: User) => {
    // Find user's batch assignment from the userBatchProcesses data
    if (userBatchProcesses.length > 0) {
      const userBatch = userBatchProcesses.find(ubp => ubp.userId === user.id);
      
      if (userBatch) {
        // Use the batch name directly from our enhanced API response
        if (userBatch.batchName) {
          return {
            name: userBatch.batchName,
            status: userBatch.status || "active"
          };
        }
        
        // Fallback to old way using batches data
        if (batches.length > 0) {
          const batch = batches.find(b => b.id === userBatch.batchId);
          if (batch) {
            return {
              name: batch.name,
              status: userBatch.status || "active"
            };
          }
        }
      }
    }
    
    // Only show generic batch info for trainees and trainers if no specific batch found
    if (user.role === "trainee" || user.role === "trainer") {
      // Fallback for trainees/trainers with role-specific names
      return {
        name: user.role === "trainee" ? "Learning Batch" : "Training Batch",
        status: "active"
      };
    }
    
    return null;
  };
  
  return (
    <div className="flex flex-col items-center">
      {/* User card */}
      <div className="mb-4">
        <UserCard 
          user={node.user}
          // Display user's email instead of department/role
          department={node.user.email}
          // Pass location information or empty string
          location={getLocationName(node.user)}
          // Pass process information
          processName={getProcessName(node.user)}
          // Pass batch information
          batchInfo={getBatchInfo(node.user)}
          reportCount={node.children.length}
          onClick={() => setExpanded(!expanded)}
          expanded={expanded}
          highlighted={isHighlighted ? true : false}
        />
      </div>
      
      {/* Connector line to children - only show when expanded */}
      {hasChildren && expanded && (
        <div className="w-[2px] h-8 bg-gradient-to-b from-primary/60 to-primary/30 rounded-full" />
      )}
      
      {/* Children - only show when expanded */}
      {hasChildren && expanded && (
        <div className="relative">
          {/* Horizontal connecting line */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-4 h-4 w-[2px] bg-gradient-to-t from-primary/60 to-primary/30 rounded-full" />
          
          {/* Horizontal line above children */}
          <div 
            className={`absolute h-[2px] bg-gradient-to-r from-primary/30 via-primary/60 to-primary/30 rounded-full ${node.children.length > 1 ? 'left-0 right-0' : 'w-0'}`} 
            style={{ top: '-4px' }} 
          />
          
          <div className="flex gap-6 mt-2">
            {node.children.map((child, index) => (
              <div key={child.user.id} className="relative">
                {/* Vertical connecting line to parent */}
                {node.children.length > 1 && index > 0 && (
                  <div className="absolute left-1/2 -translate-x-1/2 -top-4 h-4 w-[2px] bg-gradient-to-t from-primary/60 to-primary/30 rounded-full" />
                )}
                <OrgNode 
                  node={child} 
                  level={level + 1} 
                  searchTerm={searchTerm}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export function OrganizationTree() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [groupByDepartment, setGroupByDepartment] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewMode, setViewMode] = useState<'full' | 'myHierarchy'>('full');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  // Zoom in function
  const zoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.1, 2));
  };

  // Zoom out function
  const zoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
  };

  // Reset zoom function
  const resetZoom = () => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  };

  // View top of organization
  const viewFullOrg = () => {
    setViewMode('full');
    setPosition({ x: 0, y: 0 });
  };

  // View my reporting hierarchy
  const viewMyHierarchy = () => {
    setViewMode('myHierarchy');
    setPosition({ x: 0, y: 0 });
  };
  
  // Handle mouse down for drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };
  
  // Handle mouse move for drag
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setPosition({ x: newX, y: newY });
    }
  };
  
  // Handle mouse up to end drag
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Scroll to center when zoom changes
  useEffect(() => {
    if (chartContainerRef.current) {
      const container = chartContainerRef.current;
      const scrollToCenter = () => {
        // Get the container dimensions
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        
        // Get the content dimensions
        const contentWidth = container.scrollWidth;
        const contentHeight = container.scrollHeight;
        
        // Calculate the center point
        const scrollLeft = (contentWidth - containerWidth) / 2;
        const scrollTop = (contentHeight - containerHeight) / 2;
        
        // Scroll to center
        container.scrollTo(scrollLeft, scrollTop);
      };
      
      scrollToCenter();
    }
  }, [zoomLevel, viewMode]);

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded mb-6" />
        <div className="h-40 w-full bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  // Find the root user (owner or highest level manager)
  const rootUser = users.find(u => u.role === "owner");
  if (!rootUser) return <div>No organization structure found</div>;

  // Build the appropriate tree based on view mode
  let displayTree: TreeNode[] = [];
  
  if (viewMode === 'full') {
    displayTree = [{
      user: rootUser,
      children: buildOrgTree(users, rootUser.id, searchQuery.trim())
    }];
  } else if (viewMode === 'myHierarchy' && user) {
    const myHierarchy = findUserHierarchy(user.id, users, searchQuery.trim());
    if (myHierarchy) {
      displayTree = [myHierarchy];
    } else {
      // Fallback to full org if user's hierarchy not found
      displayTree = [{
        user: rootUser,
        children: buildOrgTree(users, rootUser.id, searchQuery.trim())
      }];
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search Employee" 
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1" 
              onClick={viewFullOrg}
              disabled={viewMode === 'full'}
            >
              <ChevronUp className="h-4 w-4" />
              <span className="hidden sm:inline">Top of Org</span>
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1"
              onClick={viewMyHierarchy}
              disabled={viewMode === 'myHierarchy'}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">My Hierarchy</span>
            </Button>
            
            <div className="flex items-center gap-2 ml-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Group by dept</span>
              <div 
                className={`h-5 w-10 rounded-full p-0.5 cursor-pointer transition-colors ${groupByDepartment ? 'bg-primary' : 'bg-muted'}`}
                onClick={() => setGroupByDepartment(!groupByDepartment)}
              >
                <div 
                  className={`h-4 w-4 rounded-full bg-white transform transition-transform ${groupByDepartment ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div 
        className={`bg-muted/30 rounded-lg p-6 overflow-auto ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ minHeight: '400px', maxHeight: '70vh' }}
        ref={chartContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Zoom controls */}
        <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-10">
          <Button size="icon" variant="outline" onClick={zoomIn} className="rounded-full bg-background">
            <ZoomIn size={18} />
          </Button>
          <Button size="icon" variant="outline" onClick={zoomOut} className="rounded-full bg-background">
            <ZoomOut size={18} />
          </Button>
          <Button size="icon" variant="outline" onClick={resetZoom} className="rounded-full bg-background">
            <RotateCcw size={18} />
          </Button>
        </div>
        
        <div 
          className="flex justify-center min-w-max pb-6 transition-transform duration-300"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center top',
          }}
        >
          <div className="org-chart">
            {displayTree.map((node) => (
              <OrgNode 
                key={node.user.id} 
                node={node} 
                level={0} 
                searchTerm={searchQuery.trim()}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}