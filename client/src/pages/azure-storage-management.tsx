import React, { useState } from "react";
import { Link, useParams } from "wouter";
import { AzureContainerManager } from "@/components/azure-storage/azure-container-manager";
import { MultipleFileUploader } from "@/components/azure-storage/multiple-file-uploader";
import { Button } from "@/components/ui/button";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { FolderOpen, HardDrive, Upload, Loader2, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

export function AzureStorageManagement() {
  // Get container name from URL if present
  const { containerName } = useParams<{ containerName?: string }>();
  const [selectedContainer, setSelectedContainer] = useState<string | null>(containerName || null);
  const [activeTab, setActiveTab] = useState<string>(containerName ? "uploader" : "containers");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newContainerName, setNewContainerName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  
  // Container name validation regex
  const containerNameRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

  interface Container {
    name: string;
    properties?: {
      publicAccess?: string;
      lastModified?: string;
    };
  }
  
  // Mutation to create a container
  const createContainer = useMutation({
    mutationFn: async () => {
      // Validate container name
      if (!containerNameRegex.test(newContainerName)) {
        setValidationError(
          "Container name must be 3-63 characters, use only lowercase letters, numbers, and dashes, and begin and end with a letter or number."
        );
        return null;
      }
      
      const data = {
        containerName: newContainerName,
        isPublic
      };
      
      return apiRequest('POST', '/api/azure-containers', data);
    },
    onSuccess: (data) => {
      if (data) {
        toast({
          title: "Container created",
          description: `Container "${newContainerName}" created successfully.`,
        });
        setNewContainerName("");
        setIsPublic(false);
        setIsCreateDialogOpen(false);
        setValidationError(null);
        
        // Invalidate the containers query to refresh the list and select the new container
        queryClient.invalidateQueries({ queryKey: ['/api/azure-containers'] });
        
        // Set the newly created container as selected
        setSelectedContainer(newContainerName);
      }
    },
    onError: (error: any) => {
      console.error("Error creating container:", error);
      
      // Extract more detailed error message if available
      let errorMessage = "Failed to create container. Please try again.";
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      // Create user-friendly error messages based on the error content
      let errorTitle = "Error Creating Container";
      
      if (errorMessage.includes("already exists")) {
        errorMessage = "A container with this name already exists. Please choose a different name.";
        errorTitle = "Name Conflict";
      } else if (errorMessage.includes("special character") || errorMessage.includes("invalid character") || 
                 errorMessage.includes("alphanumeric") || errorMessage.includes("valid name")) {
        errorMessage = "Container name can only contain lowercase letters, numbers, and hyphens. It must begin with a letter or number.";
        errorTitle = "Invalid Name Format";
      } else if (errorMessage.includes("length") || errorMessage.includes("too short") || errorMessage.includes("too long")) {
        errorMessage = "Container name must be between 3 and 63 characters long.";
        errorTitle = "Name Length Error";
      } else if (errorMessage.includes("permission") || errorMessage.includes("access denied") || errorMessage.includes("not authorized")) {
        errorMessage = "You don't have permission to create containers. Please contact your administrator.";
        errorTitle = "Permission Denied";
      } else if (errorMessage.includes("storage account") || errorMessage.includes("account not found")) {
        errorMessage = "The storage service is currently unavailable. Please try again later or contact support.";
        errorTitle = "Storage Service Unavailable";
      } else if (errorMessage.includes("network") || errorMessage.includes("connection")) {
        errorMessage = "Network connection issue. Please check your internet connection and try again.";
        errorTitle = "Connection Error";
      }
      
      // Display error toast with user-friendly message
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Query to fetch all containers
  const { isLoading, data: containers = [], error, refetch } = useQuery<Container[]>({
    queryKey: ['/api/azure-containers'],
  });

  // Set selected container if it exists in the list
  React.useEffect(() => {
    if (containerName && containers && containers.length > 0) {
      const exists = containers.some((container) => container.name === containerName);
      if (exists) {
        setSelectedContainer(containerName);
        setActiveTab("uploader");
      }
    }
    
    // Check for URL parameters
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === 'true') {
      setIsCreateDialogOpen(true);
    }
  }, [containerName, containers]);

  return (
    <div className="container mx-auto py-8 px-4">
      <header className="mb-8">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/azure-storage-management">Azure Storage</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {selectedContainer && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink>{selectedContainer}</BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold">Azure Storage Management</h1>
          <Button asChild variant="outline" size="sm">
            <Link href="/azure-storage-browser">
              <FolderOpen className="mr-2 h-4 w-4" />
              Browse All Files
            </Link>
          </Button>
        </div>
      </header>

      {/* Selected container info */}
      {selectedContainer && (
        <div className="mb-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow-sm overflow-hidden">
          <div className="border border-green-200 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-green-800 flex items-center">
                  <HardDrive className="mr-2 h-5 w-5" />
                  {selectedContainer}
                </h2>
                <p className="text-green-700 text-sm mt-1">Ready for file operations</p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedContainer(null)}
                  className="border-red-200 text-red-700 hover:bg-red-50"
                >
                  Deselect
                </Button>
                <Button 
                  onClick={() => {
                    // Scroll to the upload section
                    const uploadSection = document.getElementById('upload-section');
                    if (uploadSection) {
                      uploadSection.scrollIntoView({ behavior: 'smooth' });
                      
                      // Try to trigger the file selection dialog
                      setTimeout(() => {
                        const selectFileButton = document.querySelector('[data-action="select-file"]');
                        if (selectFileButton && selectFileButton instanceof HTMLButtonElement) {
                          selectFileButton.click();
                        }
                      }, 300);
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Files
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {/* Container List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Storage Containers</h2>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <HardDrive className="mr-2 h-4 w-4" />
              Create Container
            </Button>
          </div>
          
          {isLoading ? (
            <div className="text-center p-8">Loading containers...</div>
          ) : error ? (
            <div className="text-center p-8 text-red-500">
              Failed to load containers. 
              <Button variant="link" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : containers.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-lg">
              No containers found. Create a container to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {containers.map((container) => {
                const isSelected = selectedContainer === container.name;
                
                return (
                  <Card 
                    key={container.name} 
                    className={`overflow-hidden hover:shadow-md transition-all cursor-pointer border 
                              ${isSelected ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200'}`}
                    onClick={() => {
                      setSelectedContainer(container.name);
                      
                      // Scroll to upload section when a container is selected
                      setTimeout(() => {
                        const uploadSection = document.getElementById('upload-section');
                        if (uploadSection) {
                          uploadSection.scrollIntoView({ behavior: 'smooth' });
                        }
                      }, 100);
                    }}
                  >
                    <div className={`absolute top-0 left-0 w-full h-1 ${isSelected ? 'bg-blue-500' : 'bg-transparent'}`}></div>
                    
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HardDrive className={`h-4 w-4 ${isSelected ? 'text-blue-500' : 'text-gray-500'}`} />
                          <CardTitle className="text-lg truncate">{container.name}</CardTitle>
                        </div>
                        {isSelected && (
                          <div className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            Selected
                          </div>
                        )}
                      </div>
                      <CardDescription>
                        <span className="inline-flex items-center text-xs">
                          <span className={`w-2 h-2 rounded-full mr-1.5 ${container.properties?.publicAccess ? 'bg-blue-500' : 'bg-gray-500'}`}></span>
                          {container.properties?.publicAccess
                            ? `Public Access: ${container.properties.publicAccess}`
                            : "Private Access"}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="pb-2">
                      <p className="text-xs text-gray-500 flex items-center">
                        <Clock className="h-3.5 w-3.5 mr-1.5" />
                        {container.properties?.lastModified 
                          ? new Date(container.properties.lastModified).toLocaleString() 
                          : "Unknown"}
                      </p>
                    </CardContent>
                    
                    <CardFooter className={`pt-2 border-t ${isSelected ? 'border-blue-100 bg-blue-50' : 'border-gray-100'}`}>
                      <div className="flex gap-1.5 w-full">
                        <Button 
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContainer(container.name);
                            
                            // Scroll to upload section immediately
                            setTimeout(() => {
                              const uploadSection = document.getElementById('upload-section');
                              if (uploadSection) {
                                uploadSection.scrollIntoView({ behavior: 'smooth' });
                                
                                // After scrolling, try to trigger the file selection dialog
                                setTimeout(() => {
                                  const selectFileButton = document.querySelector('[data-action="select-file"]');
                                  if (selectFileButton && selectFileButton instanceof HTMLElement) {
                                    selectFileButton.click();
                                  }
                                }, 300);
                              }
                            }, 100);
                          }}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Files
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link href={`/azure-storage-browser/${container.name}`}>
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Browse Files
                          </Link>
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        
        {/* File Upload Section */}
        {selectedContainer && (
          <div id="upload-section" className="space-y-4 pt-6 mt-8 border-t border-blue-100">
            <div className="flex items-center">
              <div className="mr-2 p-2 bg-blue-100 rounded-full">
                <Upload className="h-5 w-5 text-blue-700" />
              </div>
              <h2 className="text-2xl font-bold text-blue-800">Upload Files</h2>
            </div>
            
            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
              <MultipleFileUploader 
                containerName={selectedContainer} 
                onUploadSuccess={(fileData) => {
                  console.log("Files uploaded successfully:", fileData);
                  
                  // Invalidate the relevant queries to refresh the file list
                  queryClient.invalidateQueries({ queryKey: [`/api/azure-blobs/${selectedContainer}`] });
                }}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Container Creation Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-full">
                <HardDrive className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <DialogTitle className="text-xl">Create Storage Container</DialogTitle>
                <DialogDescription className="text-blue-600">
                  Create a new container for storing audio files
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-5 py-4">
            <div className="space-y-3">
              <Label htmlFor="container-name" className="text-base font-medium">Container Name</Label>
              <Input
                id="container-name"
                placeholder="Enter a unique name for your container"
                value={newContainerName}
                onChange={(e) => {
                  setNewContainerName(e.target.value.toLowerCase());
                  setValidationError(null);
                }}
                className="border-blue-200 focus:border-blue-400"
              />
              
              {validationError ? (
                <p className="text-sm text-red-500 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  {validationError}
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  <span className="block font-medium mb-1">Container name requirements:</span>
                  <span className="block ml-1">• 3 to 63 characters long</span>
                  <span className="block ml-1">• Only lowercase letters, numbers, and dashes</span>
                  <span className="block ml-1">• Must begin and end with a letter or number</span>
                </p>
              )}
            </div>
            
            <div className="p-4 border border-blue-100 rounded-lg bg-blue-50">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="is-public" 
                  checked={isPublic} 
                  onCheckedChange={(checked) => setIsPublic(checked === true)}
                  className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <div>
                  <Label htmlFor="is-public" className="text-sm font-medium">
                    Make container public
                  </Label>
                  <p className="text-xs text-gray-600">
                    Allows anonymous access to container contents
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="border-t pt-4 flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => setIsCreateDialogOpen(false)}
              className="border-gray-300"
            >
              Cancel
            </Button>
            
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setNewContainerName("");
                  setIsPublic(false);
                  setValidationError(null);
                }}
                disabled={!newContainerName || createContainer.isPending}
                className="text-gray-500"
              >
                Reset
              </Button>
              
              <Button
                onClick={() => createContainer.mutate()}
                disabled={!newContainerName || createContainer.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createContainer.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <HardDrive className="mr-2 h-4 w-4" />
                    Create Container
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AzureStorageManagement;