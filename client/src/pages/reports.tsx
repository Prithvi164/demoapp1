import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { 
  BarChart, 
  FileDown, 
  Download,
  Filter,
  Calendar,
  Search,
  X,
  ClipboardCheck
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";

// Types for data export
type ExportDataType = 'attendance' | 'evaluation-results' | 'quiz-results' | 'custom';
type Batch = {
  id: number;
  name: string;
  status: string;
  [key: string]: any;
};
type EvaluationTemplate = {
  id: number;
  name: string;
  status: string;
  processId: number;
  description?: string;
  [key: string]: any;
};

// Function to download data as CSV
const downloadCSV = (data: any[], filename: string) => {
  // Convert data to CSV format
  const csvContent = convertToCSV(data);
  
  // Create a blob and download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Helper function to convert data to CSV format
const convertToCSV = (data: any[]): string => {
  // Handle empty data arrays
  if (data.length === 0) {
    // For evaluation parameters, provide default headers for an empty sheet
    return 'evaluationId,templateName,batchName,processName,traineeName,evaluatorName,finalScore,pillarName,parameterName,parameterScore,questionText,yesNoQuestion,answerValue,comment';
  }
  
  // Extract headers
  const headers = Object.keys(data[0]);
  
  // Create header row
  const headerRow = headers.join(',');
  
  // Create data rows
  const rows = data.map(obj => {
    return headers.map(header => {
      const value = obj[header];
      // Handle values with commas by wrapping in quotes
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    }).join(',');
  });
  
  // Combine header and data rows
  return [headerRow, ...rows].join('\n');
};

export default function Reports() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("raw-data");
  const [selectedDataType, setSelectedDataType] = useState<ExportDataType>('attendance');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedEvaluationTemplateId, setSelectedEvaluationTemplateId] = useState<string>("");
  
  // Fetch batches
  const { data: batches, isLoading: isBatchesLoading } = useQuery<Batch[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId
  });
  
  // Fetch evaluation templates
  const { data: evaluationTemplates, isLoading: isTemplatesLoading } = useQuery<EvaluationTemplate[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
    enabled: !!user?.organizationId
  });

  // Separate batches into running and completed batches, then apply search filter
  const runningBatches = batches
    ? batches.filter(batch => 
        // Consider all batches as running except those with "completed" status
        batch.status !== 'completed' && batch.status !== 'Completed'
      )
      .filter(batch => {
        if (!searchTerm.trim()) return true;
        const searchLower = searchTerm.toLowerCase();
        return batch.name.toLowerCase().includes(searchLower);
      })
    : [];
    
  const completedBatches = batches
    ? batches.filter(batch => 
        // Only include batches with completed status
        batch.status === 'completed' || batch.status === 'Completed'
      )
      .filter(batch => {
        if (!searchTerm.trim()) return true;
        const searchLower = searchTerm.toLowerCase();
        return batch.name.toLowerCase().includes(searchLower);
      })
    : [];
  
  // Function to handle batch selection
  const toggleBatchSelection = (batchId: string) => {
    setSelectedBatchIds(prevSelected => {
      if (prevSelected.includes(batchId)) {
        return prevSelected.filter(id => id !== batchId);
      } else {
        return [...prevSelected, batchId];
      }
    });
  };

  // Function to download raw data
  const handleDownloadRawData = () => {
    try {
      if (selectedDataType === 'attendance') {
        // Validate dates at minimum
        if (!startDate && !endDate && selectedBatchIds.length === 0) {
          toast({
            title: "Missing Information",
            description: "Please select at least a date range or one or more batches.",
            variant: "destructive"
          });
          return;
        }
        
        // Show loading toast
        toast({
          title: "Preparing Export",
          description: "Gathering attendance data for download...",
        });
        
        // Construct the API URL with the right parameters
        const batchIdsParam = selectedBatchIds.length > 0 ? `batchIds=${selectedBatchIds.join(',')}` : '';
        const startDateParam = startDate ? `startDate=${format(startDate, 'yyyy-MM-dd')}` : '';
        const endDateParam = endDate ? `endDate=${format(endDate, 'yyyy-MM-dd')}` : '';
        
        // Debug log to see what parameters are being sent
        console.log('Selected batch IDs:', selectedBatchIds);
        console.log('Batch IDs param:', batchIdsParam);
        
        // Combine the parameters
        const queryParams = [batchIdsParam, startDateParam, endDateParam]
          .filter(param => param !== '')
          .join('&');
        
        // Fetch attendance data from API
        fetch(`/api/organizations/${user?.organizationId}/attendance/export?${queryParams}`)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Server responded with status: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            if (data && Array.isArray(data) && data.length > 0) {
              downloadCSV(data, 'attendance_data');
              toast({
                title: "Data Exported Successfully",
                description: `${data.length} records have been downloaded as CSV.`,
              });
            } else {
              toast({
                title: "No Data Found",
                description: "There are no attendance records matching your criteria.",
              });
            }
            setIsExportDialogOpen(false);
          })
          .catch(error => {
            console.error("Error exporting data:", error);
            toast({
              title: "Export Failed",
              description: "There was a problem exporting the data.",
              variant: "destructive"
            });
          });
      } else if (selectedDataType === 'evaluation-results') {
        // Show loading toast
        toast({
          title: "Preparing Export",
          description: "Gathering evaluation results data for download...",
        });
        
        // Construct the API URL with the right parameters
        const batchIdsParam = selectedBatchIds.length > 0 ? `batchIds=${selectedBatchIds.join(',')}` : '';
        const startDateParam = startDate ? `startDate=${format(startDate, 'yyyy-MM-dd')}` : '';
        const endDateParam = endDate ? `endDate=${format(endDate, 'yyyy-MM-dd')}` : '';
        const templateIdParam = selectedEvaluationTemplateId && selectedEvaluationTemplateId !== 'all' ? `templateId=${selectedEvaluationTemplateId}` : '';
        
        // Combine the parameters
        const queryParams = [batchIdsParam, startDateParam, endDateParam, templateIdParam]
          .filter(param => param !== '')
          .join('&');
        
        // Fetch evaluation data from API
        fetch(`/api/organizations/${user?.organizationId}/evaluations/export?${queryParams}`)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Server responded with status: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            if (data) {
              // New format has an object with summary and parameters arrays
              if (data.summary && data.parameters) {
                console.log("Export API response summary length:", data.summary.length);
                console.log("Export API response parameters length:", data.parameters.length);
                console.log("Export API response structure:", JSON.stringify({
                  summaryCount: data.summary.length,
                  parametersCount: data.parameters.length,
                  summaryExample: data.summary.length > 0 ? data.summary[0] : null,
                  parametersExample: data.parameters.length > 0 ? data.parameters[0] : null
                }, null, 2));
                
                // Track if we actually downloaded anything
                let exportedSummary = false;
                let exportedParameters = false;
                
                // Download summary data first
                if (data.summary.length > 0) {
                  downloadCSV(data.summary, 'evaluation_summary');
                  console.log(`Downloaded ${data.summary.length} summary records`);
                  exportedSummary = true;
                  toast({
                    title: "Summary Data Exported",
                    description: `${data.summary.length} evaluation summary records downloaded.`,
                  });
                }
                
                // Small delay to ensure files don't conflict
                setTimeout(() => {
                  // Always attempt to download parameter data even if empty
                  // This ensures we always get a parameter sheet
                  downloadCSV(data.parameters, 'evaluation_parameters');
                  console.log(`Downloaded ${data.parameters.length} parameter records`);
                  exportedParameters = data.parameters.length > 0;
                  
                  // Notify user based on whether we had real data
                  if (data.parameters.length > 0) {
                    toast({
                      title: "Parameter Data Exported",
                      description: `${data.parameters.length} parameter-level records downloaded.`,
                    });
                  } else {
                    toast({
                      title: "Parameter Data Exported",
                      description: "A parameter sheet was created, but no parameter data was found for the selected criteria.",
                    });
                  }
                  
                  // Log if anything was missing
                  if (!exportedSummary || !exportedParameters) {
                    console.warn("Some data was missing in the export response:", 
                      !exportedSummary ? "No summary data" : "Summary data present", 
                      !exportedParameters ? "No parameter data" : "Parameter data present");
                  }
                }, 500);
              } 
              // Handle the old format for backward compatibility
              else if (Array.isArray(data) && data.length > 0) {
                downloadCSV(data, 'evaluation_results');
                toast({
                  title: "Data Exported Successfully",
                  description: `${data.length} records have been downloaded as CSV.`,
                });
              } 
              else {
                toast({
                  title: "No Data Found",
                  description: "There are no evaluation records matching your criteria.",
                });
              }
            } else {
              toast({
                title: "No Data Found",
                description: "There are no evaluation records matching your criteria.",
              });
            }
            setIsExportDialogOpen(false);
          })
          .catch(error => {
            console.error("Error exporting evaluation data:", error);
            toast({
              title: "Export Failed",
              description: "There was a problem exporting the evaluation data.",
              variant: "destructive"
            });
          });
      } else {
        // Handle other data types
        toast({
          title: "Feature Coming Soon",
          description: `Export for ${selectedDataType} data will be available soon.`,
        });
      }
    } catch (error) {
      console.error("Error generating CSV:", error);
      toast({
        title: "Error Generating CSV",
        description: "There was a problem creating the CSV file.",
        variant: "destructive"
      });
    }
  };

  // We will add more export types here in the future
  const getExportTypeName = (type: ExportDataType): string => {
    switch (type) {
      case 'attendance':
        return 'Attendance Data';
      case 'evaluation-results':
        return 'Evaluation Results';
      case 'quiz-results':
        return 'Quiz Results';
      case 'custom':
        return 'Custom Report';
      default:
        return 'Unknown Data Type';
    }
  };
  
  return (
    <div className="container mx-auto py-6 max-w-7xl space-y-8">
      <Helmet>
        <title>Reports | ZenCX Studio</title>
      </Helmet>
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">
            Access and download raw data for analysis and reporting
          </p>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full bg-background border rounded-lg p-1 h-auto flex flex-wrap">
          <TabsTrigger value="raw-data" className="flex-1 py-2 data-[state=active]:bg-indigo-100/40 data-[state=active]:text-indigo-700">
            <Download className="h-4 w-4 mr-2" />
            Raw Data Export
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex-1 py-2 data-[state=active]:bg-indigo-100/40 data-[state=active]:text-indigo-700">
            <BarChart className="h-4 w-4 mr-2" />
            Reports Dashboard
          </TabsTrigger>
        </TabsList>
        
        {/* Raw Data Export Tab */}
        <TabsContent value="raw-data" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Attendance Data Export Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Calendar className="h-5 w-5 mr-2 text-indigo-600" />
                  Attendance Data
                </CardTitle>
                <CardDescription>
                  Export daily attendance records for trainees
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Download raw attendance data including present, absent, late, and leave status for trainees.
                </p>
              </CardContent>
              <CardFooter>
                <Dialog open={isExportDialogOpen && selectedDataType === 'attendance'} onOpenChange={(open) => {
                  setIsExportDialogOpen(open);
                  if (open) setSelectedDataType('attendance');
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <FileDown className="h-4 w-4 mr-2" />
                      Export Attendance Data
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Export Attendance Data</DialogTitle>
                      <DialogDescription>
                        Select your filters to export raw attendance data for analysis.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                      {/* Date Range Selection */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Start Date */}
                        <div className="space-y-2">
                          <Label htmlFor="start-date">Start Date (Optional)</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                id="start-date"
                                variant="outline"
                                className="w-full justify-start text-left font-normal">
                                {startDate ? (
                                  format(startDate, "PPP")
                                ) : (
                                  <span>Pick a start date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={startDate}
                                onSelect={setStartDate}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        {/* End Date */}
                        <div className="space-y-2">
                          <Label htmlFor="end-date">End Date (Optional)</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                id="end-date"
                                variant="outline"
                                className="w-full justify-start text-left font-normal">
                                {endDate ? (
                                  format(endDate, "PPP")
                                ) : (
                                  <span>Pick an end date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <CalendarComponent
                                mode="single"
                                selected={endDate}
                                onSelect={setEndDate}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      
                      {/* Batch Selection */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="batch-search">Select Batches (Optional)</Label>
                          <div className="flex items-center h-9">
                            <Input 
                              type="text" 
                              id="batch-search"
                              placeholder="Search batches..."
                              className="h-9 w-[180px]"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                              <Button 
                                variant="ghost" 
                                className="h-9 px-2 ml-1" 
                                onClick={() => setSearchTerm("")}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {/* Running/Active Batches */}
                          <div className="border rounded-lg p-3">
                            <h4 className="font-medium text-sm mb-2">Active/Running Batches</h4>
                            <ScrollArea className="h-[200px]">
                              <div className="space-y-2">
                                {runningBatches.length > 0 ? runningBatches.map(batch => (
                                  <div key={batch.id} className="flex items-start space-x-2">
                                    <Checkbox 
                                      id={`batch-${batch.id}`} 
                                      checked={selectedBatchIds.includes(String(batch.id))}
                                      onCheckedChange={() => toggleBatchSelection(String(batch.id))}
                                    />
                                    <Label 
                                      htmlFor={`batch-${batch.id}`}
                                      className="text-sm font-normal cursor-pointer"
                                    >
                                      {batch.name}
                                    </Label>
                                  </div>
                                )) : (
                                  <p className="text-sm text-muted-foreground italic">No active batches found</p>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                          
                          {/* Completed Batches */}
                          <div className="border rounded-lg p-3">
                            <h4 className="font-medium text-sm mb-2">Completed Batches</h4>
                            <ScrollArea className="h-[200px]">
                              <div className="space-y-2">
                                {completedBatches.length > 0 ? completedBatches.map(batch => (
                                  <div key={batch.id} className="flex items-start space-x-2">
                                    <Checkbox 
                                      id={`batch-${batch.id}`} 
                                      checked={selectedBatchIds.includes(String(batch.id))}
                                      onCheckedChange={() => toggleBatchSelection(String(batch.id))}
                                    />
                                    <Label 
                                      htmlFor={`batch-${batch.id}`}
                                      className="text-sm font-normal cursor-pointer"
                                    >
                                      {batch.name}
                                    </Label>
                                  </div>
                                )) : (
                                  <p className="text-sm text-muted-foreground italic">No completed batches found</p>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        </div>
                        
                        {selectedBatchIds.length > 0 && (
                          <div className="mt-2">
                            <Label className="text-sm mb-1 block">Selected Batches</Label>
                            <div className="flex flex-wrap gap-2">
                              {selectedBatchIds.map(id => {
                                const batch = batches?.find(b => String(b.id) === id);
                                return batch ? (
                                  <Badge 
                                    key={id}
                                    variant="secondary"
                                    className="flex items-center gap-1 px-3 py-1"
                                  >
                                    {batch.name}
                                    <button 
                                      className="ml-1 rounded-full hover:bg-gray-200 p-0.5"
                                      onClick={() => toggleBatchSelection(id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button 
                        onClick={handleDownloadRawData} 
                        disabled={!startDate && !endDate && selectedBatchIds.length === 0}
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        Export Data
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
            
            {/* Evaluation Results Export Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <ClipboardCheck className="h-5 w-5 mr-2 text-indigo-600" />
                  Evaluation Results
                </CardTitle>
                <CardDescription>
                  Export detailed evaluation data with parameters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Download comprehensive evaluation results including parameter details, scores, agent info, and audio references.
                </p>
              </CardContent>
              <CardFooter>
                <Dialog open={isExportDialogOpen && selectedDataType === 'evaluation-results'} onOpenChange={(open) => {
                  setIsExportDialogOpen(open);
                  if (open) setSelectedDataType('evaluation-results');
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <FileDown className="h-4 w-4 mr-2" />
                      Export Evaluation Data
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Export Evaluation Results</DialogTitle>
                      <DialogDescription>
                        Select your filters to export evaluation data. Two files will be downloaded:
                        1. Evaluation summary with overall scores and averages
                        2. Parameter-wise detail with individual scores for each parameter
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                      {/* Template Selection */}
                      <div className="space-y-2">
                        <Label htmlFor="template">Evaluation Template (Optional)</Label>
                        <Select 
                          value={selectedEvaluationTemplateId} 
                          onValueChange={setSelectedEvaluationTemplateId}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a template..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Templates</SelectItem>
                            {evaluationTemplates && evaluationTemplates.map((template: EvaluationTemplate) => (
                              <SelectItem key={template.id} value={template.id.toString()}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Select a specific template to filter the evaluations, or leave blank to include all templates.
                        </p>
                      </div>
                      
                      {/* Date Range Selection */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Start Date */}
                        <div className="space-y-2">
                          <Label htmlFor="start-date-eval">Start Date (Optional)</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                id="start-date-eval"
                                variant="outline"
                                className="w-full justify-start text-left font-normal">
                                {startDate ? (
                                  format(startDate, "PPP")
                                ) : (
                                  <span>Pick a start date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={startDate}
                                onSelect={setStartDate}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        {/* End Date */}
                        <div className="space-y-2">
                          <Label htmlFor="end-date-eval">End Date (Optional)</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                id="end-date-eval"
                                variant="outline"
                                className="w-full justify-start text-left font-normal">
                                {endDate ? (
                                  format(endDate, "PPP")
                                ) : (
                                  <span>Pick an end date</span>
                                )}
                                <Calendar className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <CalendarComponent
                                mode="single"
                                selected={endDate}
                                onSelect={setEndDate}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      
                      {/* Batch Selection */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="batch-search-eval">Select Batches (Optional)</Label>
                          <div className="flex items-center h-9">
                            <Input 
                              type="text" 
                              id="batch-search-eval"
                              placeholder="Search batches..."
                              className="h-9 w-[180px]"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                              <Button 
                                variant="ghost" 
                                className="h-9 px-2 ml-1" 
                                onClick={() => setSearchTerm("")}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {/* Running Batches */}
                          <div className="border rounded-lg p-3">
                            <h4 className="font-medium text-sm mb-2">Active/Running Batches</h4>
                            <ScrollArea className="h-[200px]">
                              <div className="space-y-2">
                                {runningBatches.length > 0 ? runningBatches.map(batch => (
                                  <div key={batch.id} className="flex items-start space-x-2">
                                    <Checkbox 
                                      id={`eval-batch-${batch.id}`} 
                                      checked={selectedBatchIds.includes(String(batch.id))}
                                      onCheckedChange={() => toggleBatchSelection(String(batch.id))}
                                    />
                                    <Label 
                                      htmlFor={`eval-batch-${batch.id}`}
                                      className="text-sm font-normal cursor-pointer"
                                    >
                                      {batch.name}
                                    </Label>
                                  </div>
                                )) : (
                                  <p className="text-sm text-muted-foreground italic">No active batches found</p>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                          
                          {/* Completed Batches */}
                          <div className="border rounded-lg p-3">
                            <h4 className="font-medium text-sm mb-2">Completed Batches</h4>
                            <ScrollArea className="h-[200px]">
                              <div className="space-y-2">
                                {completedBatches.length > 0 ? completedBatches.map(batch => (
                                  <div key={batch.id} className="flex items-start space-x-2">
                                    <Checkbox 
                                      id={`eval-batch-${batch.id}`} 
                                      checked={selectedBatchIds.includes(String(batch.id))}
                                      onCheckedChange={() => toggleBatchSelection(String(batch.id))}
                                    />
                                    <Label 
                                      htmlFor={`eval-batch-${batch.id}`}
                                      className="text-sm font-normal cursor-pointer"
                                    >
                                      {batch.name}
                                    </Label>
                                  </div>
                                )) : (
                                  <p className="text-sm text-muted-foreground italic">No completed batches found</p>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        </div>
                        
                        {selectedBatchIds.length > 0 && (
                          <div className="mt-2">
                            <Label className="text-sm mb-1 block">Selected Batches</Label>
                            <div className="flex flex-wrap gap-2">
                              {selectedBatchIds.map(id => {
                                const batch = batches?.find(b => String(b.id) === id);
                                return batch ? (
                                  <Badge 
                                    key={id}
                                    variant="secondary"
                                    className="flex items-center gap-1 px-3 py-1"
                                  >
                                    {batch.name}
                                    <button 
                                      className="ml-1 rounded-full hover:bg-gray-200 p-0.5"
                                      onClick={() => toggleBatchSelection(id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button onClick={handleDownloadRawData}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Export Data
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        {/* Reports Dashboard Tab */}
        <TabsContent value="reports" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Reports Dashboard</CardTitle>
              <CardDescription>
                Access pre-built and custom reports
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-10">
              <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <BarChart className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Reports Coming Soon</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Advanced reports and analytics are being developed and will be available in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}