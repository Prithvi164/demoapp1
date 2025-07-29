import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Plus, Loader2, Pencil, Trash, Search, Building } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface LineOfBusiness {
  id: number;
  name: string;
  description?: string;
  organizationId: number;
}

const lineOfBusinessFormSchema = z.object({
  name: z.string().min(1, "Line of Business name is required"),
  description: z.string().optional(),
});

type LineOfBusinessFormValues = z.infer<typeof lineOfBusinessFormSchema>;

export function LineOfBusinessDetail() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLOB, setSelectedLOB] = useState<LineOfBusiness | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  // Check if user has permission to manage line of business
  const canManageLineOfBusiness = hasPermission("manage_lineofbusiness");
  
  // For owners, we want to override any permission check
  const isOwner = user?.role === 'owner';
  
  // Proper permission check - owners always have access, but all other roles 
  // (including admin) must have the specific permission
  const effectivePermission = isOwner || canManageLineOfBusiness;

  // Fetch organization with optimized caching
  const { data: organization } = useQuery({
    queryKey: ["/api/organization"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    cacheTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });

  // Fetch line of businesses with optimized caching
  const { data: lineOfBusinesses = [], isLoading: isLoadingLOB } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`],
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  });

  // Filter and pagination calculations
  const filteredLOBs = lineOfBusinesses.filter((lob: LineOfBusiness) => {
    const searchStr = searchQuery.toLowerCase();
    return (
      lob.name.toLowerCase().includes(searchStr) ||
      (lob.description || "").toLowerCase().includes(searchStr)
    );
  });

  const totalPages = Math.ceil(filteredLOBs.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedLOBs = filteredLOBs.slice(startIndex, endIndex);

  const form = useForm<LineOfBusinessFormValues>({
    resolver: zodResolver(lineOfBusinessFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const editForm = useForm<LineOfBusinessFormValues>({
    resolver: zodResolver(lineOfBusinessFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const createLOBMutation = useMutation({
    mutationFn: async (data: LineOfBusinessFormValues) => {
      if (!effectivePermission) {
        throw new Error('You do not have permission to create a line of business');
      }

      const response = await fetch(`/api/organizations/${organization?.id}/line-of-businesses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create line of business");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`] });
      toast({
        title: "Success",
        description: "Line of Business created successfully",
      });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateLOBMutation = useMutation({
    mutationFn: async (data: LineOfBusinessFormValues) => {
      if (!effectivePermission) {
        throw new Error('You do not have permission to edit a line of business');
      }

      const response = await fetch(`/api/organizations/${organization?.id}/line-of-businesses/${selectedLOB?.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update line of business");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`] });
      toast({
        title: "Success",
        description: "Line of Business updated successfully",
      });
      setIsEditDialogOpen(false);
      setSelectedLOB(null);
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

  const deleteLOBMutation = useMutation({
    mutationFn: async () => {
      if (!effectivePermission) {
        throw new Error('You do not have permission to delete a line of business');
      }

      const response = await fetch(`/api/organizations/${organization?.id}/line-of-businesses/${selectedLOB?.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete line of business");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`] });
      toast({
        title: "Success",
        description: "Line of Business deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setSelectedLOB(null);
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

  const onSubmit = async (data: LineOfBusinessFormValues) => {
    try {
      await createLOBMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error creating line of business:", error);
    }
  };

  const onEdit = async (data: LineOfBusinessFormValues) => {
    try {
      await updateLOBMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error updating line of business:", error);
    }
  };

  const handleEdit = (lob: LineOfBusiness) => {
    setSelectedLOB(lob);
    editForm.reset({
      name: lob.name,
      description: lob.description || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (lob: LineOfBusiness) => {
    setSelectedLOB(lob);
    setDeleteConfirmation("");
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedLOB) return;

    if (deleteConfirmation === selectedLOB.name) {
      deleteLOBMutation.mutate();
    } else {
      toast({
        title: "Error",
        description: "Please type the line of business name exactly as shown",
        variant: "destructive",
      });
    }
  };

  // Show loading state
  if (isLoadingLOB) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-6">
        <Building className="h-8 w-8 text-blue-500" />
        <h1 className="text-2xl font-semibold">Manage Lines of Business</h1>
      </div>

      {/* Search and Actions Section */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search lines of business..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {effectivePermission && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add New Line of Business
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Line of Business List */}
      <Card>
        <CardContent>
          {lineOfBusinesses.length > 0 ? (
            <>
              <div className="flex items-center justify-end py-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Rows per page:</span>
                  <select
                    className="p-2 border rounded bg-background"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(parseInt(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </div>
              </div>

              <div className="relative overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLOBs.map((lob: LineOfBusiness) => (
                      <TableRow key={lob.id}>
                        <TableCell className="font-medium">
                          {lob.name}
                        </TableCell>
                        <TableCell>
                          {lob.description || "-"}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {effectivePermission && (
                            <>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleEdit(lob)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDelete(lob)}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between py-4">
                <div className="text-sm text-gray-500">
                  Showing {startIndex + 1} to {Math.min(endIndex, lineOfBusinesses.length)} of {lineOfBusinesses.length}{" "}
                  entries
                </div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              No lines of business found. {effectivePermission ? "Create a new line of business to get started." : "Ask an administrator to create lines of business."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Create Line of Business Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Line of Business</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter description (optional)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  type="button"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createLOBMutation.isPending}
                >
                  {createLOBMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Line of Business Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Line of Business</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
              <div className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter description (optional)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  type="button"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                {effectivePermission ? (
                  <Button 
                    type="submit"
                    disabled={updateLOBMutation.isPending}
                  >
                    {updateLOBMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Update
                  </Button>
                ) : (
                  <Button type="button" disabled>
                    Insufficient Permissions
                  </Button>
                )}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Line of Business Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete Line of Business</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete this line of business? This action cannot be undone.
          </p>
          <p className="font-medium">
            Type <span className="text-primary">{selectedLOB?.name}</span> to confirm:
          </p>
          <Input
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder="Enter name to confirm"
          />
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            {effectivePermission ? (
              <Button 
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleteLOBMutation.isPending}
              >
                {deleteLOBMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete
              </Button>
            ) : (
              <Button variant="destructive" disabled>
                Insufficient Permissions
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}