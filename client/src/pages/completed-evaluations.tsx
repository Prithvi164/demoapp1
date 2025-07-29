import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

import {
  Edit,
  Eye,
  Calendar,
  ClipboardCheck,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileAudio,
  User,
  Users,
  Filter,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";

function CompletedEvaluations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [evaluationType, setEvaluationType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedScores, setEditedScores] = useState({});
  const [evaluationFilters, setEvaluationFilters] = useState({
    templateId: "",
    traineeId: "",
    batchId: "",
    status: "all",
    dateRange: "all",
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Query to load evaluations
  const {
    data: evaluations = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/evaluations"],
    enabled: !!user,
  });
  
  // Query for templates
  const { data: templates = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
    enabled: !!user?.organizationId,
  });
  
  // Query for batches
  const { data: batches = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });
  
  // Query for trainees
  const { data: trainees = [] } = useQuery({
    queryKey: ["/api/trainees-for-evaluation"],
    enabled: !!user,
  });
  
  // Query for selected evaluation details
  const {
    data: evaluationDetails,
    isLoading: loadingDetails,
    error: detailsError,
  } = useQuery({
    queryKey: ["/api/evaluations", selectedEvaluation],
    enabled: !!selectedEvaluation,
  });
  
  // Mutation for updating an evaluation
  const updateEvaluationMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch(`/api/evaluations/${data.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update evaluation");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/evaluations"] });
      
      toast({
        title: "Evaluation updated",
        description: "The evaluation has been updated successfully.",
      });
      
      setIsEditDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error updating evaluation",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Filter evaluations based on current filters and search query
  const filteredEvaluations = evaluations
    .filter((eval) => {
      // Filter by evaluation type
      if (evaluationType !== "all" && eval.evaluationType !== evaluationType) {
        return false;
      }
      
      // Filter by search query
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesName = eval.trainee?.fullName?.toLowerCase().includes(searchLower);
        const matchesTemplate = eval.templateName?.toLowerCase().includes(searchLower);
        const matchesId = eval.id.toString().includes(searchLower);
        
        if (!matchesName && !matchesTemplate && !matchesId) {
          return false;
        }
      }
      
      // Apply other filters
      if (evaluationFilters.templateId && eval.templateId !== parseInt(evaluationFilters.templateId)) {
        return false;
      }
      
      if (evaluationFilters.traineeId && eval.traineeId !== parseInt(evaluationFilters.traineeId)) {
        return false;
      }
      
      if (evaluationFilters.batchId && eval.batchId !== parseInt(evaluationFilters.batchId)) {
        return false;
      }
      
      if (evaluationFilters.status !== "all" && eval.status !== evaluationFilters.status) {
        return false;
      }
      
      // Date range filtering could be implemented here
      
      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Handle opening view dialog
  const handleViewEvaluation = (evalId) => {
    setSelectedEvaluation(evalId);
    setIsViewDialogOpen(true);
  };
  
  // Handle opening edit dialog
  const handleEditEvaluation = (evalId) => {
    setSelectedEvaluation(evalId);
    
    // Load details first
    queryClient.fetchQuery({
      queryKey: ["/api/evaluations", evalId],
    }).then((details) => {
      // Initialize edited scores based on existing ones
      const initialScores = {};
      details.evaluation.scores.forEach((score) => {
        initialScores[score.parameterId] = {
          score: score.score,
          comment: score.comment || "",
          noReason: score.noReason || "",
        };
      });
      
      setEditedScores(initialScores);
      setIsEditDialogOpen(true);
    });
  };
  
  // Handle score changes in edit form
  const handleScoreChange = (parameterId, field, value) => {
    setEditedScores((prev) => ({
      ...prev,
      [parameterId]: {
        ...prev[parameterId],
        [field]: value,
      },
    }));
  };
  
  // Calculate final score in edit form
  const calculateEditedScore = () => {
    if (!evaluationDetails?.evaluation?.scores) return 0;
    
    const parameters = evaluationDetails.evaluation.template.parameters;
    const scoreEntries = Object.entries(editedScores);
    
    let totalScore = 0;
    let totalWeight = 0;
    
    scoreEntries.forEach(([parameterId, scoreData]) => {
      const parameter = parameters.find(p => p.id === parseInt(parameterId));
      if (parameter) {
        totalScore += scoreData.score * parameter.weight;
        totalWeight += parameter.weight;
      }
    });
    
    return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) / 100 : 0;
  };
  
  // Handle submitting edited evaluation
  const handleSubmitEdit = () => {
    if (!evaluationDetails) return;
    
    const scores = Object.entries(editedScores).map(([parameterId, scoreData]) => ({
      parameterId: parseInt(parameterId),
      score: scoreData.score,
      comment: scoreData.comment,
      noReason: scoreData.noReason,
    }));
    
    const finalScore = calculateEditedScore();
    
    // Determine if passed based on template's passing score
    const passingScore = evaluationDetails.evaluation.template.passingScore || 70;
    const isPassed = finalScore >= passingScore;
    
    updateEvaluationMutation.mutate({
      id: selectedEvaluation,
      scores,
      finalScore,
      isPassed,
    });
  };
  
  // Render status badge
  const renderStatusBadge = (status, score, passingScore) => {
    if (status === "pending") {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
    } else if (status === "completed") {
      const passed = score >= (passingScore || 70);
      return passed 
        ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Passed</Badge>
        : <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Failed</Badge>;
    } else {
      return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  // Reset filters
  const resetFilters = () => {
    setEvaluationFilters({
      templateId: "",
      traineeId: "",
      batchId: "",
      status: "all",
      dateRange: "all",
    });
    setSearchQuery("");
    setEvaluationType("all");
  };
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Completed Evaluations</h1>
        
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search evaluations..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-1">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <h4 className="font-medium">Filter Options</h4>
                
                <div className="space-y-2">
                  <Label htmlFor="template-filter">Template</Label>
                  <Select
                    value={evaluationFilters.templateId}
                    onValueChange={(value) =>
                      setEvaluationFilters((prev) => ({ ...prev, templateId: value }))
                    }
                  >
                    <SelectTrigger id="template-filter">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Templates</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="trainee-filter">Trainee</Label>
                  <Select
                    value={evaluationFilters.traineeId}
                    onValueChange={(value) =>
                      setEvaluationFilters((prev) => ({ ...prev, traineeId: value }))
                    }
                  >
                    <SelectTrigger id="trainee-filter">
                      <SelectValue placeholder="Select trainee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Trainees</SelectItem>
                      {trainees.map((trainee) => (
                        <SelectItem key={trainee.id} value={trainee.id.toString()}>
                          {trainee.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="batch-filter">Batch</Label>
                  <Select
                    value={evaluationFilters.batchId}
                    onValueChange={(value) =>
                      setEvaluationFilters((prev) => ({ ...prev, batchId: value }))
                    }
                  >
                    <SelectTrigger id="batch-filter">
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Batches</SelectItem>
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id.toString()}>
                          {batch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status-filter">Status</Label>
                  <Select
                    value={evaluationFilters.status}
                    onValueChange={(value) =>
                      setEvaluationFilters((prev) => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="pt-2 flex justify-between">
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Reset Filters
                  </Button>
                  <Button size="sm" onClick={() => setIsFilterOpen(false)}>
                    Apply Filters
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      <Tabs defaultValue="all" value={evaluationType} onValueChange={setEvaluationType}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Evaluations</TabsTrigger>
          <TabsTrigger value="standard">Standard Evaluations</TabsTrigger>
          <TabsTrigger value="audio">Audio Evaluations</TabsTrigger>
        </TabsList>
        
        <TabsContent value={evaluationType}>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Spinner className="h-6 w-6" />
              <span className="ml-2">Loading evaluations...</span>
            </div>
          ) : error ? (
            <Card>
              <CardContent className="py-10 text-center">
                <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Failed to load evaluations</h3>
                <p className="text-muted-foreground">Please try again later</p>
              </CardContent>
            </Card>
          ) : filteredEvaluations.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No evaluations found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || Object.values(evaluationFilters).some(v => v && v !== "all")
                    ? "Try adjusting your filters or search query"
                    : "No completed evaluations are available"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Trainee/Audio</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvaluations.map((evaluation) => (
                    <TableRow key={evaluation.id}>
                      <TableCell className="font-medium">#{evaluation.id}</TableCell>
                      <TableCell>
                        {evaluation.evaluationType === "audio" ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            <FileAudio className="h-3 w-3 mr-1" />
                            Audio
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            <ClipboardCheck className="h-3 w-3 mr-1" />
                            Standard
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{evaluation.templateName || "Unknown"}</TableCell>
                      <TableCell>
                        {evaluation.evaluationType === "audio" ? (
                          <span className="flex items-center">
                            <FileAudio className="h-3 w-3 mr-1" />
                            Audio #{evaluation.audioFileId}
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            {evaluation.trainee?.fullName || "Unknown"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{evaluation.finalScore.toFixed(1)}%</TableCell>
                      <TableCell>{formatDate(evaluation.createdAt)}</TableCell>
                      <TableCell>
                        {renderStatusBadge(
                          evaluation.status, 
                          evaluation.finalScore, 
                          evaluation.template?.passingScore
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleViewEvaluation(evaluation.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEditEvaluation(evaluation.id)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      
      {/* View Evaluation Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Evaluation Details</DialogTitle>
            <DialogDescription>
              {evaluationDetails?.evaluation?.evaluationType === "audio" 
                ? "Audio evaluation details" 
                : "Standard evaluation details"}
            </DialogDescription>
          </DialogHeader>
          
          {loadingDetails ? (
            <div className="flex justify-center items-center py-10">
              <Spinner className="h-6 w-6" />
              <span className="ml-2">Loading details...</span>
            </div>
          ) : !evaluationDetails ? (
            <div className="text-center py-6">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p>Failed to load evaluation details</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Evaluation Information</h3>
                    <div className="bg-muted/30 p-3 rounded-md space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Type:</span>
                        <span className="text-sm font-medium">
                          {evaluationDetails.evaluation.evaluationType === "audio" ? "Audio" : "Standard"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Template:</span>
                        <span className="text-sm font-medium">
                          {evaluationDetails.evaluation.template?.name || "Unknown"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Date:</span>
                        <span className="text-sm font-medium">
                          {formatDate(evaluationDetails.evaluation.createdAt)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Status:</span>
                        <span className="text-sm font-medium">
                          {evaluationDetails.evaluation.status === "completed" ? "Completed" : "Pending"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Final Score:</span>
                        <span className="text-sm font-medium">
                          {evaluationDetails.evaluation.finalScore.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Result:</span>
                        <span className={`text-sm font-medium ${evaluationDetails.evaluation.isPassed ? "text-green-600" : "text-red-600"}`}>
                          {evaluationDetails.evaluation.isPassed ? "Passed" : "Failed"}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">
                      {evaluationDetails.evaluation.evaluationType === "audio" 
                        ? "Audio Information" 
                        : "Trainee Information"}
                    </h3>
                    <div className="bg-muted/30 p-3 rounded-md space-y-2">
                      {evaluationDetails.evaluation.evaluationType === "audio" ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm">Audio ID:</span>
                            <span className="text-sm font-medium">#{evaluationDetails.evaluation.audioFileId}</span>
                          </div>
                          {evaluationDetails.evaluation.audioFile && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-sm">File Name:</span>
                                <span className="text-sm font-medium">
                                  {evaluationDetails.evaluation.audioFile.fileName || "Not available"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm">Duration:</span>
                                <span className="text-sm font-medium">
                                  {evaluationDetails.evaluation.audioFile.duration 
                                    ? `${Math.floor(evaluationDetails.evaluation.audioFile.duration / 60)}:${(evaluationDetails.evaluation.audioFile.duration % 60).toString().padStart(2, '0')}` 
                                    : "Unknown"}
                                </span>
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm">Trainee:</span>
                            <span className="text-sm font-medium">
                              {evaluationDetails.evaluation.trainee?.fullName || "Unknown"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Employee ID:</span>
                            <span className="text-sm font-medium">
                              {evaluationDetails.evaluation.trainee?.employeeId || "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Batch:</span>
                            <span className="text-sm font-medium">
                              {evaluationDetails.evaluation.batch?.name || "N/A"}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm">Evaluator:</span>
                        <span className="text-sm font-medium">
                          {evaluationDetails.evaluation.evaluator?.fullName || "Unknown"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Evaluation Scores</h3>
                  
                  <Accordion type="multiple" className="w-full">
                    {evaluationDetails.evaluation.template?.parameters.map((parameter) => {
                      const score = evaluationDetails.evaluation.scores.find(
                        (s) => s.parameterId === parameter.id
                      );
                      
                      return (
                        <AccordionItem key={parameter.id} value={parameter.id.toString()}>
                          <AccordionTrigger className="py-3 px-4 hover:bg-muted/30 rounded-md">
                            <div className="flex justify-between w-full mr-4 items-center">
                              <span>{parameter.name}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant={score?.score >= 3 ? "outline" : "destructive"} className="font-normal">
                                  {score?.score || 0}/{parameter.maxScore}
                                </Badge>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-3">
                            <div className="space-y-3">
                              <div>
                                <p className="text-sm text-muted-foreground">{parameter.description}</p>
                              </div>
                              
                              {score?.comment && (
                                <div>
                                  <h5 className="text-xs font-medium mb-1">Comment:</h5>
                                  <p className="text-sm border-l-2 border-primary pl-2 py-1">
                                    {score.comment}
                                  </p>
                                </div>
                              )}
                              
                              {score?.noReason && (
                                <div>
                                  <h5 className="text-xs font-medium mb-1">No Reason:</h5>
                                  <p className="text-sm border-l-2 border-red-500 pl-2 py-1">
                                    {score.noReason}
                                  </p>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </div>
            </ScrollArea>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsViewDialogOpen(false)}
            >
              Close
            </Button>
            <Button onClick={() => {
              setIsViewDialogOpen(false);
              handleEditEvaluation(selectedEvaluation);
            }}>
              Edit Evaluation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Evaluation Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Evaluation</DialogTitle>
            <DialogDescription>
              Update scores and comments for this evaluation
            </DialogDescription>
          </DialogHeader>
          
          {loadingDetails ? (
            <div className="flex justify-center items-center py-10">
              <Spinner className="h-6 w-6" />
              <span className="ml-2">Loading details...</span>
            </div>
          ) : !evaluationDetails ? (
            <div className="text-center py-6">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p>Failed to load evaluation details</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Edit Scores</h3>
                  
                  <div className="space-y-6">
                    {evaluationDetails.evaluation.template?.parameters.map((parameter) => {
                      const currentScore = editedScores[parameter.id] || { score: 0, comment: "", noReason: "" };
                      
                      return (
                        <Card key={parameter.id} className="border-primary/10">
                          <CardHeader className="pb-2">
                            <div className="flex justify-between">
                              <CardTitle className="text-base">{parameter.name}</CardTitle>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  Weight: {parameter.weight}
                                </span>
                              </div>
                            </div>
                            <CardDescription>{parameter.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <Label className="mb-1.5 block text-sm">Score (0-{parameter.maxScore})</Label>
                              <Select
                                value={currentScore.score.toString()}
                                onValueChange={(value) =>
                                  handleScoreChange(parameter.id, "score", parseInt(value))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: parameter.maxScore + 1 }, (_, i) => (
                                    <SelectItem key={i} value={i.toString()}>
                                      {i}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <Label className="mb-1.5 block text-sm">Comment</Label>
                              <Textarea
                                value={currentScore.comment}
                                onChange={(e) =>
                                  handleScoreChange(parameter.id, "comment", e.target.value)
                                }
                                placeholder="Add a comment (optional)"
                                className="min-h-[80px]"
                              />
                            </div>
                            
                            {currentScore.score === 0 && (
                              <div>
                                <Label className="mb-1.5 block text-sm">
                                  No Reason (Required for zero score)
                                </Label>
                                <Textarea
                                  value={currentScore.noReason}
                                  onChange={(e) =>
                                    handleScoreChange(parameter.id, "noReason", e.target.value)
                                  }
                                  placeholder="Explain why this score is zero"
                                  className="min-h-[80px]"
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          
          <DialogFooter className="border-t pt-4 mt-4">
            <div className="flex-1 text-left">
              <span className="font-medium">
                Final Score: {calculateEditedScore().toFixed(1)}%
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitEdit}
              disabled={updateEvaluationMutation.isPending}
            >
              {updateEvaluationMutation.isPending ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CompletedEvaluations;