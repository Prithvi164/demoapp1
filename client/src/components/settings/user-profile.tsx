import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  ChevronDown,
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Award, 
  Building, 
  BookOpen,
  Edit, 
  Loader2,
  BriefcaseBusiness,
  GraduationCap,
  Save,
  UsersRound as Users,
  UserCircle,
  Info
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function UserProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTab, setSelectedTab] = useState("overview");
  const [editedUser, setEditedUser] = useState({
    fullName: user?.fullName || "",
    locationId: user?.locationId || null,
    phoneNumber: user?.phoneNumber || "",
  });
  const [locationName, setLocationName] = useState<string>("Not specified");

  // Define interface for location
  interface Location {
    id: number;
    name: string;
    address: string;
    city: string;
    state: string;
    country: string;
    organizationId: number;
    createdAt: string;
  }
  
  // User interface
  interface UserDetails {
    id: number;
    username: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    locationId: number;
    role: string;
    managerId?: number;
  }

  // Fetch available locations
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/locations`],
    enabled: !!user?.organizationId
  });
  
  // Fetch manager details if the user has a manager
  const { data: managerData } = useQuery<UserDetails>({
    queryKey: [`/api/users/${user?.managerId}`],
    enabled: !!user?.managerId
  });

  // Find the location name when user or locations change
  useEffect(() => {
    if (user?.locationId && locations.length > 0) {
      const location = locations.find((loc: Location) => loc.id === user.locationId);
      if (location) {
        setLocationName(location.name);
      }
    }
  }, [user?.locationId, locations]);

  if (!user) return null;

  // Safely handle null values for fullName
  const firstName = user.fullName?.split(' ')[0] || user.username;
  const lastName = user.fullName?.split(' ').slice(1).join(' ') || '';

  // First letter capitalized for display
  const displayName = user.username.charAt(0).toUpperCase() + user.username.slice(1);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof editedUser) => {
      const res = await apiRequest("PATCH", `/api/users/${user.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get color based on user role
  const getRoleColor = (role: string) => {
    const roleColors = {
      owner: "bg-purple-100 text-purple-800",
      admin: "bg-blue-100 text-blue-800",
      manager: "bg-green-100 text-green-800", 
      team_lead: "bg-yellow-100 text-yellow-800",
      quality_analyst: "bg-cyan-100 text-cyan-800",
      trainer: "bg-indigo-100 text-indigo-800",
      advisor: "bg-orange-100 text-orange-800",
      trainee: "bg-gray-100 text-gray-800"
    };
    
    return roleColors[role as keyof typeof roleColors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <Tabs 
        value={selectedTab} 
        onValueChange={setSelectedTab}
        className="w-full space-y-6"
      >
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="overview" className="flex-1 md:flex-none">Overview</TabsTrigger>
          <TabsTrigger value="activity" className="flex-1 md:flex-none">Activity</TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="md:col-span-1 border-t-4 border-t-primary">
            <CardHeader className="bg-gradient-to-r from-muted/50 to-background pb-2">
              <div className="flex justify-center -mt-12">
                <Avatar className="h-24 w-24 ring-4 ring-background">
                  <AvatarFallback className="text-2xl bg-gradient-to-br from-primary/80 to-primary/50 text-primary-foreground">
                    {displayName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="text-center mt-3">
                <CardTitle className="text-xl font-bold">{displayName}</CardTitle>
                <CardDescription className="flex justify-center items-center gap-1 mt-1">
                  <Mail className="h-3 w-3" /> {user.email}
                </CardDescription>
                <div className="flex justify-center mt-3">
                  <Badge className={cn("text-xs px-2 py-1 rounded-full", getRoleColor(user.role))}>
                    {user.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Full Name</p>
                    <p className="font-medium">{user.fullName || user.username}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{editedUser.phoneNumber || 'Not specified'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{locationName}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Award className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Experience Level</p>
                    <p className="font-medium">{user.role === 'trainee' ? 'Entry Level' : 'Professional'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <BriefcaseBusiness className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Employee ID</p>
                    <p className="font-medium">{user.employeeId || 'Not assigned'}</p>
                  </div>
                </div>
                
                {user.dateOfJoining && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date Joined</p>
                      <p className="font-medium">{new Date(user.dateOfJoining).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-center border-t bg-muted/20 p-3">
              <Button 
                variant="outline" 
                size="sm"
                className="w-full"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit className="h-4 w-4 mr-2" />
                {isEditing ? "Cancel Editing" : "Edit Profile"}
              </Button>
            </CardFooter>
          </Card>

          {/* Main Content Area */}
          <div className="md:col-span-2 space-y-6">
            <TabsContent value="overview" className="m-0 space-y-6">
              {/* Personal Information Card */}
              <Card className="border-t-4 border-t-primary/70 shadow-md">
                <CardHeader className="pb-2 bg-gradient-to-r from-muted/50 to-background">
                  <CardTitle className="flex justify-between items-center">
                    <div className="flex items-center">
                      <User className="h-5 w-5 mr-2 text-primary" />
                      <span>Personal Information</span>
                    </div>
                    {isEditing ? (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        Editing
                      </Badge>
                    ) : null}
                  </CardTitle>
                  <CardDescription>
                    Your personal details and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {isEditing ? (
                    <form
                      className="space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        updateProfileMutation.mutate(editedUser);
                      }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="fullName">Full Name</Label>
                          <div className="relative">
                            <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="fullName"
                              className="pl-9"
                              value={editedUser.fullName}
                              onChange={(e) => setEditedUser(prev => ({
                                ...prev,
                                fullName: e.target.value
                              }))}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email Address</Label>
                          <div className="relative">
                            <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="email"
                              className="pl-9 bg-muted"
                              value={user.email}
                              disabled
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="location">Location</Label>
                          <Select
                            value={editedUser.locationId?.toString() || ""}
                            onValueChange={(value) => {
                              setEditedUser(prev => ({
                                ...prev,
                                locationId: value ? parseInt(value) : null
                              }));
                              
                              // Update location name for immediate display
                              const selectedLocation = locations.find((loc: Location) => loc.id.toString() === value);
                              if (selectedLocation) {
                                setLocationName(selectedLocation.name);
                              } else {
                                setLocationName("Not specified");
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <div className="flex items-center">
                                <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Select a location" />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map((location: Location) => (
                                <SelectItem key={location.id} value={location.id.toString()}>
                                  {location.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phoneNumber">Phone Number</Label>
                          <div className="relative">
                            <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="phoneNumber"
                              className="pl-9"
                              value={editedUser.phoneNumber}
                              onChange={(e) => setEditedUser(prev => ({
                                ...prev,
                                phoneNumber: e.target.value
                              }))}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsEditing(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={updateProfileMutation.isPending}
                          className="gap-1.5"
                        >
                          {updateProfileMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Save className="h-4 w-4 mr-1" />
                          )}
                          Save Changes
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">First Name</Label>
                        <p className="font-medium">{firstName}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Last Name</Label>
                        <p className="font-medium">{lastName || '-'}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Email Address</Label>
                        <p className="font-medium text-primary">{user.email}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Role</Label>
                        <Badge className={cn("rounded-md px-2 py-1", getRoleColor(user.role))}>
                          {user.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Location</Label>
                        <p className="font-medium">{locationName}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Phone Number</Label>
                        <p className="font-medium">{editedUser.phoneNumber || 'Not specified'}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Skills & Education Card */}
              <Card className="border-t-4 border-t-primary/70 shadow-md">
                <CardHeader className="pb-2 bg-gradient-to-r from-muted/50 to-background">
                  <CardTitle className="flex items-center">
                    <GraduationCap className="h-5 w-5 mr-2 text-primary" />
                    <span>Skills & Education</span>
                  </CardTitle>
                  <CardDescription>
                    Your qualifications and professional skills
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-6">
                    {/* Personal Details Section */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Personal Information</h3>
                      <div className="space-y-4">
                        {user.dateOfBirth && (
                          <div className="bg-muted/30 rounded-lg p-3">
                            <div className="flex flex-col">
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 text-primary mr-2" />
                                <h4 className="font-medium">Date of Birth</h4>
                              </div>
                              <p className="text-sm mt-1">
                                {new Date(user.dateOfBirth).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {user.dateOfJoining && (
                          <div className="bg-muted/30 rounded-lg p-3">
                            <div className="flex flex-col">
                              <div className="flex items-center">
                                <BriefcaseBusiness className="h-4 w-4 text-primary mr-2" />
                                <h4 className="font-medium">Date of Joining</h4>
                              </div>
                              <p className="text-sm mt-1">
                                {new Date(user.dateOfJoining).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Education Section */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Education</h3>
                      <div className="space-y-4">
                        <div className="bg-muted/30 rounded-lg p-3">
                          <div className="flex items-center mb-1">
                            <GraduationCap className="h-4 w-4 text-primary mr-2" />
                            <h4 className="font-medium">Qualification</h4>
                          </div>
                          <p className="text-sm">
                            {user.education || 'Education details not provided'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            

            
            <TabsContent value="activity" className="m-0 space-y-6">
              <Card className="border-t-4 border-t-primary/70 shadow-md">
                <CardHeader className="pb-2 bg-gradient-to-r from-muted/50 to-background">
                  <CardTitle className="flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-primary" />
                    <span>Activity Timeline</span>
                  </CardTitle>
                  <CardDescription>
                    Your recent activity history
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-6">
                    {/* Account creation is the only real data point we have */}
                    <div className="relative pl-5 pb-0">
                      <div className="absolute top-0 left-[-7px] h-3 w-3 rounded-full bg-primary"></div>
                      <h4 className="text-sm font-medium">Account created</h4>
                      <p className="text-xs text-muted-foreground">
                        {user.createdAt 
                          ? new Date(user.createdAt).toLocaleDateString() 
                          : 'Date not available'}
                      </p>
                    </div>
                    <div className="text-center text-sm text-muted-foreground pt-4">
                      <Info className="h-4 w-4 inline-block mr-2" />
                      Activity history will be shown here when available
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}