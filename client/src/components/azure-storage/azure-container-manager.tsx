import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

// Container name validation regex
const containerNameRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

interface AzureContainerManagerProps {
  onSelectContainer?: (containerName: string) => void;
}

export function AzureContainerManager({ onSelectContainer }: AzureContainerManagerProps = {}) {
  const [newContainerName, setNewContainerName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  
  interface Container {
    name: string;
    properties?: {
      publicAccess?: string;
      lastModified?: string;
    };
  }
  
  // Query to fetch containers
  const { data: containers = [], isLoading, error, refetch } = useQuery<Container[]>({
    queryKey: ['/api/azure-containers'],
    retry: 1,
  });
  
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
        setIsDialogOpen(false);
        setValidationError(null);
        
        // Invalidate the containers query to refresh the list
        queryClient.invalidateQueries({ queryKey: ['/api/azure-containers'] });
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
      
      // Display error toast with more detailed message
      toast({
        title: "Error Creating Container",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission
  const handleCreateContainer = (e: React.FormEvent) => {
    e.preventDefault();
    createContainer.mutate();
  };
  
  // Handle container name change
  const handleContainerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewContainerName(value);
    
    // Validate as user types
    if (value && !containerNameRegex.test(value)) {
      setValidationError(
        "Container name must be 3-63 characters, use only lowercase letters, numbers, and dashes, and begin and end with a letter or number."
      );
    } else {
      setValidationError(null);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Azure Storage Containers</h2>
        
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>Create Container</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create new Azure Storage container</DialogTitle>
              <DialogDescription>
                Enter a name for your new container. Names must be unique within your storage account.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleCreateContainer} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="containerName">Container Name</Label>
                <Input
                  id="containerName"
                  value={newContainerName}
                  onChange={handleContainerNameChange}
                  placeholder="my-container-name"
                  required
                  className={validationError ? "border-red-500" : ""}
                />
                {validationError && (
                  <p className="text-red-500 text-sm">{validationError}</p>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isPublic"
                  checked={isPublic}
                  onCheckedChange={(checked) => setIsPublic(!!checked)}
                />
                <Label htmlFor="isPublic">Public access for blobs</Label>
              </div>
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createContainer.isPending || !!validationError || !newContainerName}
                >
                  {createContainer.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Container"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center p-4 border border-red-200 rounded-md bg-red-50 text-red-700">
          <p>Failed to load containers</p>
          <Button variant="outline" onClick={() => refetch()} className="mt-2">
            Retry
          </Button>
        </div>
      ) : containers.length === 0 ? (
        <div className="text-center p-8 border border-dashed rounded-md">
          <p className="text-gray-500 dark:text-gray-400">
            No containers found. Create your first container to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {containers.map((container: any) => (
            <Card 
              key={container.name} 
              className={`overflow-hidden ${onSelectContainer ? 'cursor-pointer hover:border-primary transition-colors' : ''}`}
              onClick={() => {
                if (onSelectContainer) {
                  onSelectContainer(container.name);
                  console.log("Container selected:", container.name);
                }
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg truncate">{container.name}</CardTitle>
                <CardDescription>
                  {container.properties?.publicAccess
                    ? `Public Access: ${container.properties.publicAccess}`
                    : "Private Access"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last Modified: {container.properties?.lastModified 
                    ? new Date(container.properties.lastModified).toLocaleString() 
                    : "Unknown"}
                </p>
              </CardContent>
              <CardFooter className="pt-2 flex justify-between gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  asChild
                  onClick={(e) => e.stopPropagation()} // Prevent card click event
                >
                  <a href={`/azure-storage-browser/${container.name}`}>
                    Browse Files
                  </a>
                </Button>
                {onSelectContainer && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click event
                      onSelectContainer(container.name);
                      console.log("Container selected from button:", container.name);
                    }}
                  >
                    Select for Upload
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}