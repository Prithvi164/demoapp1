import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UploadCloud, FileAudio, Upload, Filter, Clock, FilePlus, FileSpreadsheet, Download, ChevronDown, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { formatDistanceToNow } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import * as XLSX from 'xlsx';

// Helper functions
const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Define status type to fix TypeScript errors
type AudioFileStatus = 'pending' | 'allocated' | 'evaluated' | 'archived';

const statusColors: Record<AudioFileStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
  allocated: "bg-blue-100 text-blue-800 hover:bg-blue-200",
  evaluated: "bg-green-100 text-green-800 hover:bg-green-200",
  archived: "bg-gray-100 text-gray-800 hover:bg-gray-200"
};

const AudioFileManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [batchUploadDialogOpen, setBatchUploadDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadAudioFiles, setUploadAudioFiles] = useState<File[]>([]);
  const [metadataFile, setMetadataFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState({
    language: 'english',
    version: '',
    callMetrics: {
      callDate: new Date().toISOString().split('T')[0],
      callId: '',
      callType: 'inbound',
      agentId: '',
      customerSatisfaction: 0,
      handleTime: 0,
      // New fields from requirements
      auditRole: '',
      OLMSID: '',
      Name: '',
      PBXID: '',
      partnerName: '',
      customerMobile: '',
      callDuration: '',
      subType: '',
      subSubType: '',
      VOC: '',
      languageOfCall: 'english',
      userRole: '',
      advisorCategory: '',
      businessSegment: '',
      LOB: '',
      formName: ''
    }
  });
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({
    language: 'all',
    version: '',
    status: 'any',
    duration: 'any',
    callType: 'all',
    agentId: '',
    campaignName: '',
    callDate: '',
    disposition1: '',
    disposition2: '',
    queryType: '',
    businessSegment: '',
    customerMobile: '',
    callTime: '',
    subType: '',
    subSubType: '',
    voc: ''
  });

  // State for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 50; // Match the default limit in the server
  
  // Define an interface for audio file with proper typing
  interface AudioFile {
    id: number;
    filename: string;
    status: AudioFileStatus;
    language: string;
    duration?: number;
    version: string;
    size?: number;
    created_at: string;
    callMetrics?: {
      callId?: string;
      callType?: string;
      callDate?: string;
      agentId?: string;
      OLMSID?: string;
      Name?: string;
      PBXID?: string;
      partnerName?: string;
      customerMobile?: string;
      callDuration?: string;
      subType?: string;
      subSubType?: string;
      VOC?: string;
      languageOfCall?: string;
      userRole?: string;
      advisorCategory?: string;
      businessSegment?: string;
      LOB?: string;
      formName?: string;
      auditRole?: string;
      [key: string]: any;
    };
    [key: string]: any;
  }

  // State for view details dialog
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<AudioFile | null>(null);

  // Query for fetching audio files
  const { data: audioFilesResponse, isLoading, refetch } = useQuery({
    queryKey: ['/api/organizations/' + user?.organizationId + '/audio-files', filters, currentPage],
    queryFn: async () => {
      const endpoint = `/api/organizations/${user?.organizationId}/audio-files?page=${currentPage}&limit=${pageSize}`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch audio files');
      }
      return response.json();
    },
    enabled: !!user?.organizationId,
  });

  // Extract the actual files array and pagination info
  const audioFiles = audioFilesResponse?.files || [];
  
  // Update pagination state when data changes
  useEffect(() => {
    if (audioFilesResponse?.pagination) {
      setTotalFiles(audioFilesResponse.pagination.total);
      setTotalPages(audioFilesResponse.pagination.pages);
    }
  }, [audioFilesResponse]);

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest('POST', '/api/audio-files/upload', formData);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Audio file uploaded successfully',
      });
      setUploadDialogOpen(false);
      setFile(null);
      setFileData({
        language: 'english',
        version: '',
        callMetrics: {
          callDate: new Date().toISOString().split('T')[0],
          callId: '',
          callType: 'inbound',
          agentId: '',
          customerSatisfaction: 0,
          handleTime: 0,
          // New fields from requirements
          auditRole: '',
          OLMSID: '',
          Name: '',
          PBXID: '',
          partnerName: '',
          customerMobile: '',
          callDuration: '',
          subType: '',
          subSubType: '',
          VOC: '',
          languageOfCall: 'english',
          userRole: '',
          advisorCategory: '',
          businessSegment: '',
          LOB: '',
          formName: ''
        }
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to upload audio file: ${error.toString()}`,
        variant: 'destructive',
      });
    }
  });
  
  // Batch upload mutation
  const batchUploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest('POST', '/api/audio-files/batch-upload', formData);
      const responseData = await response.json();
      return responseData as { success: number; failed: number; failedFiles?: { originalFilename: string; error: string }[] };
    },
    onSuccess: (data: { success: number; failed: number; failedFiles?: { originalFilename: string; error: string }[] }) => {
      toast({
        title: 'Success',
        description: `Successfully uploaded ${data.success} audio files${data.failed > 0 ? `, ${data.failed} failed` : ''}.`,
      });
      
      // Show more detailed errors if files failed
      if (data.failedFiles && data.failedFiles.length > 0) {
        const failureReasons = data.failedFiles.map((file) => 
          `${file.originalFilename}: ${file.error}`
        ).join('\n');
        
        console.error('Failed files details:', failureReasons);
        
        if (data.failedFiles.length <= 3) {
          // Show toast with details for a few failures
          toast({
            variant: 'destructive',
            title: 'Some files failed to upload',
            description: data.failedFiles.map((file) => 
              `${file.originalFilename}: ${file.error}`
            ).join(', '),
          });
        } else {
          // For many failures, just show a summary
          toast({
            variant: 'destructive',
            title: 'Some files failed to upload',
            description: `${data.failedFiles.length} files failed. Check console for details.`,
          });
        }
      }
      
      setBatchUploadDialogOpen(false);
      setUploadAudioFiles([]);
      setMetadataFile(null);
      refetch();
    },
    onError: (error: any) => {
      // More helpful error message
      let errorMessage = error.toString();
      
      // Extract a more useful message from the error if available
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
      }
      
      console.error('Batch upload error:', error);
      
      toast({
        title: 'Error',
        description: `Failed to upload: ${errorMessage}`,
        variant: 'destructive',
      });
    }
  });

  // Update file status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      return apiRequest('PATCH', `/api/audio-files/${id}`, { status });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Audio file status updated successfully',
      });
      refetch();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: `Failed to update audio file status: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };
  
  const handleAudioFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadAudioFiles(Array.from(e.target.files));
    }
  };
  
  const handleMetadataFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMetadataFile(e.target.files[0]);
    }
  };
  
  const handleViewDetails = (audioFile: AudioFile) => {
    setSelectedFile(audioFile);
    setViewDetailsOpen(true);
  };

  const handleUploadSubmit = () => {
    if (!file) {
      toast({
        title: 'Error',
        description: 'Please select a file to upload',
        variant: 'destructive',
      });
      return;
    }

    if (!fileData.version) {
      toast({
        title: 'Error',
        description: 'Please provide a version',
        variant: 'destructive',
      });
      return;
    }

    // Process ID check has been removed - server will handle the default process ID if needed

    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', fileData.language);
    formData.append('version', fileData.version);
    formData.append('callMetrics', JSON.stringify(fileData.callMetrics));
    formData.append('organizationId', user?.organizationId?.toString() || '');
    // Use a default process ID value since processId might not exist on user
    formData.append('processId', '1');
    
    uploadFileMutation.mutate(formData);
  };
  
  const handleBatchUploadSubmit = async () => {
    if (uploadAudioFiles.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one audio file to upload',
        variant: 'destructive',
      });
      return;
    }

    if (!metadataFile) {
      toast({
        title: 'Error',
        description: 'Please upload an Excel file with metadata',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Create FormData to send both audio files and metadata Excel file
      const formData = new FormData();
      
      // Based on server implementation, add all audio files to audioFiles[] field
      uploadAudioFiles.forEach((audioFile) => {
        formData.append('audioFiles', audioFile);
      });
      
      // Add the Excel file to metadataFile field
      formData.append('metadataFile', metadataFile);
      
      // Upload the batch directly - server will handle Excel parsing
      batchUploadMutation.mutate(formData);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    setFilters({
      language: 'all',
      version: '',
      status: 'any',
      duration: 'any',
      callType: 'all',
      agentId: '',
      campaignName: '',
      callDate: '',
      disposition1: '',
      disposition2: '',
      queryType: '',
      businessSegment: '',
      customerMobile: '',
      callTime: '',
      subType: '',
      subSubType: '',
      voc: ''
    });
  };

  const getFilteredAudioFiles = () => {
    if (!audioFiles || !Array.isArray(audioFiles)) return [];

    // Explicitly cast audioFiles to an array type to satisfy TypeScript
    let filteredFiles = [...(audioFiles as AudioFile[])];
    
    // Apply tab filter
    if (activeTab !== 'all') {
      filteredFiles = filteredFiles.filter(file => file.status === activeTab);
    }
    
    // Apply additional filters
    if (filters.language && filters.language !== 'all') {
      filteredFiles = filteredFiles.filter(file => file.language === filters.language);
    }
    
    if (filters.version) {
      filteredFiles = filteredFiles.filter(file => file.version === filters.version);
    }
    
    if (filters.status && filters.status !== 'any') {
      filteredFiles = filteredFiles.filter(file => file.status === filters.status);
    }
    
    if (filters.duration && filters.duration !== 'any') {
      // Apply duration filter based on the selected range
      const durationValue = parseInt(filters.duration);
      if (durationValue === 60) {
        // Less than 1 minute
        filteredFiles = filteredFiles.filter(file => file.duration < 60);
      } else if (durationValue === 180) {
        // 1-3 minutes
        filteredFiles = filteredFiles.filter(file => file.duration >= 60 && file.duration <= 180);
      } else if (durationValue === 300) {
        // 3-5 minutes
        filteredFiles = filteredFiles.filter(file => file.duration > 180 && file.duration <= 300);
      } else if (durationValue === 999) {
        // More than 5 minutes
        filteredFiles = filteredFiles.filter(file => file.duration > 300);
      }
    }

    // Apply filters for call metrics
    if (filters.callType && filters.callType !== 'all') {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.callType?.toLowerCase() === filters.callType.toLowerCase()
      );
    }

    if (filters.agentId) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.agentId?.toLowerCase().includes(filters.agentId.toLowerCase())
      );
    }

    if (filters.campaignName) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.campaignName?.toLowerCase().includes(filters.campaignName.toLowerCase())
      );
    }

    if (filters.callDate) {
      filteredFiles = filteredFiles.filter(file => 
        file.call_date === filters.callDate
      );
    }

    if (filters.disposition1) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.disposition1?.toLowerCase().includes(filters.disposition1.toLowerCase())
      );
    }

    if (filters.disposition2) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.disposition2?.toLowerCase().includes(filters.disposition2.toLowerCase())
      );
    }

    if (filters.queryType) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.queryType?.toLowerCase().includes(filters.queryType.toLowerCase())
      );
    }

    if (filters.businessSegment) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.businessSegment?.toLowerCase().includes(filters.businessSegment.toLowerCase())
      );
    }
    
    if (filters.customerMobile) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.customerMobile?.toLowerCase().includes(filters.customerMobile.toLowerCase())
      );
    }
    
    if (filters.callTime) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.callTime === filters.callTime
      );
    }
    
    if (filters.subType) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.subType?.toLowerCase().includes(filters.subType.toLowerCase())
      );
    }
    
    if (filters.subSubType) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.subSubType?.toLowerCase().includes(filters.subSubType.toLowerCase())
      );
    }
    
    if (filters.voc) {
      filteredFiles = filteredFiles.filter(file => 
        file.callMetrics?.voc?.toLowerCase().includes(filters.voc.toLowerCase())
      );
    }

    return filteredFiles;
  };

  const filteredAudioFiles = getFilteredAudioFiles();

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Audio File Management</h1>
      
      <div className="flex justify-between mb-6">
        <div className="flex space-x-2">
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!hasPermission('manage_allocation')}>
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload Audio File
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Audio File</DialogTitle>
                <DialogDescription>
                  Upload a single audio file with metadata
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="audio-file">Audio File</Label>
                  <Input 
                    id="audio-file" 
                    type="file" 
                    accept="audio/*" 
                    onChange={handleFileChange} 
                  />
                  {file && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {file.name}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="language">Language</Label>
                    <Select 
                      value={fileData.language} 
                      onValueChange={(value) => setFileData({...fileData, language: value})}
                    >
                      <SelectTrigger id="language">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="spanish">Spanish</SelectItem>
                        <SelectItem value="french">French</SelectItem>
                        <SelectItem value="hindi">Hindi</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="version">Version</Label>
                    <Input 
                      id="version" 
                      placeholder="Version" 
                      value={fileData.version}
                      onChange={(e) => setFileData({...fileData, version: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label>Call Metrics</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="callDate">Call Date</Label>
                      <Input 
                        id="callDate" 
                        type="date"
                        value={fileData.callMetrics.callDate}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            callDate: e.target.value
                          }
                        })}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="callId">Call ID</Label>
                      <Input 
                        id="callId" 
                        placeholder="Call ID"
                        value={fileData.callMetrics.callId}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            callId: e.target.value
                          }
                        })}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="callType">Call Type</Label>
                      <Select 
                        value={fileData.callMetrics.callType} 
                        onValueChange={(value) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            callType: value
                          }
                        })}
                      >
                        <SelectTrigger id="callType">
                          <SelectValue placeholder="Select call type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inbound">Inbound</SelectItem>
                          <SelectItem value="outbound">Outbound</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="agentId">Agent ID</Label>
                      <Input 
                        id="agentId" 
                        placeholder="Agent ID"
                        value={fileData.callMetrics.agentId}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            agentId: e.target.value
                          }
                        })}
                      />
                    </div>
                  </div>

                  {/* New Metadata Fields */}
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="grid gap-2">
                      <Label htmlFor="OLMSID">OLMSID</Label>
                      <Input 
                        id="OLMSID" 
                        placeholder="Unique ID for agent/system"
                        value={fileData.callMetrics.OLMSID}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            OLMSID: e.target.value
                          }
                        })}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="Name">Agent Name</Label>
                      <Input 
                        id="Name" 
                        placeholder="Name of agent being evaluated"
                        value={fileData.callMetrics.Name}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            Name: e.target.value
                          }
                        })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="PBXID">PBX ID</Label>
                      <Input 
                        id="PBXID" 
                        placeholder="Unique telephony ID"
                        value={fileData.callMetrics.PBXID}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            PBXID: e.target.value
                          }
                        })}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="partnerName">Partner Name</Label>
                      <Input 
                        id="partnerName" 
                        placeholder="Partner/Client name"
                        value={fileData.callMetrics.partnerName}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            partnerName: e.target.value
                          }
                        })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="customerMobile">Customer Mobile</Label>
                      <Input 
                        id="customerMobile" 
                        placeholder="Customer mobile number"
                        value={fileData.callMetrics.customerMobile}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            customerMobile: e.target.value
                          }
                        })}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="callDuration">Call Duration</Label>
                      <Input 
                        id="callDuration" 
                        placeholder="Duration of the call"
                        value={fileData.callMetrics.callDuration}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            callDuration: e.target.value
                          }
                        })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="subType">Sub Type</Label>
                      <Input 
                        id="subType" 
                        placeholder="Call sub-type classification"
                        value={fileData.callMetrics.subType}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            subType: e.target.value
                          }
                        })}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="subSubType">Sub-Sub Type</Label>
                      <Input 
                        id="subSubType" 
                        placeholder="Further call granularity"
                        value={fileData.callMetrics.subSubType}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            subSubType: e.target.value
                          }
                        })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="VOC">VOC</Label>
                      <Input 
                        id="VOC" 
                        placeholder="Voice of Customer"
                        value={fileData.callMetrics.VOC}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            VOC: e.target.value
                          }
                        })}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="languageOfCall">Language of Call</Label>
                      <Select 
                        value={fileData.callMetrics.languageOfCall || "english"} 
                        onValueChange={(value) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            languageOfCall: value
                          }
                        })}
                      >
                        <SelectTrigger id="languageOfCall">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="english">English</SelectItem>
                          <SelectItem value="spanish">Spanish</SelectItem>
                          <SelectItem value="french">French</SelectItem>
                          <SelectItem value="german">German</SelectItem>
                          <SelectItem value="portuguese">Portuguese</SelectItem>
                          <SelectItem value="hindi">Hindi</SelectItem>
                          <SelectItem value="mandarin">Mandarin</SelectItem>
                          <SelectItem value="japanese">Japanese</SelectItem>
                          <SelectItem value="korean">Korean</SelectItem>
                          <SelectItem value="arabic">Arabic</SelectItem>
                          <SelectItem value="russian">Russian</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="userRole">User Role</Label>
                      <Input 
                        id="userRole" 
                        placeholder="User's role"
                        value={fileData.callMetrics.userRole}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            userRole: e.target.value
                          }
                        })}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="advisorCategory">Advisor Category</Label>
                      <Input 
                        id="advisorCategory" 
                        placeholder="E.g., Challenger, Performer"
                        value={fileData.callMetrics.advisorCategory}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            advisorCategory: e.target.value
                          }
                        })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="businessSegment">Business Segment</Label>
                      <Input 
                        id="businessSegment" 
                        placeholder="E.g., Care, Tech Support"
                        value={fileData.callMetrics.businessSegment}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            businessSegment: e.target.value
                          }
                        })}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="LOB">Line of Business</Label>
                      <Input 
                        id="LOB" 
                        placeholder="E.g., Prepaid"
                        value={fileData.callMetrics.LOB}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            LOB: e.target.value
                          }
                        })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="formName">Form Name</Label>
                      <Input 
                        id="formName" 
                        placeholder="Select form for evaluation"
                        value={fileData.callMetrics.formName}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            formName: e.target.value
                          }
                        })}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="auditRole">Audit Role</Label>
                      <Input 
                        id="auditRole" 
                        placeholder="Auditor role"
                        value={fileData.callMetrics.auditRole}
                        onChange={(e) => setFileData({
                          ...fileData, 
                          callMetrics: {
                            ...fileData.callMetrics,
                            auditRole: e.target.value
                          }
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUploadSubmit}
                  disabled={uploadFileMutation.isPending}
                >
                  {uploadFileMutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
                  Upload
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Dialog open={batchUploadDialogOpen} onOpenChange={setBatchUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" disabled={!hasPermission('manage_allocation')}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Batch Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Batch Upload Audio Files</DialogTitle>
                <DialogDescription>
                  Upload multiple audio files with an Excel metadata file
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="audio-files">Audio Files</Label>
                  <Input 
                    id="audio-files" 
                    type="file" 
                    multiple 
                    accept="audio/*" 
                    onChange={handleAudioFilesChange} 
                  />
                  {uploadAudioFiles.length > 0 && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {uploadAudioFiles.length} audio files selected
                    </div>
                  )}
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="metadata-file">Excel Metadata File</Label>
                  <Input 
                    id="metadata-file" 
                    type="file" 
                    accept=".xlsx,.xls,.csv" 
                    onChange={handleMetadataFileChange} 
                  />
                  {metadataFile && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {metadataFile.name}
                    </div>
                  )}
                </div>
                
                <Alert>
                  <AlertDescription>
                    <div className="flex items-center">
                      <Download className="mr-2 h-4 w-4" />
                      <a 
                        href="/api/templates/audio-metadata" 
                        target="_blank"
                        className="text-blue-500 hover:underline"
                      >
                        Download metadata template
                      </a>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setBatchUploadDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleBatchUploadSubmit}
                  disabled={batchUploadMutation.isPending}
                >
                  {batchUploadMutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
                  Upload Batch
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {hasPermission('manage_allocation') && (
            <Button variant="outline" asChild>
              <a href="/azure-storage-browser">
                <FilePlus className="mr-2 h-4 w-4" />
                Import from Azure
              </a>
            </Button>
          )}
        </div>
        
        <Collapsible className="w-[320px]">
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full flex justify-between">
              <div className="flex items-center">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </div>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="filter-language">Language</Label>
                <Select 
                  value={filters.language} 
                  onValueChange={(value) => handleFilterChange('language', value)}
                >
                  <SelectTrigger id="filter-language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Languages</SelectItem>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="spanish">Spanish</SelectItem>
                    <SelectItem value="french">French</SelectItem>
                    <SelectItem value="hindi">Hindi</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="filter-status">Status</Label>
                <Select 
                  value={filters.status} 
                  onValueChange={(value) => handleFilterChange('status', value)}
                >
                  <SelectTrigger id="filter-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="allocated">Allocated</SelectItem>
                    <SelectItem value="evaluated">Evaluated</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="filter-callType">Call Type</Label>
                <Select 
                  value={filters.callType} 
                  onValueChange={(value) => handleFilterChange('callType', value)}
                >
                  <SelectTrigger id="filter-callType">
                    <SelectValue placeholder="Select call type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="filter-duration">Duration</Label>
                <Select 
                  value={filters.duration} 
                  onValueChange={(value) => handleFilterChange('duration', value)}
                >
                  <SelectTrigger id="filter-duration">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Duration</SelectItem>
                    <SelectItem value="60">Less than 1 min</SelectItem>
                    <SelectItem value="180">1-3 min</SelectItem>
                    <SelectItem value="300">3-5 min</SelectItem>
                    <SelectItem value="999">More than 5 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="filter-agentId">Agent ID</Label>
              <Input
                id="filter-agentId"
                placeholder="Filter by agent ID"
                value={filters.agentId}
                onChange={(e) => handleFilterChange('agentId', e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="filter-version">Version</Label>
              <Input
                id="filter-version"
                placeholder="Filter by version"
                value={filters.version}
                onChange={(e) => handleFilterChange('version', e.target.value)}
              />
            </div>
            
            <Button onClick={resetFilters} variant="outline" className="w-full">
              Reset Filters
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </div>
      
      <Tabs 
        defaultValue="all" 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="allocated">Allocated</TabsTrigger>
          <TabsTrigger value="evaluated">Evaluated</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Audio Files</CardTitle>
              <CardDescription>
                {activeTab === 'all' ? 'All audio files' : 
                 `Audio files with ${activeTab} status`}
                {filteredAudioFiles ? ` (${filteredAudioFiles.length})` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : filteredAudioFiles && filteredAudioFiles.length > 0 ? (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Filename</TableHead>
                        <TableHead>Language</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAudioFiles.map((audioFile: any) => (
                        <TableRow key={audioFile.id}>
                          <TableCell className="font-medium">
                            {audioFile.filename}
                          </TableCell>
                          <TableCell>{audioFile.language}</TableCell>
                          <TableCell>{audioFile.version}</TableCell>
                          <TableCell>
                            {audioFile.duration ? formatDuration(audioFile.duration) : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[audioFile.status as AudioFileStatus] || ''}>
                              {audioFile.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {audioFile.createdAt ? (
                              <div className="flex items-center">
                                <Clock className="mr-1 h-3 w-3 text-muted-foreground" />
                                <span title={new Date(audioFile.createdAt).toLocaleString()}>
                                  {formatDistanceToNow(new Date(audioFile.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                            ) : (
                              'N/A'
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                size="sm"
                                variant="outline"
                                className="h-8"
                                asChild
                              >
                                <a 
                                  href={`/api/audio-files/${audioFile.id}/download`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Download
                                </a>
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => handleViewDetails(audioFile)}
                              >
                                <Info className="h-4 w-4 mr-1" />
                                View Details
                              </Button>
                              
                              {audioFile.status === 'pending' && (
                                <Button
                                  size="sm"
                                  className="h-8"
                                  variant="outline"
                                  onClick={() => updateStatusMutation.mutate({ id: audioFile.id, status: 'allocated' })}
                                >
                                  Allocate
                                </Button>
                              )}
                              
                              {audioFile.status === 'allocated' && (
                                <Button
                                  size="sm"
                                  className="h-8"
                                  variant="outline"
                                  onClick={() => updateStatusMutation.mutate({ id: audioFile.id, status: 'evaluated' })}
                                >
                                  Mark Evaluated
                                </Button>
                              )}
                              
                              {(audioFile.status === 'pending' || audioFile.status === 'allocated') && (
                                <Button
                                  size="sm"
                                  className="h-8"
                                  variant="outline"
                                  onClick={() => updateStatusMutation.mutate({ id: audioFile.id, status: 'archived' })}
                                >
                                  Archive
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Showing page {currentPage} of {totalPages} ({totalFiles} total files)
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileAudio className="mx-auto h-12 w-12 mb-4 text-muted-foreground/50" />
                  <p>No audio files found</p>
                  <p className="text-sm">Upload audio files to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* View Details Dialog */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Audio File Details</DialogTitle>
            <DialogDescription>
              Complete metadata information for the selected audio file
            </DialogDescription>
          </DialogHeader>
          
          {selectedFile && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div>
                  <h3 className="font-semibold">File Information</h3>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="text-sm text-muted-foreground">Filename:</div>
                    <div className="text-sm font-medium">{selectedFile.filename}</div>
                    
                    <div className="text-sm text-muted-foreground">Duration:</div>
                    <div className="text-sm font-medium">
                      {selectedFile.duration ? formatDuration(selectedFile.duration) : 'N/A'}
                    </div>
                    
                    <div className="text-sm text-muted-foreground">Language:</div>
                    <div className="text-sm font-medium capitalize">{selectedFile.language}</div>
                    
                    <div className="text-sm text-muted-foreground">Status:</div>
                    <div className="text-sm font-medium">
                      <Badge variant="outline" className={statusColors[selectedFile.status as AudioFileStatus] || ''}>
                        {selectedFile.status}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">Uploaded At:</div>
                    <div className="text-sm font-medium">
                      {new Date(selectedFile.created_at).toLocaleString()}
                    </div>
                    
                    <div className="text-sm text-muted-foreground">Size:</div>
                    <div className="text-sm font-medium">
                      {selectedFile.size ? Math.round(selectedFile.size / 1024) + ' KB' : 'N/A'}
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold">Call Information</h3>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="text-sm text-muted-foreground">Call ID:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.callId || 'N/A'}</div>
                    
                    <div className="text-sm text-muted-foreground">Call Type:</div>
                    <div className="text-sm font-medium capitalize">{selectedFile.callMetrics?.callType || 'N/A'}</div>
                    
                    <div className="text-sm text-muted-foreground">Call Date:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.callDate || 'N/A'}</div>
                    
                    <div className="text-sm text-muted-foreground">Agent ID:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.agentId || 'N/A'}</div>
                    
                    <div className="text-sm text-muted-foreground">PBX ID:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.PBXID || 'N/A'}</div>
                    
                    <div className="text-sm text-muted-foreground">OLMS ID:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.OLMSID || 'N/A'}</div>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Extended Metadata</h3>
                <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                  <div>
                    <div className="text-sm text-muted-foreground">Name:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.Name || 'N/A'}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Partner Name:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.partnerName || 'N/A'}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Customer Mobile:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.customerMobile || 'N/A'}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Language of Call:</div>
                    <div className="text-sm font-medium capitalize">{selectedFile.callMetrics?.languageOfCall || 'N/A'}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Call Duration:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.callDuration || 'N/A'}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Sub Type:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.subType || 'N/A'}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Sub-Sub Type:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.subSubType || 'N/A'}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">VOC:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.VOC || 'N/A'}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">User Role:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.userRole || 'N/A'}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Advisor Category:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.advisorCategory || 'N/A'}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Business Segment:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.businessSegment || 'N/A'}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">LOB:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.LOB || 'N/A'}</div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Form Name:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.formName || 'N/A'}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Audit Role:</div>
                    <div className="text-sm font-medium">{selectedFile.callMetrics?.auditRole || 'N/A'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDetailsOpen(false)}>Close</Button>
            <Button 
              asChild
              variant="default"
            >
              <a 
                href={selectedFile ? `/api/audio-files/${selectedFile.id}/download` : '#'} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Download className="h-4 w-4 mr-1" />
                Download Audio
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const PermissionGuardedAudioFileManagement = () => {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission('view_allocation')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <h2 className="text-2xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground mb-4">
          You do not have permission to access the Audio File Management.
        </p>
        <Button asChild variant="outline">
          <a href="/">Return to Dashboard</a>
        </Button>
      </div>
    );
  }
  
  return <AudioFileManagement />;
};

export default PermissionGuardedAudioFileManagement;