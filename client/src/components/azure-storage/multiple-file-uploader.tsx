import React, { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, X, File as FileIcon, CheckCircle, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MultipleFileUploaderProps {
  containerName: string;
  onUploadSuccess?: (fileData: any) => void;
}

type FileStatus = 'pending' | 'uploading' | 'success' | 'error';

interface FileWithStatus {
  file: File;
  status: FileStatus;
  progress: number;
  error?: string;
}

export function MultipleFileUploader({ containerName, onUploadSuccess }: MultipleFileUploaderProps) {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Update overall progress when individual file progress changes
  useEffect(() => {
    if (files.length === 0) {
      setOverallProgress(0);
      return;
    }
    
    const totalProgress = files.reduce((sum, file) => sum + file.progress, 0);
    setOverallProgress(Math.round(totalProgress / files.length));
  }, [files]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Convert FileList to array
      const newFiles = Array.from(e.target.files);
      
      // Add new files with status
      const filesWithStatus: FileWithStatus[] = newFiles.map(file => ({
        file,
        status: 'pending',
        progress: 0
      }));
      
      setFiles(prev => [...prev, ...filesWithStatus]);
      
      // Reset input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Remove a specific file
  const removeFile = (fileToRemove: File) => {
    setFiles(prev => prev.filter(f => f.file !== fileToRemove));
  };

  // Clear all files
  const clearAllFiles = () => {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Function to upload a single file
  const uploadSingleFile = async (fileWithStatus: FileWithStatus, index: number): Promise<any> => {
    const { file } = fileWithStatus;
    
    // Update status to uploading
    setFiles(prev => prev.map((f, i) => 
      i === index ? { ...f, status: 'uploading' } : f
    ));
    
    // Create FormData object
    const formData = new FormData();
    formData.append("file", file);
    formData.append("contentType", file.type || "application/octet-stream");
    
    console.log(`Starting upload for file ${index + 1}/${files.length}: ${file.name}`);
    
    try {
      // Update progress at intervals
      const progressInterval = setInterval(() => {
        setFiles(prev => {
          const file = prev[index];
          if (file && file.status === 'uploading' && file.progress < 90) {
            const updated = [...prev];
            updated[index] = { 
              ...file, 
              progress: file.progress + Math.random() * 10
            };
            return updated;
          }
          return prev;
        });
      }, 300);
      
      // Upload the file
      const uploadUrl = `/api/azure-upload/${encodeURIComponent(containerName)}`;
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || "Upload failed";
        } catch (e) {
          errorMessage = errorText || "Upload failed";
        }
        
        // Create more user-friendly error messages based on common errors
        if (errorMessage.includes("storage account") || errorMessage.includes("account not found")) {
          errorMessage = "Storage service unavailable. Please try again later.";
        } else if (errorMessage.includes("container") && errorMessage.includes("not found")) {
          errorMessage = "Storage container not found. It may have been deleted.";
        } else if (errorMessage.includes("permission") || errorMessage.includes("access denied") || errorMessage.includes("unauthorized")) {
          errorMessage = "Permission denied. Contact your administrator.";
        } else if (errorMessage.includes("size") || errorMessage.includes("too large")) {
          errorMessage = "File exceeds maximum allowed size.";
        } else if (errorMessage.includes("format") || errorMessage.includes("invalid content type")) {
          errorMessage = "Unsupported file format.";
        } else if (errorMessage.includes("duplicate") || errorMessage.includes("already exists")) {
          errorMessage = "A file with this name already exists.";
        } else if (errorMessage.includes("invalid character") || errorMessage.includes("invalid name")) {
          errorMessage = "File name contains invalid characters.";
        }
        
        console.error(`Failed to upload ${file.name}: ${errorMessage}`);
        
        // Update file status to error
        setFiles(prev => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = { 
              ...updated[index], 
              status: 'error', 
              progress: 0,
              error: errorMessage
            };
          }
          return updated;
        });
        
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log(`Upload successful for ${file.name}`);
      
      // Update file status to success
      setFiles(prev => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { ...updated[index], status: 'success', progress: 100 };
        }
        return updated;
      });
      
      return result;
    } catch (error) {
      console.error(`Error uploading ${file.name}:`, error);
      
      // If not already marked as error
      setFiles(prev => {
        const current = prev[index];
        if (current && current.status !== 'error') {
          const updated = [...prev];
          updated[index] = { 
            ...updated[index], 
            status: 'error', 
            progress: 0,
            error: error instanceof Error ? error.message : 'Upload failed'
          };
          return updated;
        }
        return prev;
      });
      
      throw error;
    }
  };

  // Upload all files
  const uploadFiles = useMutation({
    mutationFn: async () => {
      if (files.length === 0 || !containerName) {
        throw new Error("Files and container name are required");
      }
      
      setIsUploading(true);
      console.log(`Starting upload of ${files.length} files to container: ${containerName}`);
      
      // Only upload files that are pending or had errors
      const filesToUpload = files.filter(f => 
        f.status === 'pending' || f.status === 'error'
      );
      
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      
      // Upload files sequentially
      for (let i = 0; i < filesToUpload.length; i++) {
        try {
          const index = files.findIndex(f => f === filesToUpload[i]);
          if (index !== -1) {
            const result = await uploadSingleFile(filesToUpload[i], index);
            results.push(result);
            successCount++;
          }
        } catch (error) {
          errorCount++;
          // Continue with next file even if one fails
        }
      }
      
      setIsUploading(false);
      return { results, successCount, errorCount, totalCount: filesToUpload.length };
    },
    onSuccess: (data) => {
      // Show appropriate toast based on results
      if (data.successCount === data.totalCount) {
        toast({
          title: "Upload complete",
          description: `Successfully uploaded ${data.successCount} files to ${containerName}`,
        });
      } else {
        toast({
          title: "Upload partially complete",
          description: `Uploaded ${data.successCount} of ${data.totalCount} files. ${data.errorCount} failed.`,
          variant: data.errorCount > 0 ? "destructive" : "default",
        });
      }
      
      // Invalidate blob list query to refresh
      queryClient.invalidateQueries({ queryKey: [`/api/azure-blobs/${containerName}`] });
      
      // Call success callback if provided
      if (onUploadSuccess && data.results.length > 0) {
        onUploadSuccess(data.results);
      }
    },
    onError: (error: Error) => {
      console.error("Error in batch upload:", error);
      
      // Create user-friendly error messages based on the error content
      let errorMessage = error.message || "Failed to upload files. Please try again.";
      let errorTitle = "Upload Failed";
      
      if (errorMessage.includes("storage account") || errorMessage.includes("account not found")) {
        errorMessage = "The storage service is currently unavailable. Please try again later or contact support.";
        errorTitle = "Storage Service Unavailable";
      } else if (errorMessage.includes("container") && errorMessage.includes("not found")) {
        errorMessage = "The storage container could not be found. It may have been deleted or renamed.";
        errorTitle = "Container Not Found";
      } else if (errorMessage.includes("permission") || errorMessage.includes("access denied") || errorMessage.includes("unauthorized")) {
        errorMessage = "You don't have permission to upload files to this container. Please contact your administrator.";
        errorTitle = "Permission Denied";
      } else if (errorMessage.includes("network") || errorMessage.includes("connection")) {
        errorMessage = "Network connection issue. Please check your internet connection and try again.";
        errorTitle = "Connection Error";
      } else if (errorMessage.includes("size") || errorMessage.includes("too large")) {
        errorMessage = "One or more files exceed the maximum allowed size. Please compress or split your files.";
        errorTitle = "File Size Error";
      } else if (errorMessage.includes("format") || errorMessage.includes("type")) {
        errorMessage = "One or more files have an unsupported format. Please check the allowed file types.";
        errorTitle = "Unsupported File Format";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
      setIsUploading(false);
    },
  });

  // Function to trigger file input click
  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Render file item with status
  const renderFileItem = (fileWithStatus: FileWithStatus, index: number) => {
    const { file, status, progress, error } = fileWithStatus;
    const isPending = status === 'pending';
    const isUploading = status === 'uploading';
    const isSuccess = status === 'success';
    const isError = status === 'error';

    return (
      <div key={`${file.name}-${index}`} className="border border-blue-100 rounded-lg p-3 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className={`p-2 rounded-md ${isSuccess ? 'bg-green-50' : isError ? 'bg-red-50' : 'bg-white'}`}>
              <FileIcon className={`h-6 w-6 ${isSuccess ? 'text-green-500' : isError ? 'text-red-500' : 'text-blue-500'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{file.name}</p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024).toFixed(2)} KB • {file.type || "Unknown type"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isSuccess && <CheckCircle className="h-5 w-5 text-green-500" />}
            {isError && <AlertCircle className="h-5 w-5 text-red-500" />}
            
            {!isUploading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(file)}
                className="text-red-500 hover:bg-red-50"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {isUploading && (
          <div className="mt-2 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-blue-700">Uploading...</span>
              <span className="text-blue-700 font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} max={100} className="h-1.5 bg-blue-100" />
          </div>
        )}
        
        {isError && (
          <div className="mt-2">
            <p className="text-xs text-red-500">{error || "Upload failed"}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="shadow-sm border-blue-100">
      <CardHeader className="pb-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardTitle className="text-lg flex items-center text-blue-700">
          <Upload className="mr-2 h-5 w-5" />
          Upload to {containerName}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-5 space-y-4">
        {/* Hidden file input */}
        <Input
          ref={fileInputRef}
          id="file-upload"
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        
        {/* File selection area */}
        <div 
          className={`border-2 border-dashed ${files.length > 0 ? 'border-blue-300' : 'border-blue-200'} 
                      rounded-lg p-5 text-center hover:border-blue-400 transition-colors cursor-pointer`}
          onClick={triggerFileSelect}
          data-action="select-file"
        >
          <div className="flex flex-col items-center gap-3">
            <div className={`p-3 rounded-full ${files.length > 0 ? 'bg-blue-100' : 'bg-blue-50'}`}>
              <Upload className={`h-6 w-6 ${files.length > 0 ? 'text-blue-600' : 'text-blue-500'}`} />
            </div>
            <div>
              <p className="font-medium text-gray-700">
                {files.length > 0 ? "Add more files" : "Click to select files"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {files.length > 0 
                  ? `${files.length} file${files.length !== 1 ? 's' : ''} selected` 
                  : "Select multiple audio files at once"}
              </p>
            </div>
          </div>
        </div>
        
        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm">Selected Files</h3>
                <Badge variant="outline" className="text-xs">
                  {files.length} file{files.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={clearAllFiles}
                disabled={isUploading}
                className="text-gray-500 hover:text-red-500 text-xs"
              >
                Clear All
              </Button>
            </div>
            
            <ScrollArea className={`h-${files.length > 4 ? '64' : 'auto'} max-h-64 pr-4`}>
              <div className="space-y-2">
                {files.map((fileWithStatus, index) => renderFileItem(fileWithStatus, index))}
              </div>
            </ScrollArea>
            
            {/* Overall progress */}
            {isUploading && (
              <div className="mt-4 space-y-1 bg-blue-50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm text-blue-700">Overall Progress</span>
                  <span className="text-blue-700 font-medium">{Math.round(overallProgress)}%</span>
                </div>
                <Progress value={overallProgress} max={100} className="h-2 bg-blue-100" />
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className={`border-t ${files.length > 0 ? 'bg-blue-50/50' : 'bg-gray-50'}`}>
        {files.length > 0 ? (
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => uploadFiles.mutate()}
            disabled={isUploading || files.length === 0}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading {files.filter(f => f.status === 'uploading').length} of {files.length}...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload {files.length} File{files.length !== 1 ? 's' : ''} to Azure
              </>
            )}
          </Button>
        ) : (
          <Button 
            className="w-full" 
            variant="outline"
            onClick={triggerFileSelect}
          >
            <Upload className="mr-2 h-4 w-4" />
            Select Files to Upload
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}