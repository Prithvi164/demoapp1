import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { User, Organization, OrganizationProcess, OrganizationLineOfBusiness, OrganizationLocation } from "@shared/schema";
import { requiresLineOfBusiness } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Check, FileSpreadsheet, Upload, Download, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions, PermissionGuard } from "@/hooks/use-permissions"; // Add permissions hook
import * as XLSX from "xlsx";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface AddUserProps {
  users: User[];
  user: User;
  organization: Organization | undefined;
  potentialManagers: User[];
}

// Add bulk upload types
type BulkUserUpload = {
  username: string;
  fullName: string;
  email: string;
  role: string;
  reportingManager: string; // Username of the manager
  location: string;
  employeeId: string;
  password: string;
  phoneNumber: string;
  dateOfJoining: string;
  dateOfBirth: string;
  education: string;
  lineOfBusiness: string;
  process: string;
};

export function AddUser({ users, user, organization, potentialManagers }: AddUserProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedLOBs, setSelectedLOBs] = useState<number[]>([]);
  const [openLOB, setOpenLOB] = useState(false);
  const [openProcess, setOpenProcess] = useState(false);
  const [openManager, setOpenManager] = useState(false);
  const [openLocation, setOpenLocation] = useState(false);
  const [bulkUploadData, setBulkUploadData] = useState<BulkUserUpload[]>([]);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Check if user has permission to add users
  const canAddUsers = hasPermission("add_users") || hasPermission("manage_users");
  
  // Reset bulk upload UI if permission is revoked
  useEffect(() => {
    if (!hasPermission("upload_users")) {
      setShowBulkUpload(false);
      setBulkUploadData([]);
    }
  }, [hasPermission]);
  
  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    fullName: "",
    employeeId: "",
    role: "",
    category: "active", // Default to active
    email: "",
    phoneNumber: "",
    education: "",
    dateOfJoining: "",
    dateOfBirth: "",
    managerId: "none",
    locationId: "none",
    processes: [] as number[],
  });

  const { data: lineOfBusinesses = [], isLoading: isLoadingLOB } = useQuery<OrganizationLineOfBusiness[]>({
    queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`],
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: locations = [], isLoading: isLoadingLocations } = useQuery<OrganizationLocation[]>({
    queryKey: [`/api/organizations/${organization?.id}/locations`],
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: processes = [], isLoading: isLoadingProcesses } = useQuery<OrganizationProcess[]>({
    queryKey: [`/api/organizations/${organization?.id}/processes`],
    enabled: !!organization?.id && selectedLOBs.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const filteredProcesses = processes.filter(process => 
    selectedLOBs.includes(process.lineOfBusinessId)
  );
  
  // Clear form data when component mounts/opens
  useEffect(() => {
    // Reset form data to defaults when component mounts
    setNewUserData({
      username: "",
      password: "",
      fullName: "",
      employeeId: "",
      role: "",
      category: "active",
      email: "",
      phoneNumber: "",
      education: "",
      dateOfJoining: "",
      dateOfBirth: "",
      managerId: "none",
      locationId: "none",
      processes: [],
    });
    setSelectedLOBs([]);
  }, []);
  
  // Watch for role changes to enforce Line of Business validation
  useEffect(() => {
    // Check role and update LOB requirement visuals
    if (requiresLineOfBusiness(newUserData.role) && selectedLOBs.length === 0) {
      console.log(`Role ${newUserData.role} requires Line of Business selection`);
    }
  }, [newUserData.role, selectedLOBs]);

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof newUserData) => {
      // Prepare payload with required data
      const payload: any = {
        ...data,
        organizationId: organization?.id,
      };
      
      // Include lineOfBusinessId if we have LOBs selected
      if (selectedLOBs.length > 0) {
        // Using the first selected LOB as the lineOfBusinessId
        payload.lineOfBusinessId = selectedLOBs[0];
      }
      
      return apiRequest('POST', '/api/users', payload);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User created successfully",
      });
      setNewUserData({
        username: "",
        password: "",
        fullName: "",
        employeeId: "",
        role: "",
        category: "active",
        email: "",
        phoneNumber: "",
        education: "",
        dateOfJoining: "",
        dateOfBirth: "",
        managerId: "none",
        locationId: "none",
        processes: [],
      });
      setSelectedLOBs([]);
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error) => {
      // Create user-friendly error messages
      let errorMessage = error.message || "Failed to create user";
      let errorTitle = "Error";
      
      // Check for specific error patterns and provide more user-friendly messages
      if (errorMessage.includes("invalid input syntax for type integer: 'none'")) {
        errorMessage = "Please select a location and reporting manager before creating the user.";
        errorTitle = "Missing Information";
      } else if (errorMessage.includes("syntax")) {
        errorMessage = "There is an issue with the information you provided. Please check all fields and try again.";
      } else if (errorMessage.includes("duplicate") || errorMessage.includes("already exists")) {
        errorMessage = "A user with this username or email already exists.";
        errorTitle = "Duplicate User";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: async (data: BulkUserUpload[]) => {
      return apiRequest('POST', '/api/users/bulk', {
        users: data,
        organizationId: organization?.id,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Users uploaded successfully",
      });
      setBulkUploadData([]);
      // Reset file input after successful upload
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error & { validationErrors?: string[]; title?: string }) => {
      let errorTitle = error.title || "Upload Error";
      let errorMessage = error.message || "Failed to upload users";
      
      // Handle validation errors with detailed breakdown
      if (error.validationErrors && error.validationErrors.length > 0) {
        errorTitle = "Validation Errors Found";
        
        // Create a detailed error message showing each validation issue
        const errorCount = error.validationErrors.length;
        const maxShow = 5; // Show maximum 5 errors to avoid overwhelming UI
        
        let detailedMessage = `Found ${errorCount} validation error${errorCount > 1 ? 's' : ''}:\n\n`;
        
        // Show up to maxShow errors
        const errorsToShow = error.validationErrors.slice(0, maxShow);
        errorsToShow.forEach((err, index) => {
          detailedMessage += `${index + 1}. ${err}\n`;
        });
        
        // If there are more errors, indicate how many are hidden
        if (error.validationErrors.length > maxShow) {
          const remaining = error.validationErrors.length - maxShow;
          detailedMessage += `\n... and ${remaining} more error${remaining > 1 ? 's' : ''}`;
        }
        
        detailedMessage += `\n\nPlease fix these issues and try uploading again.`;
        errorMessage = detailedMessage;
      } else {
        // Handle other error types with pattern matching
        if (errorMessage.includes("Employee ID") && errorMessage.includes("already exists")) {
          errorTitle = "Duplicate Employee ID";
        } else if (errorMessage.includes("Username") && errorMessage.includes("already exists")) {
          errorTitle = "Duplicate Username";
        } else if (errorMessage.includes("Email") && errorMessage.includes("already exists")) {
          errorTitle = "Duplicate Email";
        } else if (errorMessage.includes("invalid input syntax for type integer")) {
          errorMessage = "Some users are missing required information. Please check that all users have required fields filled in correctly.";
          errorTitle = "Missing Information";
        } else if (errorMessage.includes("duplicate") || errorMessage.includes("already exists")) {
          errorMessage = "Some users could not be created because usernames or emails already exist in the system.";
          errorTitle = "Duplicate Users";
        } else if (errorMessage.includes("validation")) {
          errorMessage = "There are validation errors in your uploaded data. Please check the format and try again.";
          errorTitle = "Validation Error";
        } else if (errorMessage.includes("Invalid role")) {
          errorTitle = "Invalid Role";
        }
        
        // Clean up status code prefix from message
        errorMessage = errorMessage.replace(/^\d+:\s*/, '');
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  function getValidManagersForRole(role: string): User[] {
    if (role === "owner") return [];
    
    let validRoles: string[] = [];
    
    switch(role) {
      case "admin":
        validRoles = ["owner"];
        break;
      case "manager":
        validRoles = ["owner", "admin"];
        break;
      case "team_lead":
        validRoles = ["owner", "admin", "manager"];
        break;
      case "quality_analyst":
      case "trainer":
        validRoles = ["owner", "admin", "manager", "team_lead"];
        break;
      default:
        validRoles = ["owner", "admin", "manager", "team_lead", "trainer"];
    }
    
    // Filter to users in our reporting chain
    const currentUserHierarchy = new Set<number>();
    
    // Get current user's reporting chain
    function buildCurrentUserChain(userId: number) {
      currentUserHierarchy.add(userId);
      const userManagers = users.filter(u => u.managerId === userId);
      userManagers.forEach(manager => buildCurrentUserChain(manager.id));
    }
    
    // Start with ourselves
    buildCurrentUserChain(user.id);
    
    // Add all users above us in the hierarchy
    let currentUserId = user.id;
    let currentUser = users.find(u => u.id === currentUserId);
    
    while (currentUser && currentUser.managerId) {
      currentUserHierarchy.add(currentUser.managerId);
      currentUser = users.find(u => u.id === currentUser.managerId);
    }
    
    return users.filter(u => 
      validRoles.includes(u.role) && 
      (currentUserHierarchy.has(u.id) || u.id === user.id)
    );
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const binaryData = event.target?.result;
      const workbook = XLSX.read(binaryData, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<BulkUserUpload>(worksheet);
      
      if (data.length === 0) {
        toast({
          title: "Error",
          description: "No data found in the uploaded file",
          variant: "destructive",
        });
        return;
      }
      
      setBulkUploadData(data);
    };
    reader.readAsBinaryString(file);
  }

  function downloadTemplate() {
    // Get existing managers' usernames for the example template
    // Find first available manager
    let exampleManager = "your_manager_username";
    const validManagers = potentialManagers.filter(m => ["owner", "admin", "manager", "team_lead"].includes(m.role));
    if (validManagers.length > 0) {
      exampleManager = validManagers[0].username;
    }
    
    // Create a workbook
    const wb = XLSX.utils.book_new();
    
    // Create a sheet with comprehensive user data template
    const exampleData = [
      {
        username: "jsmith",
        fullName: "John Smith",
        email: "jsmith@example.com",
        role: "advisor", // Valid values: owner, admin, manager, team_lead, quality_analyst, trainer, advisor
        reportingManager: exampleManager, // Must be an existing username in the system
        location: "Mumbai", // Must match existing location name in the system
        employeeId: "EMP001",
        password: "securepassword123",
        phoneNumber: "123-456-7890",
        dateOfJoining: "2023-01-15", // yyyy-MM-dd format
        dateOfBirth: "1990-05-20", // yyyy-MM-dd format
        education: "Bachelor's in Business",
        process: "Lead Generation, Customer Support, Technical Support" // Multiple processes separated by commas
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(exampleData);
    XLSX.utils.book_append_sheet(wb, ws, "Users Template");
    
    // Create a sheet with field explanations
    const fieldInfo = [
      { Field: "username", Description: "Unique username (required), no spaces allowed", Example: "john.smith" },
      { Field: "fullName", Description: "User's full name (required)", Example: "John Smith" },
      { Field: "email", Description: "Valid email address (required)", Example: "john.smith@example.com" },
      { Field: "role", Description: "User role (required). Valid values: owner, admin, manager, team_lead, quality_analyst, trainer, advisor", Example: "advisor" },
      { Field: "reportingManager", Description: "Username of the manager (respects role hierarchy)", Example: "jane.manager" },
      { Field: "location", Description: "Location name (must match existing location in the system)", Example: "Mumbai" },
      { Field: "employeeId", Description: "Employee ID (optional)", Example: "EMP001" },
      { Field: "password", Description: "Initial password (required)", Example: "securepassword123" },
      { Field: "phoneNumber", Description: "Phone number (optional)", Example: "123-456-7890" },
      { Field: "dateOfJoining", Description: "Date of joining in YYYY-MM-DD format (optional)", Example: "2023-01-15" },
      { Field: "dateOfBirth", Description: "Date of birth in YYYY-MM-DD format (optional)", Example: "1990-05-20" },
      { Field: "education", Description: "Educational background (optional)", Example: "Bachelor's in Business" },
      { Field: "process", Description: "Process name(s). For multiple processes, separate with commas. Each process must match existing process names in the system. The system will automatically assign the appropriate Line of Business for each process.", Example: "Lead Generation, Customer Support, Technical Support" }
    ];
    
    const fieldInfoSheet = XLSX.utils.json_to_sheet(fieldInfo);
    XLSX.utils.book_append_sheet(wb, fieldInfoSheet, "Field Descriptions");
    
    // Add Role hierarchy information in another sheet
    const roleInfo = [
      { Role: "owner", "Reports To": "No one", "Display Name": "Owner" },
      { Role: "admin", "Reports To": "Owner only", "Display Name": "Admin" },
      { Role: "manager", "Reports To": "Owner or Admin", "Display Name": "Manager" },
      { Role: "team_lead", "Reports To": "Owner, Admin, or Manager", "Display Name": "Team Lead" },
      { Role: "quality_analyst", "Reports To": "Owner, Admin, Manager, or Team Lead", "Display Name": "Quality Analyst" },
      { Role: "trainer", "Reports To": "Owner, Admin, Manager, or Team Lead", "Display Name": "Trainer" },
      { Role: "advisor", "Reports To": "Any higher role", "Display Name": "Advisor" }
    ];
    
    const roleSheet = XLSX.utils.json_to_sheet(roleInfo);
    XLSX.utils.book_append_sheet(wb, roleSheet, "Role Hierarchy");
    
    // Add location information
    const locationInfo = locations.map(loc => ({
      "Location ID": loc.id,
      "Location Name": loc.name,
      "City": loc.city,
      "State": loc.state,
      "Country": loc.country
    }));
    
    if (locationInfo.length > 0) {
      const locationSheet = XLSX.utils.json_to_sheet(locationInfo);
      XLSX.utils.book_append_sheet(wb, locationSheet, "Available Locations");
    }
    
    // Lines of Business sheet removed as it's no longer needed
    // Process sheet already shows the line of business for each process
    
    // Add Process information
    const processInfo = processes.map(proc => ({
      "Process ID": proc.id,
      "Process Name": proc.name,
      "Line of Business": lineOfBusinesses.find(lob => lob.id === proc.lineOfBusinessId)?.name || "Unknown",
      "Description": proc.description
    }));
    
    if (processInfo.length > 0) {
      const processSheet = XLSX.utils.json_to_sheet(processInfo);
      XLSX.utils.book_append_sheet(wb, processSheet, "Available Processes");
    }
    
    // Generate Excel file
    XLSX.writeFile(wb, "user-upload-template.xlsx");
  }

  if (isLoadingLOB || isLoadingLocations) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading organization data...</span>
      </div>
    );
  }

  return (
    <Card className="border-t-4 border-t-primary/70 shadow-md">
      <CardHeader className="pb-4 bg-gradient-to-r from-muted/50 to-background">
        <CardTitle className="flex justify-between items-center">
          <span className="text-xl font-semibold"></span>
          <div className="flex items-center gap-2">
            {hasPermission("upload_users") && (
              <>
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5"
                  size="sm"
                >
                  <Download className="h-4 w-4" />
                  <span>Template</span>
                </Button>
                <Button
                  variant={showBulkUpload ? "secondary" : "outline"}
                  onClick={() => setShowBulkUpload(!showBulkUpload)}
                  className="flex items-center gap-1.5"
                  size="sm"
                >
                  <Upload className="h-4 w-4" />
                  <span>Bulk Upload</span>
                </Button>
              </>
            )}
          </div>
        </CardTitle>
        <CardDescription className="text-sm mt-1">
          {canAddUsers 
            ? "Complete the form below to create a new user account" 
            : "You need 'Add Users' permission to create user accounts"}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Bulk Upload Section */}
        <div className={showBulkUpload ? "block" : "hidden"}>
          <PermissionGuard permission="upload_users">
            <div className="space-y-4 mb-6">
              <div>
                <h3 className="text-base font-medium mb-2">Bulk Upload Users</h3>
                <p className="text-sm text-muted-foreground mb-2">Upload multiple users using an Excel file</p>
                <div className="mb-4 bg-muted p-3 rounded-md text-sm">
                  <p className="font-medium mb-1">Role Hierarchy Requirements</p>
                  <p className="text-muted-foreground">Users can only report to managers with appropriate roles according to the hierarchy:</p>
                  <ul className="list-disc list-inside text-muted-foreground pl-2 space-y-1 mt-1">
                    <li>Owners don't report to anyone</li>
                    <li>Admins can only report to Owners</li>
                    <li>Managers can report to Owners or Admins</li>
                    <li>Team Leads can report to Owners, Admins, or Managers</li>
                    <li>Quality Analysts and Trainers can report to Owners, Admins, Managers, or Team Leads</li>
                    <li>Advisors can report to any higher role</li>
                  </ul>
                  <p className="text-muted-foreground mt-2"><strong>Important:</strong> You can only assign managers who are within your own reporting chain. For example, if you are a Team Lead, you can only assign users to report to yourself or your upline managers.</p>
                  <p className="text-muted-foreground mt-2">The downloaded template includes detailed guidance in the "Role Hierarchy" sheet.</p>
                </div>
                

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="file-upload">Select Excel File</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="file-upload"
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        className="flex-1"
                        ref={fileInputRef}
                      />
                      <Button
                        onClick={() => bulkUploadMutation.mutate(bulkUploadData)}
                        disabled={bulkUploadData.length === 0 || bulkUploadMutation.isPending}
                      >
                        {bulkUploadMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Uploading...
                          </>
                        ) : (
                          "Upload Users"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {bulkUploadData.length > 0 && (
                <div>
                  <div className="space-y-2 mb-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Preview: {bulkUploadData.length} users</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBulkUploadData([]);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                    
                    {bulkUploadData.some(user => user.reportingManager === "manager_username") && (
                      <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="text-xs font-medium">Validation Error</AlertTitle>
                        <AlertDescription className="text-xs">
                          Please update the placeholder "manager_username" to an actual manager username that exists in the system.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Process</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkUploadData.map((user, index) => (
                        <TableRow key={index}>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.fullName}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.role}</TableCell>
                          <TableCell>{user.location}</TableCell>
                          <TableCell>
                            {user.process?.split(',').map((proc, idx) => (
                              <Badge key={idx} variant="outline" className="mr-1 my-0.5">
                                {proc.trim()}
                              </Badge>
                            ))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </PermissionGuard>
        </div>

        {/* Add User Form */}
        <form
          className={`space-y-6 ${!canAddUsers ? 'opacity-70 pointer-events-none' : ''}`}
          onSubmit={(e) => {
            e.preventDefault();
            
            // Check if Line of Business is required but not selected
            if (requiresLineOfBusiness(newUserData.role) && selectedLOBs.length === 0) {
              toast({
                title: "Validation Error",
                description: "Line of Business is required for this role. Please select at least one Line of Business.",
                variant: "destructive",
              });
              return; // Prevent form submission
            }
            
            if (canAddUsers) {
              createUserMutation.mutate(newUserData);
            } else {
              toast({
                title: "Permission Denied",
                description: "You don't have permission to add users",
                variant: "destructive",
              });
            }
          }}
        >
          {/* Account Information Section */}
          <div className="space-y-4">
            <div className="border-b pb-1 mb-3">
              <h3 className="text-md font-medium text-primary/80">Account Information</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">
                  Username <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="username"
                  value={newUserData.username}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    username: e.target.value
                  }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="fullName">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fullName"
                  value={newUserData.fullName}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    fullName: e.target.value
                  }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    email: e.target.value
                  }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">
                  Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    password: e.target.value
                  }))}
                  required
                />
              </div>
            </div>
          </div>
          
          {/* Role & Reporting Section */}
          <div className="space-y-4">
            <div className="border-b pb-1 mb-3">
              <h3 className="text-md font-medium text-primary/80">Role & Organization</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">
                  Role <span className="text-red-500">*</span>
                </Label>
                <select
                  id="role"
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  value={newUserData.role}
                  onChange={(e) => {
                    setNewUserData(prev => ({
                      ...prev,
                      role: e.target.value,
                      managerId: "none",
                      processes: []
                    }));
                    setSelectedLOBs([]);
                  }}
                  required
                >
                  <option value="" disabled>Select a role...</option>
                  {user.role === "owner" ? (
                    <>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="team_lead">Team Lead</option>
                      <option value="quality_analyst">Quality Analyst</option>
                      <option value="trainer">Trainer</option>
                      <option value="advisor">Advisor</option>
                    </>
                  ) : user.role === "admin" ? (
                    <>
                      <option value="manager">Manager</option>
                      <option value="team_lead">Team Lead</option>
                      <option value="quality_analyst">Quality Analyst</option>
                      <option value="trainer">Trainer</option>
                      <option value="advisor">Advisor</option>
                    </>
                  ) : (
                    <>
                      <option value="team_lead">Team Lead</option>
                      <option value="quality_analyst">Quality Analyst</option>
                      <option value="trainer">Trainer</option>
                      <option value="advisor">Advisor</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <Label htmlFor="managerId">
                  Reporting Manager <span className="text-red-500">*</span>
                </Label>
                <Popover open={openManager} onOpenChange={setOpenManager}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openManager}
                      className="w-full justify-between"
                    >
                      {newUserData.managerId === "none"
                        ? "Select manager..."
                        : getValidManagersForRole(newUserData.role).find(m => m.id.toString() === newUserData.managerId)
                          ? `${getValidManagersForRole(newUserData.role).find(m => m.id.toString() === newUserData.managerId)?.fullName}`
                          : "Select manager..."}
                      <Check
                        className={cn(
                          "ml-2 h-4 w-4",
                          newUserData.managerId !== "none" ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Search manager..." />
                      <CommandEmpty>No manager found.</CommandEmpty>
                      <div className="max-h-[300px] overflow-y-auto">
                        <CommandGroup>
                          {getValidManagersForRole(newUserData.role).map((manager) => (
                            <CommandItem
                              key={manager.id}
                              onSelect={() => {
                                setNewUserData(prev => ({
                                  ...prev,
                                  managerId: manager.id.toString()
                                }));
                                setOpenManager(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  newUserData.managerId === manager.id.toString() ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {manager.fullName} ({manager.role})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </div>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="locationId">
                  Location <span className="text-red-500">*</span>
                </Label>
                <Popover open={openLocation} onOpenChange={setOpenLocation}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openLocation}
                      className="w-full justify-between"
                    >
                      {newUserData.locationId === "none"
                        ? "Select location..."
                        : locations.find(l => l.id.toString() === newUserData.locationId)?.name || "Select location..."}
                      <Check
                        className={cn(
                          "ml-2 h-4 w-4",
                          newUserData.locationId !== "none" ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Search location..." />
                      <CommandEmpty>No location found.</CommandEmpty>
                      <div className="max-h-[300px] overflow-y-auto">
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => {
                              setNewUserData(prev => ({ ...prev, locationId: "none" }));
                              setOpenLocation(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                newUserData.locationId === "none" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            No Location
                          </CommandItem>
                          {locations.map((location) => (
                            <CommandItem
                              key={location.id}
                              onSelect={() => {
                                setNewUserData(prev => ({
                                  ...prev,
                                  locationId: location.id.toString()
                                }));
                                setOpenLocation(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  newUserData.locationId === location.id.toString() ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {location.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </div>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="employeeId">
                  Employee ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="employeeId"
                  value={newUserData.employeeId}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    employeeId: e.target.value
                  }))}
                  required
                />
              </div>
            </div>
          </div>
          
          {/* Business Information Section */}
          <div className="space-y-4">
            <div className="border-b pb-1 mb-3">
              <h3 className="text-md font-medium text-primary/80">Business Information</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>
                  Line of Business
                  {requiresLineOfBusiness(newUserData.role) && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </Label>
                <Popover open={openLOB} onOpenChange={setOpenLOB}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openLOB}
                      className="w-full justify-between"
                    >
                      {selectedLOBs.length > 0
                        ? `${selectedLOBs.length} LOBs selected`
                        : "Select Line of Business"}
                      <Check
                        className={cn(
                          "ml-2 h-4 w-4",
                          selectedLOBs.length > 0 ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search Line of Business..." />
                      <CommandEmpty>No Line of Business found.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {lineOfBusinesses.map((lob) => (
                          <CommandItem
                            key={lob.id}
                            onSelect={() => {
                              setSelectedLOBs(prev => {
                                const newSelection = prev.includes(lob.id)
                                  ? prev.filter(id => id !== lob.id)
                                  : [...prev, lob.id];
                                return newSelection;
                              });
                              setNewUserData(prev => ({
                                ...prev,
                                processes: []
                              }));
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedLOBs.includes(lob.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {lob.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedLOBs.length > 0 && (
                <div>
                  <Label>Processes</Label>
                  <Popover open={openProcess} onOpenChange={setOpenProcess}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openProcess}
                        className="w-full justify-between"
                      >
                        {isLoadingProcesses ? (
                          <div className="flex items-center">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading processes...
                          </div>
                        ) : (
                          <>
                            {newUserData.processes.length > 0
                              ? `${newUserData.processes.length} processes selected`
                              : "Select processes"}
                            <Check
                              className={cn(
                                "ml-2 h-4 w-4",
                                newUserData.processes.length > 0 ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search processes..." />
                        <CommandEmpty>No process found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                          {filteredProcesses.map((process) => (
                            <CommandItem
                              key={process.id}
                              onSelect={() => {
                                setNewUserData(prev => {
                                  const newProcesses = prev.processes.includes(process.id)
                                    ? prev.processes.filter(id => id !== process.id)
                                    : [...prev.processes, process.id];
                                  return { ...prev, processes: newProcesses };
                                });
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  newUserData.processes.includes(process.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {process.name}
                              <span className="ml-2 text-muted-foreground">
                                ({lineOfBusinesses.find(l => l.id === process.lineOfBusinessId)?.name})
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>
          
          {/* Personal Information Section */}
          <div className="space-y-4">
            <div className="border-b pb-1 mb-3">
              <h3 className="text-md font-medium text-primary/80">Personal Information</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phoneNumber">
                  Phone Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phoneNumber"
                  value={newUserData.phoneNumber}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    phoneNumber: e.target.value
                  }))}
                  pattern="[0-9]{10}"
                  title="Please enter exactly 10 digits"
                  required
                />
              </div>

              <div>
                <Label htmlFor="dateOfJoining">
                  Date of Joining <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dateOfJoining"
                  type="date"
                  value={newUserData.dateOfJoining}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    dateOfJoining: e.target.value
                  }))}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={newUserData.dateOfBirth}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    dateOfBirth: e.target.value
                  }))}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <Label htmlFor="education">Education</Label>
                <Input
                  id="education"
                  value={newUserData.education}
                  onChange={(e) => setNewUserData(prev => ({
                    ...prev,
                    education: e.target.value
                  }))}
                />
              </div>

              <div>
                <Label htmlFor="category">Status</Label>
                <Input
                  id="category"
                  value={newUserData.role === "manager" ? "Active" : newUserData.category}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <input
                  type="hidden"
                  name="category"
                  value={newUserData.role === "manager" ? "active" : newUserData.category}
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full mt-6"
            disabled={createUserMutation.isPending || !canAddUsers}
          >
            {createUserMutation.isPending ? (
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating User...
              </div>
            ) : (
              "Create User"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}