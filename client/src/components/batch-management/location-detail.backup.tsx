import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  MapPin,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {Select as RadixSelect, SelectContent as RadixSelectContent, SelectGroup as RadixSelectGroup, SelectItem as RadixSelectItem, SelectLabel as RadixSelectLabel, SelectTrigger as RadixSelectTrigger, SelectValue as RadixSelectValue} from '@radix-ui/react-select'
import { Tour, type TourStep } from "@/components/ui/tour";

// Form validation schema
const locationFormSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required"),
});

export function LocationDetail() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // Default to 10 items per page
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  const [showTour, setShowTour] = useState(() => {
    const hasSeenTour = localStorage.getItem("locationManagementTourComplete");
    return !hasSeenTour;
  });

  // First fetch organization
  const { data: organization } = useQuery({
    queryKey: ["/api/organization"],
    enabled: !!user,
  });

  // Then fetch organization settings which includes locations
  const { data: orgSettings, isLoading } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/settings`],
    queryFn: async () => {
      if (!organization?.id) return null;
      const res = await fetch(
        `/api/organizations/${organization.id}/settings`
      );
      if (!res.ok) throw new Error("Failed to fetch organization settings");
      return res.json();
    },
    enabled: !!organization?.id,
  });

  const form = useForm<z.infer<typeof locationFormSchema>>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      state: "",
      country: "",
    },
  });

  const editForm = useForm<z.infer<typeof locationFormSchema>>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: selectedLocation || {
      name: "",
      address: "",
      city: "",
      state: "",
      country: "",
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof locationFormSchema>) => {
      if (!canManageLocations) {
        throw new Error('You do not have permission to create locations');
      }

      try {
        const requestBody = {
          type: 'locations',
          operation: 'create',
          value: {
            name: data.name,
            address: data.address,
            city: data.city,
            state: data.state,
            country: data.country,
            organizationId: organization?.id
          }
        };

        const response = await fetch(`/api/organizations/${organization?.id}/settings`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (errorData.message?.includes('unique constraint')) {
            throw new Error('A location with this name already exists');
          }
          throw new Error(errorData.message || 'Failed to create location');
        }

        return response.json();
      } catch (error) {
        console.error('Location creation error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      onCreateSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editLocationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof locationFormSchema>) => {
      if (!canManageLocations) {
        throw new Error('You do not have permission to edit locations');
      }

      try {
        const response = await fetch(
          `/api/organizations/${organization?.id}/settings/locations/${selectedLocation.id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: data.name,
              address: data.address,
              city: data.city,
              state: data.state,
              country: data.country
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update location');
        }

        return response.json();
      } catch (error) {
        console.error('Location update error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/settings`] });
      toast({
        title: "Success",
        description: "Location updated successfully",
      });
      setIsEditDialogOpen(false);
      setSelectedLocation(null);
      editForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async () => {
      if (!canManageLocations) {
        throw new Error('You do not have permission to delete locations');
      }

      try {
        const response = await fetch(
          `/api/organizations/${organization?.id}/settings/locations/${selectedLocation.id}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to delete location');
        }

        return { success: true };
      } catch (error) {
        console.error('Location deletion error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/settings`] });
      toast({
        title: "Success",
        description: "Location deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setSelectedLocation(null);
      setDeleteConfirmation("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: z.infer<typeof locationFormSchema>) => {
    try {
      await createLocationMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error creating location:", error);
    }
  };

  const onEdit = async (data: z.infer<typeof locationFormSchema>) => {
    try {
      await editLocationMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error updating location:", error);
    }
  };

  const handleEdit = (location: any) => {
    setSelectedLocation(location);
    editForm.reset(location);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (location: any) => {
    setSelectedLocation(location);
    setIsDeleteDialogOpen(true);
      state: "explaining",
      message: `Please be careful when deleting ${location.name}. This action cannot be undone!`,
    });
  };

  const confirmDelete = () => {
    const expectedConfirmation = `delete-${selectedLocation.name.toLowerCase()}`;
    if (deleteConfirmation.toLowerCase() === expectedConfirmation) {
      deleteLocationMutation.mutate();
    } else {
      toast({
        title: "Error",
        description: "Please type the correct confirmation text",
        variant: "destructive",
      });
    }
  };



  const onCreateSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: [`/api/organizations/${organization?.id}/settings`],
    });
    toast({
      title: "Success",
      description: "Location created successfully",
    });
    setIsCreateDialogOpen(false);
    form.reset();
      state: "celebrating",
      message: "Great job! The new location has been added successfully! 🎉",
    });
  };

  const locations = orgSettings?.locations || [];

  // Filter locations based on search term
  const filteredLocations = locations?.filter((location: any) =>
    Object.values(location).some((value: any) =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) || [];

  // Calculate pagination with dynamic page size
  const totalPages = Math.ceil(filteredLocations.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLocations = filteredLocations.slice(
    startIndex,
    startIndex + pageSize
  );

  // Handle page size change
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
      state: "explaining",
      message: `Showing ${newSize} locations per page`,
    });
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
      state: "pointing",
      message: `Showing page ${newPage} of ${totalPages}`,
    });
  };

  const tourSteps: TourStep[] = [
    {
      target: '[data-tour="search"]',
      title: "Search Locations",
      content:
        "Quickly find locations by searching across names, addresses, cities, and more.",
      position: "bottom",
    },
    {
      target: '[data-tour="add-location"]',
      title: "Add New Locations",
      content:
        "Click here to add a new location to your organization.",
      position: "left",
    },
    {
      target: '[data-tour="page-size"]',
      title: "Adjust View",
      content:
        "Choose how many locations to display per page (10, 50, or 100 records).",
      position: "top",
    },
    {
      target: '[data-tour="location-actions"]',
      title: "Manage Locations",
      content: "Edit or delete locations using these action buttons.",
      position: "left",
    },
  ];

  const handleTourComplete = () => {
    localStorage.setItem("locationManagementTourComplete", "true");
    setShowTour(false);
      state: "celebrating",
      message:
        "Great! Now you know how to manage locations. Let me know if you need any help!",
    });
  };

  const handleTourSkip = () => {
    localStorage.setItem("locationManagementTourComplete", "true");
    setShowTour(false);
      state: "idle",
      message: "You can always ask me if you need any help with anything!",
    });
  };

  // Check if user has permission to manage locations
  const canManageLocations = hasPermission("manage_locations");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex justify-between items-center mb-6">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-40" />
            </div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex space-x-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-none shadow-lg">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-purple-500" />
              <h2 className="text-lg font-semibold">Manage Locations</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  data-tour="search"
                  placeholder="Search locations..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                    if (e.target.value) {
                        state: "explaining",
                        message: `Searching for locations containing "${e.target.value}"`,
                      });
                    }
                  }}
                  className="pl-9 w-[250px] focus:border-purple-500"
                />
              </div>
              {canManageLocations && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        data-tour="add-location"
                        onClick={() => {
                          setIsCreateDialogOpen(true);
                            state: "pointing",
                            message:
                              "Let's add a new location! I'll help you fill out the details.",
                          });
                        }}
                        className="bg-purple-600 hover:bg-purple-700 transition-colors"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Location
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Add a new location to your organization
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {filteredLocations.length > 0 ? (
            <>
              <div className="relative overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">
                        Location Name
                      </TableHead>
                      <TableHead className="font-semibold">Address</TableHead>
                      <TableHead className="font-semibold">City</TableHead>
                      <TableHead className="font-semibold">State</TableHead>
                      <TableHead className="font-semibold">Country</TableHead>
                      <TableHead className="font-semibold text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLocations.map((location: any) => (
                      <TableRow
                        key={location.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="font-medium">
                          {location.name}
                        </TableCell>
                        <TableCell>{location.address}</TableCell>
                        <TableCell>{location.city}</TableCell>
                        <TableCell>{location.state}</TableCell>
                        <TableCell>{location.country}</TableCell>
                        <TableCell>
                          {canManageLocations && (
                            <div
                              data-tour="location-actions"
                              className="flex justify-end space-x-2"
                            >
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEdit(location)}
                                      className="hover:bg-purple-50"
                                    >
                                      <Pencil
                                        className="h-4 w-4 text-purple-600"
                                      />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit location</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleDelete(location)}
                                      className="hover:bg-red-600"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Delete location
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 px-4">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                      Showing{" "}
                      {startIndex + 1}{" "}
                      to{" "}
                      {Math.min(
                        startIndex + pageSize,
                        filteredLocations.length
                      )}{" "}
                      of {filteredLocations.length} locations
                    </div>
                    <Select
                      data-tour="page-size"
                      value={pageSize.toString()}
                      onValueChange={(value) =>
                        handlePageSizeChange(parseInt(value))
                      }
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue placeholder="Select page size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Page Size</SelectLabel>
                          <SelectItem value="10">10 per page</SelectItem>
                          <SelectItem value="50">50 per page</SelectItem>
                          <SelectItem value="100">100 per page</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(page)}
                          className={currentPage === page ? "bg-purple-600" : ""}
                        >
                          {page}
                        </Button>
                      )
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : searchTerm ? (
            <div className="text-center py-8 bg-muted/10 rounded-lg border-2 border-dashed">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">
                No locations found matching "{searchTerm}"
              </p>
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/10 rounded-lg border-2 border-dashed">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">
                No locations found. Add your first location to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Location Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl mb-6">Add Location</DialogTitle>
            <DialogDescription>
              Fill in the details below to add a new location to your
              organization.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground">
                          LOCATION NAME
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter location name"
                            {...field}
                            className="transition-colors focus:border-purple-500"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground">
                          ADDRESS
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter complete address"
                            {...field}
                            className="transition-colors focus:border-purple-500"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-foreground">
                            CITY
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter city name"
                              {...field}
                              className="transition-colors focus:border-purple-500"
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-foreground">
                            STATE
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter state name"
                              {...field}
                              className="transition-colors focus:border-purple-500"
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-foreground">
                            COUNTRY
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter country name"
                              {...field}
                              className="transition-colors focus:border-purple-500"
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                      state: "idle",
                      message: "Need help with anything else?",
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 transition-colors min-w-[100px]"
                  disabled={createLocationMutation.isPending}
                >
                  {createLocationMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Location Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl mb-6">Edit Location</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-6">
              <Card>
                <CardContent className="space-y-4">
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LOCATION NAME</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter location name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ADDRESS</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter address"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={editForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CITY</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter city" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>STATE</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter state" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>COUNTRY</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter country"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={editLocationMutation.isPending}
                >
                  {editLocationMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl mb-6">
              Delete Location
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this location? This action cannot
              be undone. To confirm, type "delete-{selectedLocation?.name.toLowerCase()}"
              below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Type confirmation text here"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeleteConfirmation("");
                  state: "idle",
                  message: "Need help with anything else?",
                });
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteLocationMutation.isPending}
            >
              {deleteLocationMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Location"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showTour && (
        <Tour
          steps={tourSteps}
          onComplete={handleTourComplete}
          onSkip={handleTourSkip}
        />
      )}
    </div>
  );
}