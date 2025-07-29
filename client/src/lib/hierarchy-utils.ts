import type { User } from "@shared/schema";

/**
 * Determines if userB reports directly or indirectly to userA
 * 
 * @param userAId The ID of the potential manager
 * @param userBId The ID of the potential report
 * @param allUsers List of all users in the system
 * @returns boolean indicating if userB is a direct or indirect report of userA
 */
export const isSubordinate = (userAId: number, userBId: number, allUsers: User[]): boolean => {
  const userB = allUsers.find(u => u.id === userBId);
  if (!userB || userB.managerId === null) return false;
  if (userB.managerId === userAId) return true;
  return isSubordinate(userAId, userB.managerId, allUsers);
};

/**
 * Gets all direct and indirect reports of a user
 * 
 * @param userId The ID of the user to get reports for
 * @param allUsers List of all users in the system
 * @returns Array of users who report directly or indirectly to the user
 */
export const getAllSubordinates = (userId: number, allUsers: User[]): User[] => {
  // Get direct reports
  const directReports = allUsers.filter(user => user.managerId === userId);
  
  // Get indirect reports (reports of direct reports)
  const indirectReports = directReports.flatMap(report => 
    getAllSubordinates(report.id, allUsers)
  );
  
  // Combine and return
  return [...directReports, ...indirectReports];
};

/**
 * Gets all users in a user's reporting chain (the user and all their subordinates)
 * 
 * @param userId The ID of the user
 * @param allUsers List of all users in the system
 * @returns Array of users in the reporting chain (including the user)
 */
export const getReportingChainUsers = (userId: number, allUsers: User[]): User[] => {
  const currentUser = allUsers.find(u => u.id === userId);
  if (!currentUser) return [];
  
  // Get all subordinates
  const subordinates = getAllSubordinates(userId, allUsers);
  
  // Return current user and all subordinates
  return [currentUser, ...subordinates];
};

/**
 * Determines if a user can edit another user based on hierarchy
 * 
 * @param currentUser The user attempting to edit
 * @param targetUserId The ID of the user being edited
 * @param allUsers List of all users in the system
 * @returns boolean indicating if the current user can edit the target user
 */
export const canEditUser = (currentUser: User, targetUserId: number, allUsers: User[]): boolean => {
  // Always can edit yourself
  if (currentUser.id === targetUserId) return true;
  
  // Admins and owners have special permissions
  if (currentUser.role === 'owner') return true;
  if (currentUser.role === 'admin') {
    // Admins can edit anyone except owners
    const targetUser = allUsers.find(u => u.id === targetUserId);
    return targetUser?.role !== 'owner';
  }
  
  // For everyone else, can only edit subordinates
  return isSubordinate(currentUser.id, targetUserId, allUsers);
};

/**
 * Gets a user's full reporting path
 * 
 * @param userId The ID of the user
 * @param allUsers List of all users in the system
 * @returns Array of users representing the reporting path (from top to bottom)
 */
export const getReportingPath = (userId: number, allUsers: User[]): User[] => {
  const path: User[] = [];
  let currentId: number | null = userId;
  
  // Prevent infinite loops with a reasonable limit
  const maxDepth = 10;
  let currentDepth = 0;
  
  while (currentId !== null && currentDepth < maxDepth) {
    const user = allUsers.find(u => u.id === currentId);
    if (!user) break;
    
    // Add user to the beginning of the path (so it goes from top to bottom)
    path.unshift(user);
    currentId = user.managerId;
    currentDepth++;
  }
  
  return path;
};

/**
 * Gets a formatted string representing a user's reporting path
 * 
 * @param userId The ID of the user
 * @param allUsers List of all users in the system
 * @returns String representing the reporting path (e.g. "CEO → Manager → Team Lead")
 */
export const getFormattedReportingPath = (userId: number, allUsers: User[]): string => {
  const path = getReportingPath(userId, allUsers);
  if (path.length <= 1) return "No Manager";
  
  // Remove the user themselves from the path (keep only their managers)
  const managerPath = path.slice(0, -1);
  return managerPath
    .map(user => user.fullName || user.username)
    .join(" → ");
};