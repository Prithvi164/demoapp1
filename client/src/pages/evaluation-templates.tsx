import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormBuilder } from "@/components/evaluation/form-builder";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { InsertEvaluationTemplate } from "@shared/schema";
import { Trash2, Copy, Archive, Check, Edit, Percent, Search, Filter } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import React from "react";


// Form schema for creating a template
const formSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  processId: z.number().min(1, "Process is required"),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  feedbackThreshold: z.number().min(0).max(100).optional().nullable(),
  batchId: z.number().optional().nullable(),
});

export default function EvaluationTemplatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<number | null>(null);
  const [templateToDuplicate, setTemplateToDuplicate] = useState<number | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(null);
  const [filteredBatches, setFilteredBatches] = useState<any[]>([]);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active" | "archived">("all");

  // Fetch available processes
  const { data: processes = [] } = useQuery({
    queryKey: [`/api/processes`],
    enabled: !!user?.organizationId,
  });

  // Fetch available batches
  const { data: batches = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });

  // Fetch evaluation templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
    enabled: !!user?.organizationId,
  });

  // Helper function to filter batches by process ID
  const filterBatchesByProcess = (processId: number | null) => {
    if (processId) {
      console.log(`Filtering batches for processId: ${processId}`);
      const filtered = batches.filter((batch: any) => batch.processId === processId);
      console.log(`Found ${filtered.length} batches for process ${processId}`);
      return filtered;
    }
    console.log("No process selected, returning all batches");
    return batches;
  };

  // Update filtered batches whenever selectedProcessId or batches change
  useEffect(() => {
    const filtered = filterBatchesByProcess(selectedProcessId);
    setFilteredBatches(filtered);
  }, [selectedProcessId, batches]);

  // Handle process selection and filter batches
  const handleProcessChange = (processId: number) => {
    console.log(`Process changed to: ${processId}`);
    setSelectedProcessId(processId);

    // Reset batch selection in create form when process changes
    if (form) {
      form.setValue("batchId", null);
    }
  };

  // Function to get batches for a specific process (used in edit form)
  const getBatchesForProcess = (processId: number) => {
    return batches.filter((batch: any) => batch.processId === processId);
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: "draft",
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: InsertEvaluationTemplate) => {
      const response = await fetch("/api/evaluation-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create template");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
      });
      toast({
        title: "Success",
        description: "Evaluation template created successfully",
      });
      setIsCreateDialogOpen(false);
      setSelectedTemplateId(data.id);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      console.log(`Attempting to delete template ID: ${templateId}`);
      const response = await fetch(`/api/evaluation-templates/${templateId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        console.error(`Error deleting template ${templateId}:`, error);
        throw new Error(error.message || "Failed to delete template");
      }
      return true; // Return something to indicate success
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
      });
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
      if (selectedTemplateId === templateToDelete) {
        setSelectedTemplateId(null);
      }
      setTemplateToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async ({ templateId, newName }: { templateId: number; newName: string }) => {
      const response = await fetch(`/api/evaluation-templates/${templateId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to duplicate template");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
      });
      toast({
        title: "Success",
        description: "Template duplicated successfully",
      });
      setDuplicateDialogOpen(false);
      setNewTemplateName("");
      setTemplateToDuplicate(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const finalizeTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      console.log(`Attempting to finalize template ID: ${templateId}`);
      const response = await fetch(`/api/evaluation-templates/${templateId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      if (!response.ok) {
        const error = await response.json();
        console.error(`Error finalizing template ${templateId}:`, error);
        throw new Error(error.message || "Failed to finalize template");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
      });
      toast({
        title: "Success",
        description: "Template status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const archiveTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      console.log(`Attempting to archive template ID: ${templateId}`);
      // Create a direct archive endpoint to avoid conflicts with the general update endpoint
      const response = await fetch(`/api/evaluation-templates/${templateId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) {
        const error = await response.json();
        console.error(`Error archiving template ${templateId}:`, error);
        throw new Error(error.message || "Failed to archive template");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
      });
      toast({
        title: "Success",
        description: "Template archived successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!user?.organizationId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Organization ID is required",
      });
      return;
    }

    createTemplateMutation.mutate({
      ...values,
      organizationId: user.organizationId,
      createdBy: user.id,
    });
  };

  const handleDuplicate = () => {
    if (!templateToDuplicate || !newTemplateName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Template name is required",
      });
      return;
    }

    duplicateTemplateMutation.mutate({
      templateId: templateToDuplicate,
      newName: newTemplateName.trim(),
    });
  };

  // Filter and sort templates
  const filteredAndSortedTemplates = useMemo(() => {
    // First filter by status if a filter is selected
    let filtered = [...(templates as any[] || [])];
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(template => template.status === statusFilter);
    }
    
    // Then filter by search query if there is one
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(template => 
        template.name.toLowerCase().includes(query) || 
        (template.description && template.description.toLowerCase().includes(query))
      );
    }
    
    // Sort by creation date/id (newer first)
    filtered.sort((a, b) => b.id - a.id);
    
    return filtered;
  }, [templates, statusFilter, searchQuery]);

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Evaluation Templates</h1>
        <Dialog 
          open={isCreateDialogOpen} 
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              // Reset the process selection when closing the dialog
              setSelectedProcessId(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>Create New Template</Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-[600px] max-h-[90vh] p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Create New Evaluation Template</DialogTitle>
              <DialogDescription>
                Create a template for evaluating trainee performance.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[calc(90vh-8rem)]">
              <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter template name" />
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
                          {...field}
                          placeholder="Describe the evaluation template"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="processId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Process</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const processId = parseInt(value);
                          field.onChange(processId);
                          handleProcessChange(processId);
                        }}
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select process" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {processes.map((process: any) => (
                            <SelectItem
                              key={process.id}
                              value={process.id.toString()}
                            >
                              {process.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="batchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch (Optional)</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "none" ? null : parseInt(value))}
                        defaultValue={field.value?.toString() || "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select batch (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Batch</SelectItem>
                          {(filteredBatches.length > 0 ? filteredBatches : batches).map((batch: any) => (
                            <SelectItem
                              key={batch.id}
                              value={batch.id.toString()}
                            >
                              {batch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Associate this template with a specific batch.
                      </p>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="feedbackThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Feedback Threshold</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="E.g., 75"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value === "" ? null : Number(e.target.value);
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        When an evaluation score falls below this threshold, the system will automatically trigger a feedback process.
                      </p>
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createTemplateMutation.isPending}
                >
                  {createTemplateMutation.isPending
                    ? "Creating..."
                    : "Create Template"}
                </Button>
              </form>
            </Form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Duplicate Template</DialogTitle>
            <DialogDescription>
              Enter a new name for the duplicated template.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Enter new template name"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setDuplicateDialogOpen(false);
                setNewTemplateName("");
                setTemplateToDuplicate(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleDuplicate} disabled={duplicateTemplateMutation.isPending}>
              {duplicateTemplateMutation.isPending ? "Duplicating..." : "Duplicate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          {selectedTemplateId && (
            <TabsTrigger value="builder">Form Builder</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="templates">
          {/* Search and filter controls */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search templates..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant={statusFilter === "all" ? "default" : "outline"} 
                onClick={() => setStatusFilter("all")}
                className="flex-1 md:flex-none"
              >
                All
              </Button>
              <Button 
                variant={statusFilter === "draft" ? "default" : "outline"} 
                onClick={() => setStatusFilter("draft")}
                className="flex-1 md:flex-none"
              >
                Draft
              </Button>
              <Button 
                variant={statusFilter === "active" ? "default" : "outline"} 
                onClick={() => setStatusFilter("active")}
                className="flex-1 md:flex-none"
              >
                Active
              </Button>
              <Button 
                variant={statusFilter === "archived" ? "default" : "outline"} 
                onClick={() => setStatusFilter("archived")}
                className="flex-1 md:flex-none"
              >
                Archived
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {isLoading ? (
              <p>Loading templates...</p>
            ) : filteredAndSortedTemplates.length === 0 ? (
              <p>No templates available{searchQuery || statusFilter !== "all" ? " matching your filters" : ""}. {!searchQuery && statusFilter === "all" && "Create your first template to get started."}</p>
            ) : (
              filteredAndSortedTemplates.map((template: any) => (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-all ${
                    selectedTemplateId === template.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{template.name}</CardTitle>
                        <CardDescription title={template.description} className="whitespace-nowrap overflow-hidden text-ellipsis">
                          {template.description ? (
                            template.description.length > 30 ? 
                            `${template.description.substring(0, 30)}...` : 
                            template.description
                          ) : ''}
                          </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {template.status === "draft" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                title="Finalize Template"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Finalize Template?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will activate the template for use in evaluations. You won't be
                                  able to modify the template structure after activation.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    console.log(`AlertDialog - Finalizing template ${template.id}`);
                                    finalizeTemplateMutation.mutate(template.id);
                                  }}
                                >
                                  Finalize
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {template.status === "active" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                title="Archive Template"
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Archive Template?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will archive the template. Archived templates cannot be used for
                                  new evaluations but existing evaluations will be preserved.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    console.log(`AlertDialog - Archiving template ${template.id}`);
                                    archiveTemplateMutation.mutate(template.id);
                                  }}
                                >
                                  Archive
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTemplateToDuplicate(template.id);
                            setDuplicateDialogOpen(true);
                          }}
                          title="Duplicate Template"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTemplateToDelete(template.id);
                                }}
                                title="Delete Template"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this evaluation template and all its
                                associated pillars and parameters. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  if (templateToDelete) {
                                    console.log(`AlertDialog - Deleting template ${templateToDelete}`);
                                    deleteTemplateMutation.mutate(templateToDelete);
                                    setTemplateToDelete(null);
                                  }
                                }}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <Badge
                      variant={
                        template.status === "active"
                          ? "default"
                          : template.status === "draft"
                          ? "secondary"
                          : "destructive"
                      }
                      className="mt-2"
                    >
                      {template.status}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
                    {/* Process Name Row */}
                    <div className="flex items-center gap-2 border-b pb-2">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-muted-foreground">Process:</span>{" "}
                        <span className="text-sm">
                          {processes.find((p: any) => p.id === template.processId)?.name || "Unknown Process"}
                        </span>
                      </div>
                      {/* Edit Template Button - Only available for draft templates */}
                      {template.status === "draft" && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex items-center gap-1" 
                              onClick={(e) => {
                                e.stopPropagation();
                                // Set the selected process ID when opening the edit dialog
                                handleProcessChange(template.processId);
                              }}
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </Button>
                          </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                          <DialogHeader>
                            <DialogTitle>Edit Evaluation Template</DialogTitle>
                            <DialogDescription>
                              Update template details below.
                            </DialogDescription>
                          </DialogHeader>
                          <form
                            className="space-y-4"
                            id={`template-edit-form-${template.id}`}
                            onSubmit={(e) => {
                              e.preventDefault();

                              // Get the Select components' values directly
                              const name = (document.getElementById(`name-${template.id}`) as HTMLInputElement)?.value;
                              const description = (document.getElementById(`description-${template.id}`) as HTMLTextAreaElement)?.value || "";

                              // Get process value from the form
                              const processSelects = document.querySelectorAll(`#template-edit-form-${template.id} [name="processId"]`);
                              const processId = processSelects.length > 0 ? 
                                Number((processSelects[0] as HTMLSelectElement).value) : template.processId;

                              // Get batch value from the hidden input which we keep in sync with the Select component
                              const hiddenBatchIdInput = document.querySelector(`#template-edit-form-${template.id} input[name="hiddenBatchId"]`) as HTMLInputElement;
                              const batchIdStr = hiddenBatchIdInput?.value || (template.batchId ? template.batchId.toString() : "none");

                              console.log(`Retrieved batch ID from hidden input: ${batchIdStr}`);

                              const threshold = (document.getElementById(`threshold-${template.id}`) as HTMLInputElement)?.value;

                              console.log(`Submitting edit form for template ${template.id}:`, {
                                name, description, 
                                processId,
                                batchId: batchIdStr === "none" || batchIdStr === "" ? null : Number(batchIdStr),
                                feedbackThreshold: threshold === "" ? null : Number(threshold)
                              });

                              // Prepare the data to send
                              let batchId = null;
                              if (batchIdStr !== "none" && batchIdStr !== "") {
                                batchId = Number(batchIdStr);
                              }

                              fetch(`/api/evaluation-templates/${template.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ 
                                  name,
                                  description,
                                  processId,
                                  batchId,
                                  feedbackThreshold: threshold === "" ? null : Number(threshold) 
                                }),
                              })
                                .then(response => {
                                  if (!response.ok) {
                                    throw new Error("Failed to update template");
                                  }
                                  return response.json();
                                })
                                .then(() => {
                                  queryClient.invalidateQueries({
                                    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
                                  });
                                  toast({
                                    title: "Success",
                                    description: "Template updated successfully",
                                  });
                                })
                                .catch(error => {
                                  toast({
                                    variant: "destructive",
                                    title: "Error",
                                    description: error.message,
                                  });
                                });
                            }}
                          >
                            <div className="grid gap-4">
                              <div className="grid gap-2">
                                <Label htmlFor={`name-${template.id}`}>Template Name</Label>
                                <Input
                                  id={`name-${template.id}`}
                                  name="name"
                                  defaultValue={template.name}
                                  placeholder="Enter template name"
                                  required
                                />
                              </div>

                              <div className="grid gap-2">
                                <Label htmlFor={`description-${template.id}`}>Description</Label>
                                <Textarea
                                  id={`description-${template.id}`}
                                  name="description"
                                  defaultValue={template.description || ""}
                                  placeholder="Describe the evaluation template"
                                  rows={3}
                                />
                              </div>

                              <div className="grid gap-2">
                                <Label htmlFor={`process-${template.id}`}>Process</Label>
                                <Select 
                                  name="processId" 
                                  key={`process-select-${template.id}`}
                                  defaultValue={template.processId.toString()}
                                  onValueChange={(value) => {
                                    const processId = parseInt(value);
                                    console.log(`Edit form: Process changed to ${processId} for template ${template.id}`);
                                    setSelectedProcessId(processId);

                                    // Reset batch selection when process changes and auto-update the hidden input
                                    // First, set the Select component to show "No Batch"
                                    const batchSelects = document.querySelectorAll(`#template-edit-form-${template.id} [name="batchId"]`);
                                    if (batchSelects.length > 0) {
                                      (batchSelects[0] as HTMLSelectElement).value = "none";
                                    }

                                    // Also update the hidden input field directly to ensure it gets submitted correctly
                                    const batchIdField = document.querySelector(`#template-edit-form-${template.id} input[name="hiddenBatchId"]`);
                                    if (batchIdField) {
                                      (batchIdField as HTMLInputElement).value = "none";
                                    }
                                  }}
                                >
                                  <SelectTrigger id={`process-${template.id}`}>
                                    <SelectValue placeholder="Select process" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {processes.map((process: any) => (
                                      <SelectItem
                                        key={`process-option-${process.id}`}
                                        value={process.id.toString()}
                                      >
                                        {process.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="grid gap-2">
                                <Label htmlFor={`batch-${template.id}`}>Batch (Optional)</Label>
                                <Select 
                                  name="batchId" 
                                  key={`batch-select-${template.id}-${selectedProcessId || template.processId}`}
                                  defaultValue={template.batchId ? template.batchId.toString() : "none"}
                                  onValueChange={(value) => {
                                    console.log(`Batch selection changed to ${value} for template ${template.id}`);

                                    // This is critical - immediately update the hidden input field that will be used during form submission
                                    const batchIdField = document.querySelector(`#template-edit-form-${template.id} input[name="hiddenBatchId"]`);
                                    if (batchIdField) {
                                      (batchIdField as HTMLInputElement).value = value;
                                      console.log(`Updated hidden batch ID field to ${value}`);
                                    }

                                    // Force update the Select UI component as well
                                    const selectElement = document.querySelector(`#template-edit-form-${template.id} [name="batchId"]`);
                                    if (selectElement) {
                                      (selectElement as any).setAttribute('data-state', 'closed');
                                      (selectElement as any).setAttribute('data-value', value);
                                    }
                                  }}
                                >
                                  <SelectTrigger id={`batch-${template.id}`}>
                                    <SelectValue placeholder="Select batch (optional)" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No Batch</SelectItem>
                                    {getBatchesForProcess(selectedProcessId || template.processId).map((batch: any) => (
                                      <SelectItem
                                        key={`batch-option-${batch.id}`}
                                        value={batch.id.toString()}
                                      >
                                        {batch.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                  Associate this template with a specific batch.
                                </p>
                              </div>

                              <div className="grid gap-2">
                                <Label htmlFor={`threshold-${template.id}`}>Feedback Threshold</Label>
                                <Input
                                  id={`threshold-${template.id}`}
                                  name="threshold"
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="E.g., 75"
                                  defaultValue={template.feedbackThreshold !== null ? template.feedbackThreshold.toString() : ""}
                                />
                                <p className="text-xs text-muted-foreground">
                                  When an evaluation score falls below this threshold, the system will automatically trigger a feedback process.
                                </p>
                              </div>

                              {/* Hidden input for batch ID to ensure it gets sent correctly */}
                              <input 
                                type="hidden" 
                                name="hiddenBatchId" 
                                defaultValue={template.batchId ? template.batchId.toString() : "none"} 
                              />
                            </div>
                            <DialogFooter className="mt-6">
                              <Button type="submit">Save Changes</Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                      )}
                    </div>

                    {/* Batch Name Row (if available) */}
                    {template.batchId && (
                      <div className="flex items-center justify-between border-b pb-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">Batch:</span>{" "}
                          <span className="text-sm">
                            {batches.find((b: any) => b.id === template.batchId)?.name || "Unknown Batch"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Feedback Threshold Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Feedback Threshold: {template.feedbackThreshold !== null ? `${template.feedbackThreshold}%` : "Not Set"}
                        </span>
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => setSelectedTemplateId(template.id)}>
                      {selectedTemplateId === template.id
                        ? "Currently Selected"
                        : "Select Template"}
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="builder">
          {selectedTemplateId ? (
            <FormBuilder templateId={selectedTemplateId} />
          ) : (
            <p>Please select a template to start building the evaluation form.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}