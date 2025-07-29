import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { SiReact } from "react-icons/si";
import { Label } from "@/components/ui/label";

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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Loader2, Edit, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface LineOfBusiness {
  id: number;
  name: string;
}

interface Process {
  id: number;
  name: string;
  inductionDays: number;
  trainingDays: number;
  certificationDays: number;
  ojtDays: number;
  ojtCertificationDays: number;
  lineOfBusinessId: number;
  lineOfBusinessName?: string;
  status?: string;
}

// Form schema updated to allow 0 days
const processFormSchema = z.object({
  name: z.string().min(1, "Process name is required"),
  inductionDays: z.number().min(0, "Induction days cannot be negative"),
  trainingDays: z.number().min(0, "Training days cannot be negative"),
  certificationDays: z.number().min(0, "Certification days cannot be negative"),
  ojtDays: z.number().min(0, "OJT days cannot be negative"),
  ojtCertificationDays: z.number().min(0, "OJT certification days cannot be negative"),
  lineOfBusinessId: z.number().min(1, "Line of Business is required"),
});

type ProcessFormValues = z.infer<typeof processFormSchema>;

export function ProcessDetail() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  
  // Check if user has permission to manage processes
  const canManageProcesses = hasPermission("manage_processes");

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

  // Fetch processes with optimized caching
  const { data: processes = [], isLoading: isLoadingProcesses } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/processes`],
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  });

  // Filter and pagination calculations
  const filteredProcesses = processes.filter((process: Process) => {
    const searchStr = searchQuery.toLowerCase();
    return (
      process.name.toLowerCase().includes(searchStr) ||
      (process.lineOfBusinessName || "").toLowerCase().includes(searchStr)
    );
  });

  const totalPages = Math.ceil(filteredProcesses.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedProcesses = filteredProcesses.slice(startIndex, endIndex);

  const form = useForm<ProcessFormValues>({
    resolver: zodResolver(processFormSchema),
    defaultValues: {
      name: "",
      inductionDays: 0,
      trainingDays: 0,
      certificationDays: 0,
      ojtDays: 0,
      ojtCertificationDays: 0,
      lineOfBusinessId: undefined,
    },
  });

  const editForm = useForm<ProcessFormValues>({
    resolver: zodResolver(processFormSchema),
    defaultValues: {
      name: "",
      inductionDays: 0,
      trainingDays: 0,
      certificationDays: 0,
      ojtDays: 0,
      ojtCertificationDays: 0,
      lineOfBusinessId: undefined,
    },
  });

  const createProcessMutation = useMutation({
    mutationFn: async (data: ProcessFormValues) => {
      const response = await fetch(`/api/organizations/${organization?.id}/processes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create process");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/processes`] });
      toast({
        title: "Success",
        description: "Process created successfully",
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

  const updateProcessMutation = useMutation({
    mutationFn: async (data: ProcessFormValues) => {
      const response = await fetch(`/api/organizations/${organization?.id}/processes/${selectedProcess?.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update process");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/processes`] });
      toast({
        title: "Success",
        description: "Process updated successfully",
      });
      setIsEditDialogOpen(false);
      setSelectedProcess(null);
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

  const deleteProcessMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/organizations/${organization?.id}/processes/${selectedProcess?.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete process");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/processes`] });
      toast({
        title: "Success",
        description: "Process deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setSelectedProcess(null);
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

  const onSubmit = async (data: ProcessFormValues) => {
    try {
      await createProcessMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error creating process:", error);
    }
  };

  const onEdit = async (data: ProcessFormValues) => {
    try {
      await updateProcessMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error updating process:", error);
    }
  };

  const handleEdit = (process: Process) => {
    setSelectedProcess(process);
    editForm.reset({
      name: process.name,
      inductionDays: process.inductionDays,
      trainingDays: process.trainingDays,
      certificationDays: process.certificationDays,
      ojtDays: process.ojtDays,
      ojtCertificationDays: process.ojtCertificationDays,
      lineOfBusinessId: process.lineOfBusinessId,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (process: Process) => {
    setSelectedProcess(process);
    setDeleteConfirmation("");
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedProcess) return;

    if (deleteConfirmation === selectedProcess.name) {
      deleteProcessMutation.mutate();
    } else {
      toast({
        title: "Error",
        description: "Please type the process name exactly as shown",
        variant: "destructive",
      });
    }
  };

  // Show loading state
  if (isLoadingLOB || isLoadingProcesses) {
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
              <h2 className="text-lg font-semibold">Manage Processes</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search processes..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 w-[250px] focus:border-purple-500"
                />
              </div>
              {canManageProcesses && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => setIsCreateDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Process
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Add a new process</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          {processes.length > 0 ? (
            <>
              {/* Row per page selection moved to the end of the table */}

              <div className="relative overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Process Name</TableHead>
                      <TableHead className="font-semibold">Line of Business</TableHead>
                      <TableHead className="font-semibold text-center">Induction Days</TableHead>
                      <TableHead className="font-semibold text-center">Training Days</TableHead>
                      <TableHead className="font-semibold text-center">Certification Days</TableHead>
                      <TableHead className="font-semibold text-center">OJT Days</TableHead>
                      <TableHead className="font-semibold text-center">OJT Cert Days</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProcesses.map((process: Process) => (
                      <TableRow 
                        key={process.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="font-medium">
                          {process.name}
                        </TableCell>
                        <TableCell>
                          {process.lineOfBusinessName || "-"}
                        </TableCell>
                        <TableCell className="text-center">{process.inductionDays}</TableCell>
                        <TableCell className="text-center">{process.trainingDays}</TableCell>
                        <TableCell className="text-center">{process.certificationDays}</TableCell>
                        <TableCell className="text-center">{process.ojtDays}</TableCell>
                        <TableCell className="text-center">{process.ojtCertificationDays}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            {canManageProcesses && (
                              <>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEdit(process)}
                                        className="h-7 w-7 p-0 text-blue-600"
                                      >
                                        <Edit className="h-4 w-4" />
                                        <span className="sr-only">Edit Process</span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p>Edit Process</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(process)}
                                        className="h-7 w-7 p-0 text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Delete Process</span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p>Delete Process</p>
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
                      {Math.min(endIndex, filteredProcesses.length)}{" "}
                      of {filteredProcesses.length} processes
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
                          <SelectItem value="25">25 per page</SelectItem>
                          <SelectItem value="50">50 per page</SelectItem>
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
                No processes found matching "{searchQuery}"
              </p>
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/10 rounded-lg border-2 border-dashed">
              <SiReact className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">
                No processes found. Add your first process to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Process Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Process</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4">
                {/* Process Name and Line of Business in the same row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Process Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter process name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lineOfBusinessId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Line of Business</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value, 10))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Line of Business" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {lineOfBusinesses.map((lob: LineOfBusiness) => (
                              <SelectItem key={lob.id} value={lob.id.toString()}>
                                {lob.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Days input fields in a grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="inductionDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Induction Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="trainingDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Training Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="certificationDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Certification Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ojtDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OJT Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ojtCertificationDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OJT Certification Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createProcessMutation.isPending}>
                  {createProcessMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Process"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Process Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Process</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
              <div className="space-y-4">
                {/* Same form fields as create dialog */}
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Process Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter process name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Same number input fields as create dialog */}
                  <FormField
                    control={editForm.control}
                    name="inductionDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Induction Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="trainingDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Training Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="certificationDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Certification Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="ojtDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OJT Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="ojtCertificationDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OJT Certification Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="lineOfBusinessId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Line of Business</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value, 10))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Line of Business" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {lineOfBusinesses.map((lob: LineOfBusiness) => (
                            <SelectItem key={lob.id} value={lob.id.toString()}>
                              {lob.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                {canManageProcesses ? (
                  <Button type="submit" disabled={updateProcessMutation.isPending}>
                    {updateProcessMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Process"
                    )}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Process</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to delete the process "{selectedProcess?.name}"? This action cannot be undone.
            </p>
            <div className="space-y-2">
              <Label htmlFor="confirm">Type "{selectedProcess?.name}" to confirm deletion</Label>
              <Input
                id="confirm"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type process name to confirm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteProcessMutation.isPending}
            >
              {deleteProcessMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Process"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}