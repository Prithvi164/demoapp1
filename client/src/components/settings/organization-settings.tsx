import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO, isValid } from "date-fns";
import { usePermissions } from "@/hooks/use-permissions";

// UI Components
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  AlertCircle, 
  CalendarIcon, 
  Trash2, 
  Settings, 
  BookOpen, 
  BarChart, 
  AppWindow,
  Calendar as CalendarIcon2,
  Loader2,
  Save,
  Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";

// Define types
type OrganizationSettings = {
  id?: number;
  organizationId: number;
  featureType: 'LMS' | 'QMS' | 'BOTH';
  weeklyOffDays: string[];
  userLimit: number;
  createdAt?: string;
  updatedAt?: string;
};

type Location = {
  id: number;
  name: string;
};

type Holiday = {
  id: number;
  name: string;
  date: string;
  organizationId: number;
  locationId: number | null;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
};

// Form schemas
const holidaySchema = z.object({
  name: z.string().min(2, "Holiday name must be at least 2 characters"),
  date: z.string().refine(val => isValid(parseISO(val)), {
    message: "Please select a valid date"
  }),
  locationId: z.union([
    z.string().transform(val => {
      if (val === "all-locations" || val === "") return null;
      return parseInt(val);
    }),
    z.literal(null)
  ]).nullable(),
  isRecurring: z.boolean().default(false)
});

const featureTypeSchema = z.object({
  featureType: z.enum(['LMS', 'QMS', 'BOTH'])
});

const userLimitSchema = z.object({
  userLimit: z.number()
    .min(1, "User limit must be at least 1")
    .transform(val => parseInt(val.toString(), 10))
});

type HolidayForm = z.infer<typeof holidaySchema>;
type FeatureTypeForm = z.infer<typeof featureTypeSchema>;
type UserLimitForm = z.infer<typeof userLimitSchema>;

export default function OrganizationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [isAddHolidayOpen, setIsAddHolidayOpen] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null);
  
  // Check permissions with new specific permission structure
  const canManageHolidays = hasPermission("manage_holidaylist");
  const canViewHolidays = hasPermission("view_organization") || canManageHolidays;
  const canManageUserLimit = hasPermission("manage_organization") || user?.role === 'owner';

  // Holiday form setup
  const holidayForm = useForm<HolidayForm>({
    resolver: zodResolver(holidaySchema),
    defaultValues: {
      name: "",
      date: "",
      locationId: null as unknown as number, // this will be transformed by the schema
      isRecurring: false
    }
  });
  
  // Feature type form setup
  const featureTypeForm = useForm<FeatureTypeForm>({
    resolver: zodResolver(featureTypeSchema),
    defaultValues: {
      featureType: 'BOTH'
    }
  });
  
  // User limit form setup
  const userLimitForm = useForm<UserLimitForm>({
    resolver: zodResolver(userLimitSchema),
    defaultValues: {
      userLimit: 500
    }
  });

  // Define type for API responses
  type SettingsResponse = {
    featureType: 'LMS' | 'QMS' | 'BOTH';
    weeklyOffDays: string[];
    userLimit?: number;
    locations?: Location[];
  };

  type LocationsResponse = Location[];
  
  type HolidaysResponse = Holiday[];

  // Query organization settings
  const {
    data: settings = {} as SettingsResponse,
    isLoading: isLoadingSettings,
    error: settingsError
  } = useQuery<SettingsResponse>({
    queryKey: [`/api/organizations/${user?.organizationId}/settings`],
    enabled: !!user?.organizationId
  });

  // Query organization locations
  const {
    data: locations = [] as LocationsResponse,
    isLoading: isLoadingLocations
  } = useQuery<LocationsResponse>({
    queryKey: ['/api/organizations', user?.organizationId, 'locations'],
    enabled: !!user?.organizationId
  });

  // Query organization holidays
  const {
    data: holidays = [] as HolidaysResponse,
    isLoading: isLoadingHolidays
  } = useQuery<HolidaysResponse>({
    queryKey: [`/api/organizations/${user?.organizationId}/holidays`],
    enabled: !!user?.organizationId
  });

  // Update settings form when data is loaded
  useEffect(() => {
    if (settings?.featureType) {
      featureTypeForm.setValue('featureType', settings.featureType);
    }
    if (settings?.userLimit) {
      userLimitForm.setValue('userLimit', settings.userLimit);
    }
  }, [settings, featureTypeForm, userLimitForm]);
  
  // Update feature type mutation
  const updateFeatureTypeMutation = useMutation({
    mutationFn: async (data: FeatureTypeForm) => {
      return apiRequest(
        "PATCH",
        `/api/organizations/${user?.organizationId}/settings`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/settings`] });
      toast({
        title: "Settings updated",
        description: "The feature type has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating settings",
        description: error.message || "An error occurred while updating settings. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Create holiday mutation
  const createHolidayMutation = useMutation({
    mutationFn: async (data: HolidayForm) => {
      return apiRequest(
        "POST",
        `/api/organizations/${user?.organizationId}/holidays`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/holidays`] });
      holidayForm.reset();
      setIsAddHolidayOpen(false);
      toast({
        title: "Holiday added",
        description: "The holiday has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding holiday",
        description: error.message || "An error occurred while adding the holiday. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Delete holiday mutation
  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(
        "DELETE",
        `/api/organizations/${user?.organizationId}/holidays/${id}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/holidays`] });
      setHolidayToDelete(null);
      toast({
        title: "Holiday deleted",
        description: "The holiday has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting holiday",
        description: error.message || "An error occurred while deleting the holiday. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Update user limit mutation
  const updateUserLimitMutation = useMutation({
    mutationFn: async (data: UserLimitForm) => {
      // Log the exact data being sent for debugging
      console.log("Sending user limit update:", {
        type: "userLimit",
        value: data.userLimit
      });
      
      try {
        const response = await apiRequest(
          "PATCH",
          `/api/organizations/${user?.organizationId}/settings`,
          {
            type: "userLimit", // This must match exactly what the server expects in the switch statement
            value: data.userLimit
          }
        );
        console.log("User limit update response:", response);
        return response;
      } catch (error) {
        console.error("User limit update failed:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/settings`] });
      toast({
        title: "User limit updated",
        description: "The organization user limit has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Error in user limit mutation:", error);
      toast({
        title: "Error updating user limit",
        description: error.message || "An error occurred while updating user limit. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Form submission handlers
  
  const onFeatureTypeSubmit = (data: FeatureTypeForm) => {
    updateFeatureTypeMutation.mutate(data);
  };

  const onHolidaySubmit = (data: HolidayForm) => {
    createHolidayMutation.mutate(data);
  };
  
  const onUserLimitSubmit = (data: UserLimitForm) => {
    updateUserLimitMutation.mutate(data);
  };

  const handleDeleteHoliday = (holiday: Holiday) => {
    setHolidayToDelete(holiday);
  };

  const confirmDeleteHoliday = () => {
    if (holidayToDelete) {
      deleteHolidayMutation.mutate(holidayToDelete.id);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-muted-foreground">
            Configure your organization's appearance and scheduling preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <Card className="w-full shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-t-lg border-b">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/15 rounded-full">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">User Limit</CardTitle>
                <CardDescription>
                  Configure maximum number of users for your organization
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoadingSettings ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-6">
                {canManageUserLimit ? (
                  <Form {...userLimitForm}>
                    <form onSubmit={userLimitForm.handleSubmit(onUserLimitSubmit)} className="space-y-4">
                      <FormField
                        control={userLimitForm.control}
                        name="userLimit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Maximum Users</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="500" 
                                min={1} 
                                {...field} 
                                onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                              />
                            </FormControl>
                            <FormDescription>
                              The maximum number of users allowed in your organization.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="gap-1.5"
                        disabled={updateUserLimitMutation.isPending}
                      >
                        {updateUserLimitMutation.isPending && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        <Save className="h-4 w-4" />
                        Save User Limit
                      </Button>
                    </form>
                  </Form>
                ) : (
                  <div className="p-4 bg-card border rounded-md">
                    <div className="flex items-start space-x-3">
                      <Users className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-medium">Maximum Users: {settings.userLimit || 500}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Your organization is limited to {settings.userLimit || 500} users. Contact an administrator to change this limit.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start space-x-2.5 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
                  <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      You will not be able to add more users once you reach your limit. Your current limit is {settings.userLimit || 500} users.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="w-full shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-t-lg border-b">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/15 rounded-full">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Activated Features</CardTitle>
                <CardDescription>
                  Your current subscription features
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoadingSettings ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center p-6 border rounded-xl bg-card shadow-sm hover:shadow transition-shadow duration-200">
                  <div className="flex-shrink-0 mr-5 bg-primary/10 p-4 rounded-full">
                    {settings?.featureType === 'LMS' ? (
                      <BookOpen className="h-8 w-8 text-blue-500" />
                    ) : settings?.featureType === 'QMS' ? (
                      <BarChart className="h-8 w-8 text-green-500" />
                    ) : (
                      <AppWindow className="h-8 w-8 text-purple-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">
                      {settings?.featureType === 'LMS' ? 'Learning Management System' : 
                        settings?.featureType === 'QMS' ? 'Quality Management System' : 
                        'Complete Platform (LMS + QMS)'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      {settings?.featureType === 'LMS' ? 
                        'Access to trainee management, course materials, batch monitoring, and learning resources.' : 
                        settings?.featureType === 'QMS' ? 
                        'Access to quality evaluation, performance metrics, mock call scenarios, and evaluation templates.' : 
                        'Full access to both Learning Management and Quality Management features.'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-2.5 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
                  <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      Feature access is controlled by your subscription plan. To change your active features, please contact our customer support.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="w-full shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-t-lg border-b">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/15 rounded-full">
                <CalendarIcon2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Holiday Management</CardTitle>
                <CardDescription>
                  Configure holidays and non-working days
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-muted-foreground">
                Holidays are excluded when calculating training phase durations.
              </p>
              {canManageHolidays && (
                <Dialog open={isAddHolidayOpen} onOpenChange={setIsAddHolidayOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-1.5">
                      <CalendarIcon className="h-4 w-4" />
                      Add Holiday
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add New Holiday</DialogTitle>
                      <DialogDescription>
                        Add a new holiday to your organization's calendar.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...holidayForm}>
                      <form onSubmit={holidayForm.handleSubmit(onHolidaySubmit)} className="space-y-4">
                        <FormField
                          control={holidayForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Holiday Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Christmas, New Year" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={holidayForm.control}
                          name="date"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={`w-full pl-3 text-left font-normal ${
                                        !field.value ? "text-muted-foreground" : ""
                                      }`}
                                    >
                                      {field.value ? (
                                        format(new Date(field.value), "PPP")
                                      ) : (
                                        <span>Pick a date</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value ? new Date(field.value) : undefined}
                                    onSelect={(date) => {
                                      field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                                    }}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={holidayForm.control}
                          name="locationId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Location (Optional)</FormLabel>
                              <Select 
                                value={field.value?.toString() || ""} 
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a location" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="all-locations">All Locations</SelectItem>
                                  {locations?.map((location: Location) => (
                                    <SelectItem key={location.id} value={location.id.toString()}>
                                      {location.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                If no location is selected, this holiday applies to all locations.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={holidayForm.control}
                          name="isRecurring"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Recurring yearly</FormLabel>
                                <FormDescription>
                                  If checked, this holiday will be observed every year on the same date.
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="submit" disabled={createHolidayMutation.isPending}>
                            {createHolidayMutation.isPending ? "Adding..." : "Add Holiday"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {isLoadingHolidays ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : holidays?.length === 0 ? (
              <div className="text-center py-8 space-y-2 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20">
                <CalendarIcon2 className="h-12 w-12 mx-auto mb-2 text-muted-foreground/60" />
                <p className="font-medium text-muted-foreground">No holidays have been added yet</p>
                <p className="text-sm text-muted-foreground/70">Click the "Add Holiday" button to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {holidays?.map((holiday: Holiday) => (
                  <div 
                    key={holiday.id} 
                    className="flex items-center justify-between gap-4 p-4 border rounded-lg hover:shadow-sm transition-all duration-200 bg-card hover:bg-card/80"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 p-2.5 rounded-full">
                        <CalendarIcon2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-base">{holiday.name}</h4>
                          {holiday.isRecurring && (
                            <Badge variant="secondary" className="font-medium bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                              Yearly
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {format(new Date(holiday.date), "PPP")}
                        </p>
                        {holiday.locationId && locations?.find((l: Location) => l.id === holiday.locationId) && (
                          <Badge variant="outline" className="mt-2 px-2 py-0.5 font-normal">
                            {locations.find((l: Location) => l.id === holiday.locationId)?.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {canManageHolidays && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                            onClick={() => handleDeleteHoliday(holiday)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-xl font-semibold flex items-center gap-2">
                              <Trash2 className="h-5 w-5 text-destructive" />
                              Delete Holiday
                            </AlertDialogTitle>
                            <AlertDialogDescription className="pt-2">
                              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                                <p className="font-medium text-base mb-1">{holidayToDelete?.name}</p>
                                {holidayToDelete?.date && (
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(holidayToDelete.date), "PPP")}
                                  </p>
                                )}
                                {holidayToDelete?.isRecurring && (
                                  <Badge variant="outline" className="mt-2 font-medium bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                    Yearly Holiday
                                  </Badge>
                                )}
                              </div>
                              <p>Are you sure you want to delete this holiday? This action cannot be undone and will affect scheduling calculations.</p>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel 
                              onClick={() => setHolidayToDelete(null)}
                              className="mt-0"
                            >
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={confirmDeleteHoliday}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 mt-0"
                            >
                              {deleteHolidayMutation.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                <>Delete Holiday</>
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}