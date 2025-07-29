import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { format } from 'date-fns';
import { CalendarIcon, Check, FileAudio, Plus, Settings, Headphones, RefreshCw, Filter } from 'lucide-react';

// Helper functions
const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const getAllocationStatusColor = (allocatedCount: number, totalCount: number) => {
  if (allocatedCount === 0) return 'bg-red-100 text-red-800';
  if (allocatedCount < totalCount) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
};

const AudioFileAllocation = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [allocationData, setAllocationData] = useState({
    name: '',
    description: '',
    dueDate: selectedDate,
    filters: {
      language: '',
      version: '',
      duration: '',
      callType: '',
      minCsat: 0,
      maxCsat: 5
    },
    qualityAnalysts: [] as { id: number, count: number }[],
    audioFileIds: [] as number[],
    distributionMethod: 'random' as 'random' | 'agent-balanced'
  });
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [selectAllFiles, setSelectAllFiles] = useState(false);
  const [filters, setFilters] = useState({
    language: '',
    version: '',
    duration: '',
    callType: '',
    status: '',
    allocatedTo: '',
    agentName: '',
    businessSegment: '',
    lob: '',
    voc: '',
    subType: '',
    subSubType: '',
    advisorCategory: ''
  });

  // Query for fetching available audio files for allocation
  const { data: audioFiles, isLoading: loadingAudioFiles, refetch: refetchAudioFiles } = useQuery({
    queryKey: ['/api/organizations/' + user?.organizationId + '/audio-files', filters],
    enabled: !!user?.organizationId,
  });

  // Query for fetching allocations
  const { data: allocations, isLoading: loadingAllocations, refetch: refetchAllocations } = useQuery({
    queryKey: ['/api/organizations/' + user?.organizationId + '/audio-file-allocations', activeTab],
    enabled: !!user?.organizationId,
  });

  // Query for fetching quality analysts
  const { data: qualityAnalysts } = useQuery({
    queryKey: ['/api/users/quality-analysts', user?.organizationId],
    enabled: !!user?.organizationId,
  });

  // Mutations
  const createAllocationMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/audio-file-allocations', data);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Allocation created successfully',
      });
      setCreateDialogOpen(false);
      resetAllocationForm();
      queryClient.invalidateQueries({ queryKey: ['/api/organizations/' + user?.organizationId + '/audio-file-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/organizations/' + user?.organizationId + '/audio-files'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create allocation: ${error.toString()}`,
        variant: 'destructive',
      });
    }
  });

  const updateAllocationStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      return apiRequest('PATCH', `/api/audio-file-allocations/${id}`, { status });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Allocation status updated successfully',
      });
      refetchAllocations();
      refetchAudioFiles();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update allocation status: ${error.toString()}`,
        variant: 'destructive',
      });
    }
  });

  useEffect(() => {
    if (selectAllFiles && audioFiles) {
      setSelectedFiles(audioFiles.map(file => file.id));
    } else if (!selectAllFiles) {
      setSelectedFiles([]);
    }
  }, [selectAllFiles, audioFiles]);

  useEffect(() => {
    setAllocationData(prev => ({
      ...prev,
      audioFileIds: selectedFiles
    }));
  }, [selectedFiles]);

  const resetAllocationForm = () => {
    setAllocationData({
      name: '',
      description: '',
      dueDate: new Date(),
      filters: {
        language: '',
        version: '',
        duration: '',
        callType: '',
        minCsat: 0,
        maxCsat: 5
      },
      qualityAnalysts: [],
      audioFileIds: [],
      distributionMethod: 'random'
    });
    setSelectedFiles([]);
    setSelectAllFiles(false);
  };

  const handleToggleFile = (fileId: number) => {
    if (selectedFiles.includes(fileId)) {
      setSelectedFiles(selectedFiles.filter(id => id !== fileId));
    } else {
      setSelectedFiles([...selectedFiles, fileId]);
    }
  };

  const handleQualityAnalystChange = (analystId: number, count: number) => {
    const updatedAnalysts = [...allocationData.qualityAnalysts];
    const existingIndex = updatedAnalysts.findIndex(a => a.id === analystId);
    
    if (existingIndex >= 0) {
      if (count <= 0) {
        // Remove analyst if count is 0 or negative
        updatedAnalysts.splice(existingIndex, 1);
      } else {
        // Update count
        updatedAnalysts[existingIndex].count = count;
      }
    } else if (count > 0) {
      // Add new analyst with count
      updatedAnalysts.push({ id: analystId, count });
    }
    
    setAllocationData({
      ...allocationData,
      qualityAnalysts: updatedAnalysts
    });
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters({
      ...filters,
      [key]: value === 'all' ? '' : value
    });
  };

  const resetFilters = () => {
    setFilters({
      language: '',
      version: '',
      duration: '',
      callType: '',
      status: '',
      allocatedTo: '',
      agentName: '',
      businessSegment: '',
      lob: '',
      voc: '',
      subType: '',
      subSubType: '',
      advisorCategory: ''
    });
  };

  const handleCreateAllocation = () => {
    if (!allocationData.name) {
      toast({
        title: 'Error',
        description: 'Please provide a name for the allocation',
        variant: 'destructive',
      });
      return;
    }

    if (allocationData.audioFileIds.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one audio file to allocate',
        variant: 'destructive',
      });
      return;
    }

    if (allocationData.qualityAnalysts.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one quality analyst',
        variant: 'destructive',
      });
      return;
    }

    const totalAllocationCount = allocationData.qualityAnalysts.reduce((sum, qa) => sum + qa.count, 0);
    if (totalAllocationCount !== allocationData.audioFileIds.length) {
      toast({
        title: 'Warning',
        description: `The total allocation count (${totalAllocationCount}) doesn't match the number of selected files (${allocationData.audioFileIds.length}). The allocation will be distributed proportionally.`,
      });
    }

    const data = {
      ...allocationData,
      organizationId: user?.organizationId,
      allocatedBy: user?.id
    };

    createAllocationMutation.mutate(data);
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Audio File Allocation</h1>
      
      <div className="flex justify-between mb-6">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Allocation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Audio File Allocation</DialogTitle>
              <DialogDescription>
                Allocate audio files to quality analysts for evaluation
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Allocation Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g., March Quality Reviews" 
                    value={allocationData.name}
                    onChange={(e) => setAllocationData({...allocationData, name: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        type="button"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {allocationData.dueDate ? (
                          format(allocationData.dueDate, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={allocationData.dueDate}
                        onSelect={(date) => setAllocationData({...allocationData, dueDate: date})}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Input 
                    id="description" 
                    placeholder="Allocation description (optional)" 
                    value={allocationData.description}
                    onChange={(e) => setAllocationData({...allocationData, description: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Quality Analysts</Label>
                  <Badge className="bg-primary">
                    {allocationData.qualityAnalysts.reduce((sum, qa) => sum + qa.count, 0)} / {selectedFiles.length} Files
                  </Badge>
                </div>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      {qualityAnalysts?.filter(qa => qa.role === 'quality_analyst').map((analyst) => (
                        <div key={analyst.id} className="flex items-center justify-between border p-2 rounded-md">
                          <div>
                            <p className="font-medium">{analyst.fullName}</p>
                            <p className="text-sm text-muted-foreground">{analyst.employeeId}</p>
                          </div>
                          <div className="flex items-center">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => {
                                const current = allocationData.qualityAnalysts.find(a => a.id === analyst.id)?.count || 0;
                                handleQualityAnalystChange(analyst.id, Math.max(0, current - 1));
                              }}
                            >
                              -
                            </Button>
                            <span className="w-12 text-center">
                              {allocationData.qualityAnalysts.find(a => a.id === analyst.id)?.count || 0}
                            </span>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => {
                                const current = allocationData.qualityAnalysts.find(a => a.id === analyst.id)?.count || 0;
                                handleQualityAnalystChange(analyst.id, current + 1);
                              }}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      {!qualityAnalysts || qualityAnalysts.filter(qa => qa.role === 'quality_analyst').length === 0 && (
                        <div className="col-span-2 text-center py-4 text-muted-foreground">
                          No quality analysts available
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="distributionMethod">Distribution Method</Label>
                <Select 
                  value={allocationData.distributionMethod} 
                  onValueChange={(value: 'random' | 'agent-balanced') => 
                    setAllocationData({...allocationData, distributionMethod: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select distribution method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Random distribution</SelectItem>
                    <SelectItem value="agent-balanced">Agent-balanced distribution</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Agent-balanced distribution ensures each QA receives a balanced mix of calls from different agents
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <Label>Select Audio Files</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="selectAll" 
                      checked={selectAllFiles}
                      onCheckedChange={(checked) => setSelectAllFiles(checked === true)}
                    />
                    <label htmlFor="selectAll" className="text-sm">Select All</label>
                  </div>
                </div>
                
                <Card>
                  <CardContent className="p-4">
                    {loadingAudioFiles ? (
                      <div className="flex justify-center items-center py-8">
                        <Spinner className="h-8 w-8" />
                      </div>
                    ) : audioFiles && audioFiles.length > 0 ? (
                      <div className="max-h-64 overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12"></TableHead>
                              <TableHead>Filename</TableHead>
                              <TableHead>Call ID</TableHead>
                              <TableHead>Language</TableHead>
                              <TableHead>Version</TableHead>
                              <TableHead>Duration</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {audioFiles.map((file) => (
                              <TableRow key={file.id} className={selectedFiles.includes(file.id) ? "bg-muted/50" : ""}>
                                <TableCell>
                                  <Checkbox 
                                    checked={selectedFiles.includes(file.id)}
                                    onCheckedChange={() => handleToggleFile(file.id)}
                                  />
                                </TableCell>
                                <TableCell className="flex items-center">
                                  <FileAudio className="h-4 w-4 mr-2 text-primary" />
                                  {file.originalFilename}
                                </TableCell>
                                <TableCell>{file.callMetrics?.callId || 'N/A'}</TableCell>
                                <TableCell className="capitalize">{file.language}</TableCell>
                                <TableCell>{file.version}</TableCell>
                                <TableCell>{formatDuration(file.duration)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileAudio className="mx-auto h-12 w-12 mb-4 text-muted-foreground/50" />
                        <p>No unallocated audio files found</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleCreateAllocation} 
                disabled={createAllocationMutation.isPending || selectedFiles.length === 0}
              >
                {createAllocationMutation.isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Headphones className="mr-2 h-4 w-4" />
                    Create Allocation
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => {
              refetchAllocations();
              refetchAudioFiles();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>
                  Filter allocations and audio files
                </SheetDescription>
              </SheetHeader>
              
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="filter-language">Language</Label>
                  <Select value={filters.language} onValueChange={(value) => handleFilterChange('language', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All languages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All languages</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="spanish">Spanish</SelectItem>
                      <SelectItem value="french">French</SelectItem>
                      <SelectItem value="hindi">Hindi</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="filter-version">Version</Label>
                  <Input 
                    id="filter-version" 
                    placeholder="Version" 
                    value={filters.version}
                    onChange={(e) => handleFilterChange('version', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="filter-duration">Duration</Label>
                  <Select value={filters.duration} onValueChange={(value) => handleFilterChange('duration', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any length" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any length</SelectItem>
                      <SelectItem value="short">Short (&lt; 3min)</SelectItem>
                      <SelectItem value="medium">Medium (3-10min)</SelectItem>
                      <SelectItem value="long">Long (&gt; 10min)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="filter-callType">Call Type</Label>
                  <Select value={filters.callType} onValueChange={(value) => handleFilterChange('callType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All call types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All call types</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="filter-status">Status</Label>
                  <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="allocated">Allocated</SelectItem>
                      <SelectItem value="evaluated">Evaluated</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {qualityAnalysts && (
                  <div className="space-y-2">
                    <Label htmlFor="filter-allocatedTo">Allocated To</Label>
                    <Select value={filters.allocatedTo} onValueChange={(value) => handleFilterChange('allocatedTo', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All analysts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All analysts</SelectItem>
                        {qualityAnalysts.filter(qa => qa.role === 'quality_analyst').map((analyst) => (
                          <SelectItem key={analyst.id} value={analyst.id.toString()}>
                            {analyst.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="filter-agentName">Agent Name</Label>
                  <Input 
                    id="filter-agentName" 
                    placeholder="Agent name" 
                    value={filters.agentName}
                    onChange={(e) => handleFilterChange('agentName', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-businessSegment">Business Segment</Label>
                  <Select value={filters.businessSegment} onValueChange={(value) => handleFilterChange('businessSegment', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All segments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All segments</SelectItem>
                      <SelectItem value="Care">Care</SelectItem>
                      <SelectItem value="Tech Support">Tech Support</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-lob">Line of Business</Label>
                  <Select value={filters.lob} onValueChange={(value) => handleFilterChange('lob', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Lines of Business" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Lines of Business</SelectItem>
                      <SelectItem value="Prepaid">Prepaid</SelectItem>
                      <SelectItem value="Postpaid">Postpaid</SelectItem>
                      <SelectItem value="Enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-voc">Voice of Customer</Label>
                  <Select value={filters.voc} onValueChange={(value) => handleFilterChange('voc', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All VOC" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All VOC</SelectItem>
                      <SelectItem value="Positive">Positive</SelectItem>
                      <SelectItem value="Neutral">Neutral</SelectItem>
                      <SelectItem value="Negative">Negative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-subType">Call Sub-Type</Label>
                  <Input 
                    id="filter-subType" 
                    placeholder="Call sub-type" 
                    value={filters.subType}
                    onChange={(e) => handleFilterChange('subType', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-subSubType">Call Sub-Sub-Type</Label>
                  <Input 
                    id="filter-subSubType" 
                    placeholder="Call sub-sub-type" 
                    value={filters.subSubType}
                    onChange={(e) => handleFilterChange('subSubType', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-advisorCategory">Advisor Category</Label>
                  <Select value={filters.advisorCategory} onValueChange={(value) => handleFilterChange('advisorCategory', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      <SelectItem value="Challenger">Challenger</SelectItem>
                      <SelectItem value="Performer">Performer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <SheetFooter>
                <Button variant="outline" onClick={resetFilters}>Reset Filters</Button>
                <Button onClick={() => setFilterSheetOpen(false)}>Apply Filters</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
      <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="active">Active Allocations</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Audio File Allocations</CardTitle>
              <CardDescription>
                {activeTab === 'active' ? 'Ongoing audio file allocations' : 
                 activeTab === 'completed' ? 'Completed allocations' : 'Archived allocations'}
                {allocations ? ` (${allocations.length})` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAllocations ? (
                <div className="flex justify-center items-center py-8">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : allocations && allocations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Allocation</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocations.map((allocation) => (
                      <TableRow key={allocation.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{allocation.name}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {allocation.description || 'No description'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(allocation.allocationDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {allocation.dueDate ? new Date(allocation.dueDate).toLocaleDateString() : 'No due date'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Badge className={getAllocationStatusColor(
                              allocation.allocatedCount, allocation.totalFiles
                            )}>
                              {allocation.allocatedCount} / {allocation.totalFiles}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <div className="w-full bg-muted rounded-full h-2">
                              <div 
                                className="bg-primary rounded-full h-2" 
                                style={{ 
                                  width: `${allocation.evaluatedCount / (allocation.totalFiles || 1) * 100}%` 
                                }}
                              ></div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(allocation.evaluatedCount / (allocation.totalFiles || 1) * 100)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              asChild
                            >
                              <a href={`/allocation-details/${allocation.id}`}>View</a>
                            </Button>
                            
                            {activeTab === 'active' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateAllocationStatusMutation.mutate({ 
                                  id: allocation.id, 
                                  status: 'archived' 
                                })}
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
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Headphones className="mx-auto h-12 w-12 mb-4 text-muted-foreground/50" />
                  <p>No allocations found</p>
                  <p className="text-sm">
                    {activeTab === 'active' 
                      ? 'Create a new allocation to get started' 
                      : 'Completed allocations will appear here'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AudioFileAllocation;