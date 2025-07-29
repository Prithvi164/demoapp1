import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { 
  Loader2, 
  RefreshCw, 
  FolderOpen, 
  File, 
  Upload, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Calendar,
  FileDown,
  FileSpreadsheet,
  FileText,
  ArrowLeft,
  Folder,
  Download,
  X,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { MultiSelect } from '@/components/ui/multi-select';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Popover and Command imports removed as they're no longer needed
import { cn } from "@/lib/utils";

// Types
interface Container {
  name: string;
  properties: {
    lastModified: string;
    etag: string;
    leaseStatus: string;
    leaseState: string;
    [key: string]: any;
  };
}

interface BlobItem {
  name: string;
  properties: {
    createdOn: string;
    lastModified: string;
    contentLength: number;
    contentType: string;
    [key: string]: any;
  };
}

// Process interface removed as it's no longer needed

interface QualityAnalyst {
  id: number;
  fullName: string;
}

const AzureStorageBrowser = () => {
  const { containerName } = useParams<{ containerName?: string }>();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [selectedContainer, setSelectedContainer] = useState<string | null>(containerName || null);
  const [selectedBlobItems, setSelectedBlobItems] = useState<string[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEvaluationTemplate, setSelectedEvaluationTemplate] = useState<string>('');
  // folderSelectMode removed as per user request
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  
  // Delete confirmation dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Filter states for import
  const [showFilters, setShowFilters] = useState(false);
  const [fileNameFilter, setFileNameFilter] = useState<string[]>([]);
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  const [minDuration, setMinDuration] = useState<string>('');
  const [maxDuration, setMaxDuration] = useState<string>('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  // New filter states for the requested metadata fields - all switched to array for multiple values
  const [partnerNameFilter, setPartnerNameFilter] = useState<string[]>([]);
  const [callTypeFilter, setCallTypeFilter] = useState<string[]>([]);
  const [vocFilter, setVocFilter] = useState<string[]>([]);
  const [campaignFilter, setCampaignFilter] = useState<string[]>([]);
  const [filterCounts, setFilterCounts] = useState<{total: number, filtered: number} | null>(null);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  
  // QA Assignment state
  const [selectedQAs, setSelectedQAs] = useState<string[]>([]);
  const [qaMaxAssignments, setQaMaxAssignments] = useState<Record<string, number>>({});
  
  // Track active filters for filter chips
  const [activeFilters, setActiveFilters] = useState<Array<{
    id: string;
    label: string;
    value: string | string[];
    setter: ((value: string) => void) | (() => void) | React.Dispatch<React.SetStateAction<string[]>>;
  }>>([]);
  
  // Filter functions are defined later in the component
  
  const ITEMS_PER_PAGE = 5;
  
  const { toast } = useToast();

  // Handle container name from URL params
  useEffect(() => {
    if (containerName) {
      console.log(`Container name received from URL: ${containerName}`);
      setSelectedContainer(containerName);
    }
  }, [containerName]);

  // Fetch containers
  const { 
    data: containers, 
    isLoading: isLoadingContainers,
    refetch: refetchContainers
  } = useQuery({
    queryKey: ['/api/azure-containers'],
    refetchOnWindowFocus: false,
  });

  // Fetch folders within a container
  const {
    data: folderList,
    isLoading: isLoadingFolders,
    refetch: refetchFolders
  } = useQuery({
    queryKey: ['/api/azure-folders', selectedContainer],
    queryFn: async () => {
      if (!selectedContainer) return [];
      console.log(`Fetching folders for container: ${selectedContainer}`);
      const response = await apiRequest('GET', `/api/azure-folders/${selectedContainer}`);
      const data = await response.json();
      console.log('Folder response:', data);
      
      // Update the folders state
      if (data && Array.isArray(data)) {
        setFolders(data);
      }
      
      return data;
    },
    enabled: !!selectedContainer && !selectedFolder,
    refetchOnWindowFocus: false
  });

  // Fetch blobs for selected container, optionally filtered by folder
  const { 
    data: blobs, 
    isLoading: isLoadingBlobs,
    refetch: refetchBlobs 
  } = useQuery({
    queryKey: ['/api/azure-blobs', selectedContainer, selectedFolder],
    queryFn: async () => {
      if (!selectedContainer) return [];
      
      let url = `/api/azure-blobs/${selectedContainer}`;
      if (selectedFolder) {
        url += `?folderPath=${encodeURIComponent(selectedFolder)}`;
      }
      
      console.log(`Fetching blobs for container: ${selectedContainer}${selectedFolder ? `, folder: ${selectedFolder}` : ''}`);
      const response = await apiRequest('GET', url);
      const data = await response.json();
      console.log('Blob response:', data);
      return data;
    },
    enabled: !!selectedContainer,
    refetchOnWindowFocus: false,
  });

  // Process fetching logic removed as per user request

  // Delete files mutation
  const deleteFilesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedContainer || selectedBlobItems.length === 0) {
        return false;
      }
      
      console.log(`Deleting ${selectedBlobItems.length} files from container ${selectedContainer}`);
      setIsDeleting(true);
      
      try {
        const response = await apiRequest('DELETE', `/api/azure-blobs/${selectedContainer}`, {
          blobNames: selectedBlobItems
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.message || 'Failed to delete files');
        }
        
        return true;
      } finally {
        setIsDeleting(false);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Files Deleted',
        description: `Successfully deleted ${selectedBlobItems.length} files.`,
      });
      
      // Clear selection and refresh blobs
      setSelectedBlobItems([]);
      refetchBlobs();
      queryClient.invalidateQueries({
        queryKey: ['/api/azure-blobs', selectedContainer, selectedFolder],
      });
      
      // Close the dialog
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete selected files',
        variant: 'destructive',
      });
    }
  });
  
  // Handle file selection
  const handleBlobSelection = (blobName: string) => {
    setSelectedBlobItems(prev => {
      if (prev.includes(blobName)) {
        return prev.filter(name => name !== blobName);
      } else {
        return [...prev, blobName];
      }
    });
  };
  
  // Handle select all blobs
  const handleSelectAllBlobs = () => {
    if (!blobs || !Array.isArray(blobs)) return;
    
    const allSelected = blobs.every(blob => selectedBlobItems.includes(blob.name));
    
    if (allSelected) {
      // If all are selected, deselect all
      setSelectedBlobItems([]);
    } else {
      // If some or none are selected, select all
      setSelectedBlobItems(blobs.map(blob => blob.name));
    }
  };

  // Handle file deletion
  const handleDeleteFiles = () => {
    if (!selectedContainer) {
      toast({
        title: 'No Container Selected',
        description: 'Please select a container first.',
        variant: 'destructive',
      });
      return;
    }
    
    if (selectedBlobItems.length === 0) {
      toast({
        title: 'No Files Selected',
        description: 'Please select at least one file to delete.',
        variant: 'destructive',
      });
      return;
    }
    
    // Open the confirmation dialog
    setIsDeleteDialogOpen(true);
  };
  
  // Confirm file deletion
  const confirmDeleteFiles = () => {
    deleteFilesMutation.mutate();
  };

  // Fetch quality analysts for allocation
  const { data: qualityAnalysts } = useQuery<QualityAnalyst[]>({
    queryKey: ['/api/users/quality-analysts'],
    refetchOnWindowFocus: false,
  });
  
  // Fetch evaluation templates
  const { data: evaluationTemplates } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
    enabled: !!user?.organizationId,
    refetchOnWindowFocus: false,
  });

  // Handle container selection
  const handleContainerClick = (containerName: string) => {
    setSelectedContainer(containerName);
    setSelectedBlobItems([]);
    setSelectedFolder(null);
    // folderSelectMode removed as per user request
  };
  
  // Handle folder selection
  const handleFolderClick = (folderName: string) => {
    setSelectedFolder(folderName);
    setSelectedBlobItems([]);
  };
  
  // Handle download of all filenames in the current container/folder
  const handleDownloadFilenames = () => {
    if (!selectedContainer) {
      toast({
        title: "No Container Selected",
        description: "Please select a container first to download its filenames.",
        variant: "destructive",
      });
      return;
    }
    
    if (!blobs || !Array.isArray(blobs) || blobs.length === 0) {
      toast({
        title: "No Files Found",
        description: "There are no files to download filenames for.",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content with headers
    let csvContent = "filename\n";
    
    // Add all blob names to the CSV
    blobs.forEach((blob: BlobItem) => {
      csvContent += `${blob.name}\n`;
    });
    
    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedContainer}${selectedFolder ? `-${selectedFolder}` : ''}-filenames.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast({
      title: 'Filenames Downloaded',
      description: `${blobs.length} filenames have been downloaded as CSV.`,
    });
  };
  
  // Handle back button to return from folder to container view
  const handleBackToContainer = () => {
    setSelectedFolder(null);
  };
  
  // Download standard metadata template
  const handleDownloadTemplate = async () => {
    console.log('Starting metadata template download...');
    toast({
      title: 'Downloading Template',
      description: 'Requesting template from server...',
    });
    
    try {
      // Use the direct API endpoint to download the metadata template with all fields
      console.log('Fetching from /api/azure-metadata-template');
      const response = await fetch('/api/azure-metadata-template');
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Download error details:', errorText);
        throw new Error(`Failed to download metadata template: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('Received blob:', blob.type, blob.size, 'bytes');
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audio-file-metadata-template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Template Downloaded',
        description: 'Complete metadata template with all required fields has been downloaded successfully.',
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download metadata template',
        variant: 'destructive',
      });
    }
  };
  
  // Download custom template with filenames from current Azure container
  const handleDownloadCustomTemplate = async () => {
    if (!selectedContainer) {
      toast({
        title: 'No Container Selected',
        description: 'Please select a container first to download a custom template.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Use the direct API endpoint that generates a template with actual filenames
      const response = await fetch(`/api/azure-custom-template/${selectedContainer}`);
      
      if (!response.ok) {
        throw new Error('Failed to download custom template');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedContainer}-template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Custom Template Downloaded',
        description: `Custom template with your actual filenames from ${selectedContainer} has been downloaded.`,
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download custom template',
        variant: 'destructive',
      });
    }
  };
  
  // Download minimal template with essential fields only
  const handleDownloadMinimalTemplate = async () => {
    try {
      // Use the direct API endpoint for minimal template
      const response = await fetch('/api/azure-minimal-template');
      
      if (!response.ok) {
        throw new Error('Failed to download minimal template');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'minimal-audio-template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Minimal Template Downloaded',
        description: 'Minimal template with just the essential fields has been downloaded.',
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download minimal template',
        variant: 'destructive',
      });
    }
  };
  
  // Download ultra-simple template with just one file
  const handleDownloadSimpleTemplate = async () => {
    if (!selectedContainer) {
      toast({
        title: 'No Container Selected',
        description: 'Please select a container first to download a simple template.',
        variant: 'destructive',
      });
      return;
    }
    
    // Show loading toast
    toast({
      title: 'Generating Template',
      description: 'Creating an ultra-simple template with just one file...',
    });
    
    try {
      // Use the direct API endpoint that generates a template with just one example file
      console.log(`Downloading simple template for container: ${selectedContainer}`);
      const response = await fetch(`/api/azure-simple-template/${selectedContainer}`);
      
      if (!response.ok) {
        // Try to get more detailed error information
        const errorData = await response.json().catch(() => null);
        console.error('Server response error:', response.status, errorData);
        throw new Error(errorData?.message || 'Failed to download ultra-simple template');
      }
      
      // Check if we got an Excel file (content type)
      const contentType = response.headers.get('content-type');
      console.log('Response content type:', contentType);
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedContainer}-simple-template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Ultra-Simple Template Downloaded',
        description: 'A template with just one file from your container has been downloaded.',
      });
    } catch (error) {
      console.error('Error downloading ultra-simple template:', error);
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download ultra-simple template',
        variant: 'destructive',
      });
    }
  };

  // Download the static pre-generated ultra-simple template file
  const handleDownloadStaticTemplate = async () => {
    try {
      console.log('Downloading static ultra-simple template');
      // This is the pre-generated file we put in the public folder
      const response = await fetch('/ultra-simple-template.xlsx');
      
      if (!response.ok) {
        throw new Error('Failed to download static template file');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ultra-simple-template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Static Template Downloaded',
        description: 'Pre-generated ultra-simple template has been downloaded. This template should open in all Excel versions.',
      });
    } catch (error) {
      console.error('Error downloading static template:', error);
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Failed to download static template',
        variant: 'destructive',
      });
    }
  };
  
  // Download template guide
  const handleDownloadGuide = () => {
    // Use the public path for the template guide
    fetch('/audio-file-template-guide.md')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to download template guide');
        }
        return response.text();
      })
      .then(text => {
        // Create a Blob from the text
        const blob = new Blob([text], { type: 'text/markdown' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'audio-file-template-guide.md';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: 'Template Guide Downloaded',
          description: 'Template guide documentation has been downloaded.',
        });
      })
      .catch(error => {
        toast({
          title: 'Download Failed',
          description: error instanceof Error ? error.message : 'Failed to download template guide',
          variant: 'destructive',
        });
      });
  };

  // Blob selection is handled above
  
  // No details view needed

  // Apply filters to get counts before import
  const applyFilters = useMutation({
    mutationFn: async ({ containerName, metadataFile }: any) => {
      const formData = new FormData();
      formData.append('metadataFile', metadataFile);
      
      // Add filters if they exist - convert arrays to JSON for transport
      if (fileNameFilter.length > 0) formData.append('fileNameFilter', JSON.stringify(fileNameFilter));
      if (dateRangeStart) formData.append('dateRangeStart', dateRangeStart);
      if (dateRangeEnd) formData.append('dateRangeEnd', dateRangeEnd);
      if (minDuration) formData.append('minDuration', minDuration);
      if (maxDuration) formData.append('maxDuration', maxDuration);
      if (selectedLanguages.length > 0) formData.append('languages', JSON.stringify(selectedLanguages));
      
      // Add new filters for the metadata fields - all as arrays
      if (partnerNameFilter.length > 0) formData.append('partnerNameFilter', JSON.stringify(partnerNameFilter));
      if (callTypeFilter.length > 0) formData.append('callTypeFilter', JSON.stringify(callTypeFilter));
      if (vocFilter.length > 0) formData.append('vocFilter', JSON.stringify(vocFilter));
      if (campaignFilter.length > 0) formData.append('campaignFilter', JSON.stringify(campaignFilter));
      
      return apiRequest('POST', `/api/azure-audio-filter-preview/${containerName}`, formData);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setFilterCounts({
        total: data.total,
        filtered: data.filtered
      });
      
      // Extract available languages from the response
      if (data.availableLanguages && Array.isArray(data.availableLanguages)) {
        setAvailableLanguages(data.availableLanguages);
      }
      
      // Update active filters - first clear existing ones
      const newActiveFilters = [];
      
      // Add each active filter with its label, value, and setter function
      if (fileNameFilter.length > 0) {
        newActiveFilters.push({
          id: 'filename',
          label: 'Filename',
          value: fileNameFilter.join(', '),
          setter: () => setFileNameFilter([])
        });
      }
      
      if (partnerNameFilter.length > 0) {
        newActiveFilters.push({
          id: 'partner',
          label: 'Partner',
          value: partnerNameFilter.join(', '),
          setter: () => setPartnerNameFilter([])
        });
      }
      
      if (callTypeFilter.length > 0) {
        newActiveFilters.push({
          id: 'callType',
          label: 'Call Type',
          value: callTypeFilter.join(', '), 
          setter: () => setCallTypeFilter([])
        });
      }
      
      if (vocFilter.length > 0) {
        newActiveFilters.push({
          id: 'voc',
          label: 'VOC',
          value: vocFilter.join(', '),
          setter: () => setVocFilter([])
        });
      }
      
      if (campaignFilter.length > 0) {
        newActiveFilters.push({
          id: 'campaign',
          label: 'Campaign',
          value: campaignFilter.join(', '),
          setter: () => setCampaignFilter([])
        });
      }
      
      if (selectedLanguages.length > 0) {
        newActiveFilters.push({
          id: 'language',
          label: 'Language',
          value: selectedLanguages.map(lang => lang.charAt(0).toUpperCase() + lang.slice(1)).join(', '),
          setter: () => setSelectedLanguages([])
        });
      }
      
      if (dateRangeStart || dateRangeEnd) {
        const dateValue = `${dateRangeStart || 'Any'} to ${dateRangeEnd || 'Any'}`;
        newActiveFilters.push({
          id: 'dateRange',
          label: 'Date Range',
          value: dateValue,
          setter: () => {
            setDateRangeStart('');
            setDateRangeEnd('');
          }
        });
      }
      
      if (minDuration || maxDuration) {
        const durationValue = `${minDuration || '0'}s to ${maxDuration || '∞'}s`;
        newActiveFilters.push({
          id: 'duration',
          label: 'Duration',
          value: durationValue,
          setter: () => {
            setMinDuration('');
            setMaxDuration('');
          }
        });
      }
      
      // Set the active filters
      setActiveFilters(newActiveFilters);
    },
    onError: (error: any) => {
      toast({
        title: 'Filter preview failed',
        description: error.message || 'There was an error applying filters.',
        variant: 'destructive',
      });
      setFilterCounts(null);
    },
  });

  // Import audio files mutation
  const importAudioMutation = useMutation({
    mutationFn: async ({ containerName, metadataFile }: any) => {
      const formData = new FormData();
      formData.append('metadataFile', metadataFile);
      
      // Include evaluation template ID
      if (selectedEvaluationTemplate) {
        formData.append('evaluationTemplateId', selectedEvaluationTemplate);
      }
      
      // Add QA assignment data if selected
      if (selectedQAs.length > 0) {
        formData.append('selectedQualityAnalysts', JSON.stringify(selectedQAs));
        
        // Only send qaAssignmentCounts if there are actually values set
        if (Object.keys(qaMaxAssignments).length > 0) {
          formData.append('qaAssignmentCounts', JSON.stringify(qaMaxAssignments));
        }
      }
      
      // Add filter parameters if they exist - convert arrays to JSON for transport
      if (fileNameFilter.length > 0) formData.append('fileNameFilter', JSON.stringify(fileNameFilter));
      if (dateRangeStart) formData.append('dateRangeStart', dateRangeStart);
      if (dateRangeEnd) formData.append('dateRangeEnd', dateRangeEnd);
      if (minDuration) formData.append('minDuration', minDuration);
      if (maxDuration) formData.append('maxDuration', maxDuration);
      if (selectedLanguages.length > 0) formData.append('languages', JSON.stringify(selectedLanguages));
      
      // Add new metadata filters - all as arrays
      if (partnerNameFilter.length > 0) formData.append('partnerNameFilter', JSON.stringify(partnerNameFilter));
      if (callTypeFilter.length > 0) formData.append('callTypeFilter', JSON.stringify(callTypeFilter));
      if (vocFilter.length > 0) formData.append('vocFilter', JSON.stringify(vocFilter));
      if (campaignFilter.length > 0) formData.append('campaignFilter', JSON.stringify(campaignFilter));
      
      return apiRequest('POST', `/api/azure-audio-import/${containerName}`, formData);
    },
    onSuccess: () => {
      toast({
        title: 'Import successful',
        description: 'Audio files were successfully imported from Azure.',
      });
      setImportDialogOpen(false);
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/organizations/audio-files'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Import failed',
        description: error.message || 'There was an error importing audio files.',
        variant: 'destructive',
      });
    },
  });

  // Allocate function removed as requested

  // Remove a filter
  const removeFilter = (filterId: string) => {
    const filter = activeFilters.find(f => f.id === filterId);
    if (filter) {
      // For array-based state, we need to provide an empty array
      if (filterId === 'filename') {
        setFileNameFilter([]);
      } else if (filterId === 'partner') {
        setPartnerNameFilter([]);
      } else if (filterId === 'callType') {
        setCallTypeFilter([]);
      } else if (filterId === 'voc') {
        setVocFilter([]);
      } else if (filterId === 'campaign') {
        setCampaignFilter([]);
      } else if (filterId === 'language') {
        setSelectedLanguages([]);
      } else if (filterId === 'dateRange') {
        setDateRangeStart('');
        setDateRangeEnd('');
      } else if (filterId === 'duration') {
        setMinDuration('');
        setMaxDuration('');
      }
    }
    
    // Update active filters after removal
    setActiveFilters(prev => prev.filter(f => f.id !== filterId));
    
    // If we have a file uploaded, apply the filters automatically
    if (uploadFile && selectedContainer) {
      applyFilters.mutate({
        containerName: selectedContainer,
        metadataFile: uploadFile,
      });
    }
  };
  
  // Clear all filters
  const clearAllFilters = () => {
    setFileNameFilter([]);
    setPartnerNameFilter([]);
    setCallTypeFilter([]);
    setVocFilter([]);
    setCampaignFilter([]);
    setSelectedLanguages([]);
    setMinDuration('');
    setMaxDuration('');
    setDateRangeStart('');
    setDateRangeEnd('');
    setActiveFilters([]);
    
    // If we have a file uploaded, apply the filters automatically
    if (uploadFile && selectedContainer) {
      applyFilters.mutate({
        containerName: selectedContainer,
        metadataFile: uploadFile,
      });
    }
  };

  // Handle preview filter application
  const handleApplyFilters = () => {
    if (!selectedContainer || !uploadFile) {
      toast({
        title: 'Missing information',
        description: 'Please select a container and upload a metadata file.',
        variant: 'destructive',
      });
      return;
    }

    applyFilters.mutate({
      containerName: selectedContainer,
      metadataFile: uploadFile,
    });
  };

  // Handle import form submission
  const handleImport = () => {
    if (!selectedContainer || !uploadFile) {
      toast({
        title: 'Missing information',
        description: 'Please select a container and upload a metadata file.',
        variant: 'destructive',
      });
      return;
    }

    importAudioMutation.mutate({
      containerName: selectedContainer,
      metadataFile: uploadFile,
    });
  };

  // Allocation function removed as requested

  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Format a blob property for display
  const formatBlobProperty = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') {
      if (value instanceof Date) return value.toLocaleString();
      return JSON.stringify(value);
    }
    return String(value);
  };

  // Add a delete button to the file browser
  const renderDeleteButton = () => {
    if (!selectedBlobItems.length) return null;
    
    return (
      <Button 
        variant="destructive" 
        size="sm" 
        className="ml-2"
        onClick={handleDeleteFiles}
      >
        <Trash2 className="h-4 w-4 mr-2" /> 
        Delete Selected ({selectedBlobItems.length})
      </Button>
    );
  };

  return (
    <div className="container mx-auto py-6">
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedBlobItems.length} file{selectedBlobItems.length !== 1 ? 's' : ''} from the {selectedContainer} container?
              <div className="mt-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-md max-h-32 overflow-y-auto text-xs">
                {selectedBlobItems.map(file => (
                  <div key={file} className="mb-1">{file}</div>
                ))}
              </div>
              <p className="mt-2 font-bold text-destructive">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteFiles();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>Delete Files</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <h1 className="text-3xl font-bold mb-6">Azure Storage Browser</h1>
      <p className="text-gray-500 mb-6">
        Browse and import audio files from your Azure Storage account
      </p>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Containers Panel */}
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Containers</span>
              <Button variant="outline" size="sm" onClick={() => refetchContainers()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardTitle>
            <CardDescription>
              Select a container to view its contents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input 
                placeholder="Search containers..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page on search
                }}
                className="mb-2"
              />
            </div>
            {isLoadingContainers ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : Array.isArray(containers) && containers.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {/* Group containers by time periods */}
                  {(() => {
                    // Filter and sort containers first
                    const filteredContainers = containers
                      .filter(container => 
                        container.name.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .sort((a, b) => 
                        new Date(b.properties.lastModified).getTime() - 
                        new Date(a.properties.lastModified).getTime()
                      );
                    
                    // Calculate total pages
                    const totalPages = Math.ceil(filteredContainers.length / ITEMS_PER_PAGE);
                    
                    // Get current page of containers
                    const paginatedContainers = filteredContainers.slice(
                      (currentPage - 1) * ITEMS_PER_PAGE, 
                      currentPage * ITEMS_PER_PAGE
                    );
                    
                    // Group containers by time periods
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const thisWeekStart = new Date(today);
                    thisWeekStart.setDate(today.getDate() - today.getDay());
                    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    
                    // Create groups
                    const groups: {[key: string]: Container[]} = {
                      "Today": [],
                      "This Week": [],
                      "This Month": [],
                      "Older": []
                    };
                    
                    // Categorize containers
                    paginatedContainers.forEach(container => {
                      const modifiedDate = new Date(container.properties.lastModified);
                      
                      if (modifiedDate >= today) {
                        groups["Today"].push(container);
                      } else if (modifiedDate >= thisWeekStart) {
                        groups["This Week"].push(container);
                      } else if (modifiedDate >= thisMonthStart) {
                        groups["This Month"].push(container);
                      } else {
                        groups["Older"].push(container);
                      }
                    });
                    
                    // Render groups with headings
                    return (
                      <>
                        {Object.entries(groups).map(([groupName, groupContainers]) => 
                          groupContainers.length > 0 && (
                            <div key={groupName} className="mb-4">
                              <h3 className="text-sm font-medium text-gray-500 mb-2">{groupName}</h3>
                              <div className="space-y-2">
                                {groupContainers.map((container: Container) => (
                                  <div
                                    key={container.name}
                                    className={`flex items-center space-x-3 p-3 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                                      selectedContainer === container.name ? 'bg-gray-100 dark:bg-gray-800 border-l-4 border-primary' : ''
                                    }`}
                                    onClick={() => handleContainerClick(container.name)}
                                  >
                                    <FolderOpen className="h-5 w-5 text-blue-500" />
                                    <div>
                                      <p className="font-medium">{container.name}</p>
                                      <p className="text-xs text-gray-500">
                                        Last modified: {new Date(container.properties.lastModified).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        )}
                        
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between pt-4 border-t">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                              disabled={currentPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Previous
                            </Button>
                            <div className="text-sm text-gray-500">
                              Page {currentPage} of {totalPages}
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                              disabled={currentPage === totalPages}
                            >
                              Next
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center p-4 text-gray-500">
                No containers found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Blobs Panel */}
        <Card className="md:col-span-8">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>
                  {selectedContainer 
                    ? selectedFolder 
                      ? `Files in ${selectedContainer}/${selectedFolder}` 
                      : `Files in ${selectedContainer}`
                    : 'Select a container'}
                </CardTitle>
                <CardDescription>
                  {selectedContainer && (
                    selectedFolder 
                      ? 'View audio files in selected folder' 
                      : 'View or import audio files'
                  )}
                </CardDescription>
              </div>
              {selectedContainer && (
                <div className="flex space-x-2">
                  {/* Template download buttons */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <FileDown className="h-4 w-4 mr-2" />
                        Metadata Template <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>Metadata Templates</DropdownMenuLabel>
                      
                      {/* Standard Complete Template - All 23 Required Fields */}
                      <DropdownMenuItem onClick={handleDownloadTemplate}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        <div>
                          <div className="font-medium">Standard Template</div>
                          <div className="text-xs text-muted-foreground">All 23 required fields</div>
                        </div>
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem onClick={handleDownloadFilenames}>
                        <Download className="h-4 w-4 mr-2" />
                        <div>
                          <div className="font-medium">Download Filenames</div>
                          <div className="text-xs text-muted-foreground">Text list of current files</div>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {/* Date Folders button removed as per user request */}
                  
                  {selectedFolder && (
                    <Button 
                      variant="outline" 
                      onClick={handleBackToContainer}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  )}
                  
                  <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button disabled={!hasPermission('manage_allocation')}>
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Import Audio Files from Azure</DialogTitle>
                        <DialogDescription>
                          Upload an Excel file containing the filename column matching audio files in this container. The system will automatically extract audio duration from the files.
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="max-h-[70vh]">
                        <div className="grid gap-4 py-4">
                          {/* Process selection removed as per user request */}
                          <div className="grid gap-2">
                            <Label htmlFor="metadataFile">Metadata Excel File</Label>
                            <Input
                              id="metadataFile"
                              type="file"
                              accept=".xlsx,.xls"
                              onChange={(e) => {
                                setUploadFile(e.target.files?.[0] || null);
                                setFilterCounts(null);
                              }}
                            />
                          <p className="text-xs text-gray-500">
                            The Excel file only needs a <strong>filename</strong> column matching audio filenames in Azure. The system will automatically analyze audio files to extract duration.
                          </p>
                        </div>
                        
                        <div className="grid gap-2 mt-3">
                          <Label htmlFor="importEvaluationTemplate">Evaluation Template</Label>
                          <Select 
                            value={selectedEvaluationTemplate} 
                            onValueChange={setSelectedEvaluationTemplate}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select an evaluation template" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.isArray(evaluationTemplates) && evaluationTemplates.map((template: any) => (
                                <SelectItem key={template.id} value={template.id.toString()}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-500">
                            The selected evaluation template will be used for all files being imported.
                          </p>
                        </div>


                        
                        <div className="pt-2">
                          <Button 
                            variant="outline" 
                            type="button" 
                            onClick={() => setShowFilters(!showFilters)} 
                            className="mb-4 w-full"
                          >
                            {showFilters ? "Hide Filters" : "Show Filters"}
                          </Button>
                          
                          {showFilters && (
                            <div className="space-y-4 border rounded-md p-4 bg-muted/20">
                              <h4 className="font-medium">Filter Audio Files</h4>
                              
                              {activeFilters.length > 0 && (
                                <div className="mb-4">
                                  <div className="flex flex-wrap gap-2 mb-2">
                                    {activeFilters.map((filter) => (
                                      <Badge 
                                        key={filter.id} 
                                        variant="secondary"
                                        className="flex items-center gap-1 px-3 py-1"
                                      >
                                        <span className="font-medium">{filter.label}:</span> {filter.value}
                                        <button 
                                          onClick={() => removeFilter(filter.id)}
                                          className="ml-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                        >
                                          ✕
                                        </button>
                                      </Badge>
                                    ))}
                                  </div>
                                  
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={clearAllFilters}
                                    className="text-xs"
                                  >
                                    ✕ Clear All Filters
                                  </Button>
                                </div>
                              )}
                              
                              <div className="grid gap-2">
                                <Label htmlFor="fileNameFilter">Filename Contains (Enter multiple values separated by commas)</Label>
                                <Input
                                  id="fileNameFilter"
                                  value={fileNameFilter.join(', ')}
                                  onChange={(e) => {
                                    // Improved handling for more intuitive user input
                                    // If input ends with a comma, keep it in the display value
                                    const inputValue = e.target.value;
                                    const endsWithComma = inputValue.trim().endsWith(',');
                                    
                                    // Split by commas and process values
                                    let values = inputValue
                                      .split(',')
                                      .map(v => v.trim())
                                      .filter(v => v.length > 0);
                                    
                                    // If the input ends with a comma, add an empty string to preserve it visually
                                    if (endsWithComma && values.length > 0) {
                                      values[values.length-1] = values[values.length-1] + ', ';
                                    }
                                    
                                    setFileNameFilter(values);
                                  }}
                                  placeholder="E.g. call123, agent456, customer789"
                                />
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                  <Label htmlFor="dateRangeStart">Date Range (Start)</Label>
                                  <Input
                                    id="dateRangeStart"
                                    type="date"
                                    value={dateRangeStart}
                                    onChange={(e) => setDateRangeStart(e.target.value)}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="dateRangeEnd">Date Range (End)</Label>
                                  <Input
                                    id="dateRangeEnd"
                                    type="date"
                                    value={dateRangeEnd}
                                    onChange={(e) => setDateRangeEnd(e.target.value)}
                                  />
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                  <Label htmlFor="minDuration">Min Duration (seconds)</Label>
                                  <Input
                                    id="minDuration"
                                    type="number"
                                    min="0"
                                    value={minDuration}
                                    onChange={(e) => setMinDuration(e.target.value)}
                                    placeholder="e.g. 60"
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="maxDuration">Max Duration (seconds)</Label>
                                  <Input
                                    id="maxDuration"
                                    type="number"
                                    min="0"
                                    value={maxDuration}
                                    onChange={(e) => setMaxDuration(e.target.value)}
                                    placeholder="e.g. 300"
                                  />
                                </div>
                              </div>
                              
                              <div className="grid gap-2">
                                <Label htmlFor="languageFilter">Languages (Enter multiple values separated by commas)</Label>
                                <Input
                                  id="languageFilter"
                                  placeholder="E.g. english, hindi, tamil, bengali, telugu"
                                  value={selectedLanguages.join(', ')}
                                  onChange={(e) => {
                                    // Improved handling for more intuitive user input
                                    const inputValue = e.target.value;
                                    const endsWithComma = inputValue.trim().endsWith(',');
                                    
                                    // Split by commas and process values
                                    let values = inputValue
                                      .split(',')
                                      .map(v => v.trim().toLowerCase())
                                      .filter(v => v.length > 0);
                                    
                                    // If the input ends with a comma, add an empty string to preserve it visually
                                    if (endsWithComma && values.length > 0) {
                                      values[values.length-1] = values[values.length-1] + ', ';
                                    }
                                    
                                    setSelectedLanguages(values);
                                  }}
                                  className="w-full"
                                />
                              </div>
                              
                              {/* New metadata filters as requested */}
                              <div className="grid gap-2">
                                <Label htmlFor="partnerNameFilter">Partner Name (Enter multiple values separated by commas)</Label>
                                <Input
                                  id="partnerNameFilter"
                                  placeholder="E.g. Acme, Globex, CloudSocial"
                                  value={partnerNameFilter.join(', ')}
                                  onChange={(e) => {
                                    // Improved handling for more intuitive user input
                                    const inputValue = e.target.value;
                                    const endsWithComma = inputValue.trim().endsWith(',');
                                    
                                    // Split by commas and process values
                                    let values = inputValue
                                      .split(',')
                                      .map(v => v.trim())
                                      .filter(v => v.length > 0);
                                    
                                    // If the input ends with a comma, add an empty string to preserve it visually
                                    if (endsWithComma && values.length > 0) {
                                      values[values.length-1] = values[values.length-1] + ', ';
                                    }
                                    
                                    setPartnerNameFilter(values);
                                  }}
                                  className="w-full"
                                />
                              </div>
                              
                              <div className="grid gap-2">
                                <Label htmlFor="callTypeFilter">Call Type (Enter multiple values separated by commas)</Label>
                                <Input
                                  id="callTypeFilter"
                                  placeholder="E.g. inbound, outbound, service"
                                  value={callTypeFilter.join(', ')}
                                  onChange={(e) => {
                                    // Improved handling for more intuitive user input
                                    const inputValue = e.target.value;
                                    const endsWithComma = inputValue.trim().endsWith(',');
                                    
                                    // Split by commas and process values
                                    let values = inputValue
                                      .split(',')
                                      .map(v => v.trim())
                                      .filter(v => v.length > 0);
                                    
                                    // If the input ends with a comma, add an empty string to preserve it visually
                                    if (endsWithComma && values.length > 0) {
                                      values[values.length-1] = values[values.length-1] + ', ';
                                    }
                                    
                                    setCallTypeFilter(values);
                                  }}
                                  className="w-full"
                                />
                              </div>
                              
                              <div className="grid gap-2">
                                <Label htmlFor="vocFilter">VOC (Voice of Customer) (Enter multiple values separated by commas)</Label>
                                <Input
                                  id="vocFilter"
                                  placeholder="E.g. positive, neutral, negative, escalation"
                                  value={vocFilter.join(', ')}
                                  onChange={(e) => {
                                    // Improved handling for more intuitive user input
                                    const inputValue = e.target.value;
                                    const endsWithComma = inputValue.trim().endsWith(',');
                                    
                                    // Split by commas and process values
                                    let values = inputValue
                                      .split(',')
                                      .map(v => v.trim())
                                      .filter(v => v.length > 0);
                                    
                                    // If the input ends with a comma, add an empty string to preserve it visually
                                    if (endsWithComma && values.length > 0) {
                                      values[values.length-1] = values[values.length-1] + ', ';
                                    }
                                    
                                    setVocFilter(values);
                                  }}
                                  className="w-full"
                                />
                              </div>
                              
                              <div className="grid gap-2">
                                <Label htmlFor="campaignFilter">Campaign (Enter multiple values separated by commas)</Label>
                                <Input
                                  id="campaignFilter"
                                  placeholder="E.g. summer_promo, holiday_special, retention"
                                  value={campaignFilter.join(', ')}
                                  onChange={(e) => {
                                    // Improved handling for more intuitive user input
                                    const inputValue = e.target.value;
                                    const endsWithComma = inputValue.trim().endsWith(',');
                                    
                                    // Split by commas and process values
                                    let values = inputValue
                                      .split(',')
                                      .map(v => v.trim())
                                      .filter(v => v.length > 0);
                                    
                                    // If the input ends with a comma, add an empty string to preserve it visually
                                    if (endsWithComma && values.length > 0) {
                                      values[values.length-1] = values[values.length-1] + ', ';
                                    }
                                    
                                    setCampaignFilter(values);
                                  }}
                                  className="w-full"
                                />
                              </div>
                              
                              <Button 
                                variant="secondary" 
                                className="w-full"
                                onClick={handleApplyFilters}
                                disabled={applyFilters.isPending || !uploadFile}
                              >
                                {applyFilters.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Applying Filters...
                                  </>
                                ) : (
                                  'Preview Filter Results'
                                )}
                              </Button>
                              
                              {filterCounts && (
                                <div className="bg-primary/10 p-4 rounded-md">
                                  <h4 className="font-medium mb-2">Filter Results:</h4>
                                  <div className="flex justify-between text-sm">
                                    <span>Total files:</span>
                                    <span className="font-medium">{filterCounts.total}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span>After filtering:</span>
                                    <span className="font-medium">{filterCounts.filtered}</span>
                                  </div>
                                  <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>Excluded files:</span>
                                    <span>{filterCounts.total - filterCounts.filtered}</span>
                                  </div>
                                </div>
                              )}
                              
                              {/* QA Assignment Section */}
                              <div className="border rounded-md p-4 mt-4 bg-muted/20">
                                <h4 className="font-medium mb-2">QA Assignment (Optional)</h4>
                                <p className="text-xs text-gray-500 mb-4">
                                  Select Quality Analysts to automatically assign files during import. 
                                  Each QA can have a custom maximum file assignment limit.
                                </p>
                                
                                <div className="grid gap-2">
                                  <Label htmlFor="qualityAnalysts">Select Quality Analysts</Label>
                                  <MultiSelect
                                    options={
                                      Array.isArray(qualityAnalysts) 
                                        ? qualityAnalysts.map((qa: QualityAnalyst) => ({
                                            value: qa.id.toString(),
                                            label: qa.fullName
                                          }))
                                        : []
                                    }
                                    selectedValues={selectedQAs}
                                    onChange={(values) => setSelectedQAs(values)}
                                    placeholder="Select quality analysts..."
                                  />
                                </div>
                                
                                {selectedQAs.length > 0 && (
                                  <div className="mt-4">
                                    <Label className="mb-2">Maximum Files Per QA</Label>
                                    <div className="space-y-3 mt-2">
                                      {selectedQAs.map((qaId) => {
                                        const qa = Array.isArray(qualityAnalysts) 
                                          ? qualityAnalysts.find((q: QualityAnalyst) => q.id.toString() === qaId)
                                          : null;
                                        
                                        return qa ? (
                                          <div key={qaId} className="flex items-center gap-3">
                                            <div className="flex-1">{qa.fullName}</div>
                                            <Input 
                                              type="number" 
                                              className="w-20"
                                              value={qaMaxAssignments[qaId] || 10}
                                              min={1}
                                              max={100}
                                              onChange={(e) => {
                                                const value = parseInt(e.target.value);
                                                if (!isNaN(value) && value > 0) {
                                                  setQaMaxAssignments(prev => ({
                                                    ...prev,
                                                    [qaId]: value
                                                  }));
                                                }
                                              }}
                                            />
                                          </div>
                                        ) : null;
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      </ScrollArea>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleImport}
                          disabled={importAudioMutation.isPending || !hasPermission('manage_allocation')}
                        >
                          {importAudioMutation.isPending && (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          )}
                          Import Files
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button variant="outline" onClick={() => refetchBlobs()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  
                  {selectedBlobItems.length > 0 && (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="ml-2"
                      onClick={handleDeleteFiles}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> 
                      Delete Selected ({selectedBlobItems.length})
                    </Button>
                  )}
                </div>
              )}
            </div>
            {selectedContainer && selectedBlobItems.length > 0 && (
              <div className="mt-2">
                <Badge variant="outline">{selectedBlobItems.length} items selected</Badge>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selectedContainer ? (
              <div className="text-center p-12 text-gray-500">
                <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">No container selected</h3>
                <p>Select a container from the left panel to view its contents</p>
              </div>
            ) : isLoadingBlobs ? (
              <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : Array.isArray(blobs) && blobs.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={Array.isArray(blobs) && blobs.length > 0 && blobs.every(blob => selectedBlobItems.includes(blob.name))}
                          onClick={() => handleSelectAllBlobs()}
                          aria-label="Select all files"
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Last Modified</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blobs.map((blob: BlobItem) => (
                      <TableRow key={blob.name}>
                        <TableCell>
                          <Checkbox
                            checked={selectedBlobItems.includes(blob.name)}
                            onCheckedChange={() => handleBlobSelection(blob.name)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            <File className="h-4 w-4 text-gray-500" />
                            <span className="truncate max-w-[200px]" title={blob.name}>
                              {blob.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{blob.properties.contentType || 'application/octet-stream'}</TableCell>
                        <TableCell>{formatFileSize(blob.properties.contentLength)}</TableCell>
                        <TableCell>{new Date(blob.properties.lastModified).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center p-12 text-gray-500">
                <File className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">No files found</h3>
                <p>
                  {selectedFolder 
                    ? `No files found in the ${selectedFolder} folder` 
                    : "This container is empty"
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const PermissionGuardedAzureStorageBrowser = () => {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission('view_allocation')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <h2 className="text-2xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground mb-4">
          You do not have permission to access the Azure Storage Browser.
        </p>
        <Button asChild variant="outline">
          <a href="/">Return to Dashboard</a>
        </Button>
      </div>
    );
  }
  
  return <AzureStorageBrowser />;
};

export default PermissionGuardedAzureStorageBrowser;