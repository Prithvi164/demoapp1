import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { SiReact } from "react-icons/si";

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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Loader2, 
  Edit, 
  Trash2, 
  Search, 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger, 
  TooltipProvider 
} from "@/components/ui/tooltip";

const lobFormSchema = z.object({
  name: z.string().min(1, "LOB name is required"),
  description: z.string().min(1, "Description is required"),
});

const deleteConfirmationSchema = z.object({
  confirmText: z.string()
});

export function LobDetail() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLob, setSelectedLob] = useState<any>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  
  // Check if user has permission to manage line of business
  const canManageLineOfBusiness = hasPermission("manage_lineofbusiness");
  
  // For owners, we want to override any permission check
  const isOwner = user?.role === 'owner';
  
  // Proper permission check - owners always have access, but all other roles 
  // (including admin) must have the specific permission
  const effectivePermission = isOwner || canManageLineOfBusiness;
  
  // Debug logging for permission status
  console.log('LOB Detail Component - Permission Check:', {
    role: user?.role,
    hasManageLineOfBusinessPermission: canManageLineOfBusiness,
    isOwner,
    effectivePermission
  });

  // First fetch organization
  const { data: organization } = useQuery({
    queryKey: ["/api/organization"],
    enabled: !!user,
  });

  // Then fetch organization line of businesses
  const { data: lobs, isLoading } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`],
    queryFn: async () => {
      if (!organization?.id) return null;
      const res = await fetch(`/api/organizations/${organization.id}/line-of-businesses`);
      if (!res.ok) throw new Error('Failed to fetch line of businesses');
      return res.json();
    },
    enabled: !!organization?.id,
  });

  const form = useForm<z.infer<typeof lobFormSchema>>({
    resolver: zodResolver(lobFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const editForm = useForm<z.infer<typeof lobFormSchema>>({
    resolver: zodResolver(lobFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const deleteForm = useForm<z.infer<typeof deleteConfirmationSchema>>({
    resolver: zodResolver(deleteConfirmationSchema),
    defaultValues: {
      confirmText: "",
    },
  });

  // Filter and pagination calculations
  const filteredLobs = lobs?.filter((lob: any) => {
    const searchStr = searchQuery.toLowerCase();
    return (
      lob.name.toLowerCase().includes(searchStr) ||
      lob.description.toLowerCase().includes(searchStr)
    );
  }) || [];

  const totalPages = Math.ceil(filteredLobs.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedLobs = filteredLobs.slice(startIndex, endIndex);

  const createLobMutation = useMutation({
    mutationFn: async (data: z.infer<typeof lobFormSchema>) => {
      if (!effectivePermission) {
        throw new Error('You do not have permission to create a line of business');
      }
      
      const response = await fetch(`/api/organizations/${organization?.id}/line-of-businesses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create LOB');
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

  const updateLobMutation = useMutation({
    mutationFn: async (data: z.infer<typeof lobFormSchema>) => {
      if (!effectivePermission) {
        throw new Error('You do not have permission to update a line of business');
      }
      
      const response = await fetch(`/api/organizations/${organization?.id}/line-of-businesses/${selectedLob.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update LOB');
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
      setSelectedLob(null);
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

  const deleteLobMutation = useMutation({
    mutationFn: async () => {
      if (!effectivePermission) {
        throw new Error('You do not have permission to delete a line of business');
      }
      
      const response = await fetch(`/api/organizations/${organization?.id}/line-of-businesses/${selectedLob.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete LOB');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`] });
      toast({
        title: "Success",
        description: "Line of Business deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setSelectedLob(null);
      setDeleteConfirmationText("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: z.infer<typeof lobFormSchema>) => {
    try {
      await createLobMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error creating LOB:", error);
    }
  };

  const onEdit = async (data: z.infer<typeof lobFormSchema>) => {
    try {
      await updateLobMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error updating LOB:", error);
    }
  };

  const handleEdit = (lob: any) => {
    setSelectedLob(lob);
    editForm.reset({
      name: lob.name,
      description: lob.description,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (lob: any) => {
    setSelectedLob(lob);
    setDeleteConfirmationText(`delete-${lob.name}`);
    setIsDeleteDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-none shadow-lg">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <SiReact className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold">Manage Line of Business</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search LOBs..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset to first page on search
                  }}
                  className="pl-9 w-[250px] focus:border-purple-500"
                />
              </div>
              {effectivePermission && (
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New LOB
                </Button>
              )}
            </div>
          </div>

          {filteredLobs.length > 0 ? (
            <>
              <div className="relative overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">LOB Name</TableHead>
                      <TableHead className="font-semibold">Description</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLobs.map((lob: any) => (
                      <TableRow 
                        key={lob.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="font-medium">{lob.name}</TableCell>
                        <TableCell>{lob.description}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            {effectivePermission && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(lob)}
                                  className="h-7 w-7 p-0 text-blue-600"
                                >
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit LOB</span>
                                </Button>
                                
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(lob)}
                                        className="h-7 w-7 p-0 text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Delete LOB</span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p>Delete Line of Business</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </>
                            )}
                          </div>
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
                      {Math.min(endIndex, filteredLobs.length)}{" "}
                      of {filteredLobs.length} LOBs
                    </div>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(parseInt(value));
                        setCurrentPage(1);
                      }}
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
                      onClick={() => setCurrentPage(currentPage - 1)}
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
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      )
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : searchQuery ? (
            <div className="text-center py-8 bg-muted/10 rounded-lg border-2 border-dashed">
              <SiReact className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">
                No Line of Business found matching "{searchQuery}"
              </p>
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/10 rounded-lg border-2 border-dashed">
              <SiReact className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">
                No Line of Business found. Add your first LOB to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create LOB Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl mb-6">Create Line of Business</DialogTitle>
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
                        <FormLabel className="text-sm font-semibold text-foreground">LOB NAME</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter LOB name" 
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
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground">DESCRIPTION</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter LOB description" 
                            {...field} 
                            className="transition-colors focus:border-purple-500"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createLobMutation.isPending}
                >
                  {createLobMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add LOB
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit LOB Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl mb-6">Edit Line of Business</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-6">
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground">LOB NAME</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter LOB name" 
                            {...field} 
                            className="transition-colors focus:border-purple-500"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground">DESCRIPTION</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter LOB description" 
                            {...field} 
                            className="transition-colors focus:border-purple-500"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateLobMutation.isPending}
                >
                  {updateLobMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update LOB
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
            <DialogTitle>Delete Line of Business</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. Please type{" "}
              <span className="font-mono text-primary">{deleteConfirmationText}</span> to confirm.
            </p>
            <Input
              className="font-mono"
              placeholder="Type delete confirmation"
              value={deleteForm.watch("confirmText")}
              onChange={(e) => deleteForm.setValue("confirmText", e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteForm.watch("confirmText") !== deleteConfirmationText || deleteLobMutation.isPending}
              onClick={async () => {
                try {
                  await deleteLobMutation.mutateAsync();
                } catch (error) {
                  console.error("Error deleting LOB:", error);
                }
              }}
            >
              {deleteLobMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}