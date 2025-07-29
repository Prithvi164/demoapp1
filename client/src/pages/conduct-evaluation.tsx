import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Headphones,
  Volume2,
  FileAudio,
  Clock,
  Globe,
  Tag,
  ClipboardCheck,
  ClipboardList,
  Check,
  Search,
  Filter,
  Edit,
  Eye,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Users,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import EvaluationDetailsDialog from "@/components/evaluation/evaluation-details-dialog";

function ConductEvaluation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [selectedTrainee, setSelectedTrainee] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  // Audio file selection removed
  const [scores, setScores] = useState<Record<number, any>>({});
  const [evaluationType, setEvaluationType] = useState<"standard" | "audio" | "completed">(
    "standard",
  );
  // Track if the evaluation is for certification purpose
  const [isCertification, setIsCertification] = useState<boolean>(false);
  
  // States for completed evaluations view
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvaluation, setSelectedEvaluation] = useState<number | null>(null);
  const [submittedEvaluationId, setSubmittedEvaluationId] = useState<number | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedScores, setEditedScores] = useState<Record<number, any>>({});
  const [completedEvalType, setCompletedEvalType] = useState<"all" | "standard" | "audio">("all");
  const [evaluationFilters, setEvaluationFilters] = useState({
    templateId: "",
    traineeId: "",
    batchId: "",
    status: "all",
    dateRange: "all",
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // States for evaluation details dialog
  const [evaluationDetails, setEvaluationDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Audio-related state
  const [selectedAudioFile, setSelectedAudioFile] = useState<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Function to fetch a recent evaluation ID
  const fetchRecentEvaluationId = async () => {
    try {
      // Fetch the most recent evaluation from the API - try different endpoint patterns
      let response;
      
      // First try the organization-specific endpoint
      response = await fetch(`/api/organizations/${user?.organizationId}/evaluations?limit=1`);
      
      // If that fails, try the simpler endpoint
      if (!response.ok) {
        console.log("Trying alternate endpoint for evaluations");
        response = await fetch(`/api/evaluations?limit=1`);
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch recent evaluations');
      }
      
      const data = await response.json();
      console.log("Recent evaluations data:", data);
      
      if (data && (data.length > 0 || data.evaluations?.length > 0)) {
        // Handle different response formats
        const firstEval = data.length > 0 ? data[0] : (data.evaluations?.length > 0 ? data.evaluations[0] : null);
        if (firstEval) {
          console.log("Found evaluation with ID:", firstEval.id);
          return firstEval.id;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching recent evaluation:', error);
      return null;
    }
  };

  // Audio functionality completely removed per user request

  // Function to fetch evaluation details
  const fetchEvaluationDetails = async (evaluationId: number) => {
    setLoadingDetails(true);
    try {
      console.log(`Attempting to fetch evaluation details for ID: ${evaluationId}`);
      
      // Try multiple API endpoint patterns
      let response;
      let data;
      
      // Try the first endpoint pattern
      try {
        console.log(`Trying endpoint: /api/evaluations/${evaluationId}`);
        response = await fetch(`/api/evaluations/${evaluationId}`);
        if (response.ok) {
          data = await response.json();
          console.log("Retrieved evaluation data (first endpoint):", data);
        }
      } catch (err) {
        console.warn(`First endpoint attempt failed: ${err}`);
      }
      
      // If the first endpoint failed, try organization-specific endpoint
      if (!response?.ok) {
        try {
          console.log(`Trying org endpoint: /api/organizations/${user?.organizationId}/evaluations/${evaluationId}`);
          response = await fetch(`/api/organizations/${user?.organizationId}/evaluations/${evaluationId}`);
          if (response.ok) {
            data = await response.json();
            console.log("Retrieved evaluation data (org endpoint):", data);
          }
        } catch (err) {
          console.warn(`Organization endpoint attempt failed: ${err}`);
        }
      }
      
      // If still no success, try a third pattern
      if (!response?.ok) {
        try {
          console.log(`Trying details endpoint: /api/evaluation-details/${evaluationId}`);
          response = await fetch(`/api/evaluation-details/${evaluationId}`);
          if (response.ok) {
            data = await response.json();
            console.log("Retrieved evaluation data (details endpoint):", data);
          }
        } catch (err) {
          console.warn(`Details endpoint attempt failed: ${err}`);
        }
      }
      
      // If none of the endpoints worked
      if (!response?.ok || !data) {
        throw new Error('Failed to fetch evaluation details from any endpoint');
      }
      
      // Process the data and create a compatible structure if needed
      const normalizedData = processEvaluationData(data);
      
      // Update state with the fetched data
      setEvaluationDetails(normalizedData);
      setIsViewDialogOpen(true);
    } catch (error) {
      console.error('Error fetching evaluation details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load evaluation details. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingDetails(false);
    }
  };
  
  // Helper function to process and normalize evaluation data from different formats
  const processEvaluationData = (data: any) => {
    // If data is already in the expected format, return as is
    if (data.evaluation && data.groupedScores) {
      return data;
    }
    
    console.log("Processing evaluation data to compatible format");
    
    // Check if we have minimal requirements to build an evaluation object
    if (!data.id && !data.evaluationId) {
      console.error("Insufficient data to create evaluation object");
      return null;
    }
    
    // Create a normalized evaluation object structure
    const normalized = {
      evaluation: {
        id: data.id || data.evaluationId,
        templateId: data.templateId,
        evaluationType: data.evaluationType || "standard",
        traineeId: data.traineeId,
        evaluatorId: data.evaluatorId,
        finalScore: data.finalScore || 0,
        createdAt: data.createdAt || new Date().toISOString(),
        audioFileId: data.audioFileId
      },
      groupedScores: []
    };
    
    // If the response has scores, process them
    if (data.scores || data.evaluationScores) {
      const scores = data.scores || data.evaluationScores || [];
      
      // Group scores by pillar if available
      const groupedScores = [];
      
      if (scores.length > 0) {
        // Check if scores has pillar info
        const scoresByPillar = {};
        
        scores.forEach(score => {
          const pillarId = score.pillarId || (score.parameter?.pillarId) || 0;
          if (!scoresByPillar[pillarId]) {
            scoresByPillar[pillarId] = {
              pillar: score.pillar || { 
                id: pillarId,
                name: `Section ${pillarId || 1}`,
                weight: 100 / Object.keys(scoresByPillar).length + 1
              },
              scores: []
            };
          }
          scoresByPillar[pillarId].scores.push(score);
        });
        
        // Convert the object to an array
        Object.values(scoresByPillar).forEach(group => {
          groupedScores.push(group);
        });
      }
      
      // If we couldn't group by pillar, put all scores in a single group
      if (groupedScores.length === 0 && scores.length > 0) {
        groupedScores.push({
          pillar: {
            id: 1,
            name: "All Parameters",
            weight: 100
          },
          scores: scores
        });
      }
      
      normalized.groupedScores = groupedScores;
    }
    
    console.log("Normalized evaluation data:", normalized);
    return normalized;
  };

  // Handle viewing evaluation details
  const handleViewEvaluation = (evaluationId: number) => {
    setSelectedEvaluation(evaluationId);
    fetchEvaluationDetails(evaluationId);
  };
  
  // Function to view the most recent evaluation OR the currently submitted evaluation
  const handleViewRecentEvaluation = async () => {
    try {
      // If we have an evaluation ID from a recent submission, use that
      if (submittedEvaluationId) {
        console.log(`Using recently submitted evaluation ID: ${submittedEvaluationId}`);
        handleViewEvaluation(submittedEvaluationId);
        return;
      }
      
      // Otherwise try to fetch the most recent evaluation
      console.log("Attempting to fetch the most recent evaluation...");
      const recentEvaluationId = await fetchRecentEvaluationId();
      
      if (recentEvaluationId) {
        console.log(`Found recent evaluation with ID: ${recentEvaluationId}`);
        handleViewEvaluation(recentEvaluationId);
      } else {
        console.log("No recent evaluations found");
        toast({
          title: 'No evaluations found',
          description: 'Complete an evaluation first.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error viewing recent evaluation:', error);
      toast({
        title: 'Error',
        description: 'Failed to load recent evaluation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Parse URL parameters
  useEffect(() => {
    if (!user) return;

    // Get URL parameters
    const params = new URLSearchParams(window.location.search);
    const batchId = params.get("batchId");
    const traineeId = params.get("traineeId");
    const typeParam = params.get("evaluationType");

    // Set batch ID if provided in URL
    if (batchId) {
      const batchIdNum = parseInt(batchId);
      setSelectedBatch(batchIdNum);
    }

    // Set trainee ID if provided in URL (but only after trainees are loaded)
    if (traineeId) {
      const traineeIdNum = parseInt(traineeId);
      setSelectedTrainee(traineeIdNum);
    }

    // Set evaluation type if provided in URL
    if (typeParam === "standard" || typeParam === "audio") {
      console.log(`Setting evaluation type from URL parameter: ${typeParam}`);
      setEvaluationType(typeParam);
    } else if (typeParam === "certification") {
      // If certification is specified, use standard type with certification flag
      console.log(`Setting evaluation type to standard with certification purpose`);
      setEvaluationType("standard");
      setIsCertification(true);
    }
    
    // Check if purpose parameter is set to certification
    const purposeParam = params.get("purpose");
    if (purposeParam === "certification") {
      console.log("Setting certification purpose flag");
      setIsCertification(true);
    }
  }, [user]);

  // Fetch active batches
  const { data: batches } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });

  // Fetch trainees for selected batch
  const { data: trainees } = useQuery({
    queryKey: [
      `/api/organizations/${user?.organizationId}/batches/${selectedBatch}/trainees`,
    ],
    enabled: !!selectedBatch && !!user?.organizationId,
  });

  // Fetch active templates
  const { data: templates } = useQuery({
    queryKey: [
      `/api/organizations/${user?.organizationId}/evaluation-templates`,
      selectedBatch, // Add selectedBatch to query key to refresh when batch changes
    ],
    select: (data) => {
      // Log all templates received from the server
      console.log("All templates:", data);
      console.log("Selected batch ID:", selectedBatch);
      
      const filteredTemplates = data.filter((t: any) => {
        // First filter by active status
        const isActive = t.status === "active";
        
        // Then filter by batch ID if one is selected
        const matchesBatch = selectedBatch 
          ? t.batchId === selectedBatch 
          : true; // If no batch selected, show all active templates
        
        // For certification purpose, filter templates that are certification templates
        const isCertificationTemplate = t.name?.toLowerCase().includes('certification') || 
          t.description?.toLowerCase().includes('certification') ||
          (t.tags && t.tags.includes('certification')) ||
          (t.metadata && t.metadata.purpose === 'certification');
        
        // If certification purpose is set, only include certification templates
        const matchesPurpose = isCertification 
          ? isCertificationTemplate
          : true; // For regular evaluations, show all templates

        // Log matching info for debugging
        if (selectedBatch) {
          console.log(`Template ${t.id} (${t.name}): Active=${isActive}, BatchID=${t.batchId}, Matches selected batch=${matchesBatch}, Certification=${isCertificationTemplate}, Matches purpose=${matchesPurpose}`);
        }
        
        return isActive && matchesBatch && matchesPurpose;
      });
      
      // Log the templates that will be shown in the dropdown
      console.log("Filtered templates for dropdown:", filteredTemplates);
      
      return filteredTemplates;
    },
    enabled: !!user?.organizationId,
  });

  // Get selected template details
  const { data: selectedTemplateDetails } = useQuery({
    queryKey: [`/api/evaluation-templates/${selectedTemplate}`],
    enabled: !!selectedTemplate,
  });

  // Query for fetching assigned audio files for the quality analyst
  const { data: assignedAudioFiles, isLoading: loadingAudioFiles } = useQuery({
    queryKey: [
      `/api/organizations/${user?.organizationId}/audio-file-allocations/assigned-to-me`,
    ],
    enabled: !!user?.organizationId && user?.role === "quality_analyst",
    // Filter to only show allocated files
    select: (data) => {
      if (!data) return [];
      return data.filter((file: any) => {
        const allocationStatus = file.status === "allocated";
        const fileStatus = file.audioFile && file.audioFile.status === "allocated";
        return allocationStatus && fileStatus;
      });
    }
  });

  // Get audio file details when selected
  const { data: selectedAudioFileDetails } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/audio-files/${selectedAudioFile}`],
    enabled: !!selectedAudioFile && !!user?.organizationId,
  });

  // Audio handler functions
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleAudioFileSelect = (value: string) => {
    const fileId = parseInt(value);
    setSelectedAudioFile(fileId);
    
    // Set the streaming URL for the selected audio file
    const streamingUrl = `/api/audio-stream/${fileId}`;
    setAudioUrl(streamingUrl);
    
    // Reset audio state
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    
    console.log(`Selected audio file ${fileId}, streaming URL: ${streamingUrl}`);
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioSubmit = () => {
    if (!selectedAudioFile || !selectedTemplate) {
      toast({
        title: "Error",
        description: "Please select both an audio file and template",
        variant: "destructive",
      });
      return;
    }

    const evaluation = {
      templateId: selectedTemplate,
      audioFileId: selectedAudioFile,
      scores,
      type: "audio",
    };

    submitEvaluationMutation.mutate(evaluation);
  };

  // Submit evaluation
  const submitEvaluationMutation = useMutation({
    mutationFn: async (evaluation: any) => {
      // Use different endpoints based on evaluation type
      const endpoint = evaluationType === "audio" 
        ? "/api/audio-evaluations" 
        : "/api/evaluations";
        
      console.log(`Submitting ${evaluationType} evaluation to ${endpoint}`);
      
      // For certification evaluations, we use the same endpoint and type as standard evaluations
      // but we track whether it's a certification in the UI state
      if (isCertification) {
        // Make sure we're using standard type for certification purpose
        evaluation.evaluationType = "standard"; 
        // Add metadata to help identify certifications in reports
        evaluation.purpose = "certification";
        evaluation.isCertification = true; // Add a flag (this won't be used by DB directly)
        console.log("Marking standard evaluation as certification purpose:", evaluation);
      }
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(evaluation),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit evaluation");
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log("Evaluation submitted successfully:", data);
      
      // Store the submitted evaluation ID to use later
      if (data && data.id) {
        console.log(`Setting submitted evaluation ID: ${data.id}`);
        setSubmittedEvaluationId(data.id);
      } else if (data && data.evaluation && data.evaluation.id) {
        console.log(`Setting submitted evaluation ID from nested data: ${data.evaluation.id}`);
        setSubmittedEvaluationId(data.evaluation.id);
      }
      
      if (isCertification) {
        // For certification purpose evaluations
        queryClient.invalidateQueries({
          queryKey: [`/api/organizations/${user?.organizationId}/evaluations`],
        });
        
        // Also invalidate certification-specific queries
        queryClient.invalidateQueries({
          queryKey: [`/api/organizations/${user?.organizationId}/batches/${selectedBatch}/certification-evaluations`]
        });
        
        // Update trainee records as certification may change their status
        queryClient.invalidateQueries({
          queryKey: [`/api/organizations/${user?.organizationId}/batches/${selectedBatch}/trainees`]
        });
        
        toast({
          title: "Success",
          description: "Certification evaluation submitted successfully",
        });
        
        // Reset form state
        setScores({});
        setSelectedBatch(null);
        setSelectedTrainee(null);
        setSelectedTemplate(null);
        
        // Navigate back to the previous page after a short delay to allow toast to be visible
        setTimeout(() => {
          // Check if we came from a specific page
          const referrer = document.referrer;
          if (referrer && referrer.includes('trainee-management')) {
            // Go back to the previous page
            window.history.back();
          } else {
            // Or navigate to a specific path
            navigate('/trainee-management');
          }
        }, 1500); // 1.5 second delay
      } else {
        // For standard evaluations
        queryClient.invalidateQueries({
          queryKey: [`/api/organizations/${user?.organizationId}/evaluations`],
        });
        toast({
          title: "Success",
          description: "Evaluation submitted successfully",
        });
        
        // Reset form state
        setScores({});
        setSelectedBatch(null);
        setSelectedTrainee(null);
        setSelectedTemplate(null);
        
        // Navigate back to the previous page (assessment section) after a short delay to allow toast to be visible
        setTimeout(() => {
          // Check if we came from a specific page
          const referrer = document.referrer;
          if (referrer && referrer.includes('trainee-management')) {
            // Go back to the previous page
            window.history.back();
          } else {
            // Or navigate to a specific path
            navigate('/trainee-management');
          }
        }, 1500); // 1.5 second delay
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // This mutation is no longer needed as we're using the audio-evaluations endpoint
  // which already updates the audio file status
  // Keeping reference here but it's not used anymore

  const handleScoreChange = (parameterId: number, value: any) => {
    setScores((prev) => ({
      ...prev,
      [parameterId]: {
        ...prev[parameterId],
        score: value,
      },
    }));
  };

  const handleCommentChange = (parameterId: number, comment: string) => {
    setScores((prev) => ({
      ...prev,
      [parameterId]: {
        ...prev[parameterId],
        comment,
      },
    }));
  };

  const handleNoReasonSelect = (parameterId: number, reason: string) => {
    setScores((prev) => ({
      ...prev,
      [parameterId]: {
        ...prev[parameterId],
        noReason: reason,
      },
    }));
  };

  const calculateScore = () => {
    if (!selectedTemplateDetails) return 0;

    let totalScore = 0;
    let totalWeight = 0;

    selectedTemplateDetails.pillars.forEach((pillar: any) => {
      pillar.parameters.forEach((param: any) => {
        if (param.weightageEnabled && scores[param.id]?.score) {
          const paramScore =
            param.ratingType === "yes_no_na"
              ? scores[param.id].score === "yes"
                ? 100
                : 0
              : parseFloat(scores[param.id].score);

          totalScore += param.weightage * paramScore;
          totalWeight += param.weightage;
        }
      });
    });

    return totalWeight > 0 ? (totalScore / totalWeight).toFixed(2) : 0;
  };

  // Check if all parameters have been rated
  const validateAllParametersRated = () => {
    if (!selectedTemplateDetails) return false;
    
    const missingParameters: string[] = [];
    
    // Check each parameter in each pillar
    selectedTemplateDetails.pillars.forEach((pillar: any) => {
      pillar.parameters.forEach((param: any) => {
        const parameterId = param.id;
        
        // For Yes/No/NA type parameters
        if (param.ratingType === 'yes_no_na') {
          // Check if this parameter has a score (yes, no, or na)
          if (!scores[parameterId] || !scores[parameterId].score || 
              !['yes', 'no', 'na'].includes(scores[parameterId].score)) {
            missingParameters.push(param.name || `Parameter #${parameterId}`);
          }
        } 
        // For other rating types (numerical, etc.)
        else {
          // Check if this parameter has a score
          if (!scores[parameterId] || !scores[parameterId].score) {
            missingParameters.push(param.name || `Parameter #${parameterId}`);
          }
        }
      });
    });
    
    console.log('Missing parameters:', missingParameters);
    console.log('Current scores:', scores);
    
    return {
      isValid: missingParameters.length === 0,
      missingParameters
    };
  };

  // Confirmation state for dialog
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingEvaluation, setPendingEvaluation] = useState<any>(null);

  const handleSubmit = () => {
    if (!selectedBatch || !selectedTrainee || !selectedTemplate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select batch, trainee and template",
      });
      return;
    }

    // Validate all parameters are rated
    const validation = validateAllParametersRated();
    if (!validation.isValid) {
      toast({
        variant: "destructive",
        title: "Incomplete Evaluation",
        description: `Please select Yes, No, or NA for all parameters. Missing: ${validation.missingParameters.slice(0, 3).join(", ")}${validation.missingParameters.length > 3 ? ` and ${validation.missingParameters.length - 3} more...` : ""}`,
      });
      return;
    }

    // Create evaluation object
    const evaluation = {
      templateId: selectedTemplate,
      traineeId: selectedTrainee,
      batchId: selectedBatch,
      evaluatorId: user?.id,
      scores: Object.entries(scores).map(([parameterId, value]) => ({
        parameterId: parseInt(parameterId),
        ...value,
      })),
      finalScore: calculateScore(),
    };

    // Store evaluation and show confirmation dialog
    setPendingEvaluation(evaluation);
    setShowConfirmation(true);
  };

  // Function to submit after confirmation
  const confirmAndSubmit = () => {
    if (pendingEvaluation) {
      submitEvaluationMutation.mutate(pendingEvaluation);
      setShowConfirmation(false);
    }
  };

  // Reset dependent fields when batch changes
  const handleBatchChange = (batchId: string) => {
    setSelectedBatch(parseInt(batchId));
    setSelectedTrainee(null);
    setSelectedTemplate(null);
    setScores({});
  };

  // All audio functionality removed

  // Audio functionality removed

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Evaluation Submission</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to submit an evaluation with a final score of <strong>{calculateScore()}%</strong>.
              <div className="mt-4 p-3 border rounded bg-muted/30">
                <h4 className="font-medium mb-2">Evaluation Summary:</h4>
                <ul className="space-y-1 text-sm">
                  <li><span className="font-medium">Template:</span> {selectedTemplateDetails?.name}</li>
                  <li><span className="font-medium">Trainee:</span> {trainees?.find((t: any) => t.id === selectedTrainee)?.fullName}</li>
                  <li><span className="font-medium">Parameters Rated:</span> {Object.keys(scores).length} / {selectedTemplateDetails?.pillars?.reduce((acc: number, pillar: any) => acc + pillar.parameters.length, 0)}</li>
                </ul>
              </div>
              <p className="mt-4">Are you sure you want to submit this evaluation?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndSubmit} className="bg-primary">
              {submitEvaluationMutation.isPending ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Submitting...
                </>
              ) : (
                "Confirm Submission"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Evaluation Details Dialog */}
      <EvaluationDetailsDialog
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        evaluationDetails={evaluationDetails}
        loading={loadingDetails}
      />
      
      <Tabs
        defaultValue="standard"
        onValueChange={(value) =>
          setEvaluationType(value as "standard" | "audio")
        }
      >
        <TabsList className="mb-4">
          <TabsTrigger value="standard">Standard Evaluation</TabsTrigger>
          <TabsTrigger value="audio">Audio Evaluation</TabsTrigger>
        </TabsList>
        
        {/* Evaluation Details View Button */}
        <div className="mt-4 mb-6">
          <Button 
            variant="outline" 
            className="flex items-center gap-2 bg-muted/20 hover:bg-muted/30"
            onClick={handleViewRecentEvaluation}
          >
            <Eye className="h-4 w-4" />
            View Evaluation Details
          </Button>
        </div>

        <TabsContent value="standard" className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">
              {isCertification ? "Conduct Certification Evaluation" : "Conduct Standard Evaluation"}
            </h1>
            <div className="flex gap-4">
              {/* Batch Selection */}
              <div className="w-[200px]">
                <Select
                  onValueChange={handleBatchChange}
                  value={selectedBatch?.toString()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches?.map((batch: any) => (
                      <SelectItem key={batch.id} value={batch.id.toString()}>
                        {batch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Trainee Selection - Only enabled if batch is selected */}
              <div className="w-[200px]">
                <Select
                  onValueChange={(value) => setSelectedTrainee(parseInt(value))}
                  value={selectedTrainee?.toString()}
                  disabled={!selectedBatch}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Trainee" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainees?.map((trainee: any) => (
                      <SelectItem
                        key={trainee.id}
                        value={trainee.id.toString()}
                      >
                        {trainee.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template Selection - Only enabled if trainee is selected */}
              <div className="w-[200px]">
                <Select
                  onValueChange={(value) =>
                    setSelectedTemplate(parseInt(value))
                  }
                  value={selectedTemplate?.toString()}
                  disabled={!selectedTrainee}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template: any) => (
                      <SelectItem
                        key={template.id}
                        value={template.id.toString()}
                      >
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Standard Evaluation Form - Only show after selections */}
          {selectedBatch && selectedTrainee && selectedTemplate && selectedTemplateDetails && (
            <div className="mt-6">
              <Card className="border-primary/10">
                <CardHeader className="bg-primary/5 border-b border-primary/10 pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-primary" />
                      <span>{isCertification ? "Certification Form" : "Evaluation Form"}</span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-normal">
                        Final Score: {calculateScore()}%
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    {selectedTemplateDetails.description ||
                      "Please complete all required fields below for a thorough evaluation"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="text-sm px-4 py-3 bg-muted/30 border-b">
                    <strong>Template:</strong> {selectedTemplateDetails.name}
                  </div>
                  <div className="p-4">
                    <Accordion type="multiple" className="space-y-4">
                      {selectedTemplateDetails.pillars.map((pillar: any) => (
                        <AccordionItem
                          key={pillar.id}
                          value={pillar.id.toString()}
                          className="border border-border rounded-md overflow-hidden"
                        >
                          <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 [&[data-state=open]]:bg-muted/30">
                            <div className="flex gap-2 items-center">
                              <span className="font-medium">{pillar.name}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-0 mt-0">
                            <div className="divide-y border-t">
                              {pillar.parameters.map((param: any) => (
                                <div
                                  key={param.id}
                                  className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4"
                                >
                                  <div className="lg:col-span-5 space-y-1">
                                    <div className="font-medium">{param.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {param.description}
                                    </div>
                                    {param.weightageEnabled && (
                                      <Badge variant="outline" className="mt-1">
                                        Weightage: {param.weightage}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="lg:col-span-7 space-y-3">
                                    {param.ratingType === "yes_no_na" ? (
                                      <div className="flex gap-3 flex-wrap">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="radio"
                                            id={`${param.id}-yes`}
                                            name={`param-${param.id}`}
                                            value="yes"
                                            className="h-4 w-4 accent-primary"
                                            onChange={() =>
                                              handleScoreChange(param.id, "yes")
                                            }
                                            checked={scores[param.id]?.score === "yes"}
                                          />
                                          <label
                                            htmlFor={`${param.id}-yes`}
                                            className="text-sm font-medium"
                                          >
                                            Yes
                                          </label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="radio"
                                            id={`${param.id}-no`}
                                            name={`param-${param.id}`}
                                            value="no"
                                            className="h-4 w-4 accent-primary"
                                            onChange={() =>
                                              handleScoreChange(param.id, "no")
                                            }
                                            checked={scores[param.id]?.score === "no"}
                                          />
                                          <label
                                            htmlFor={`${param.id}-no`}
                                            className="text-sm font-medium"
                                          >
                                            No
                                          </label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="radio"
                                            id={`${param.id}-na`}
                                            name={`param-${param.id}`}
                                            value="na"
                                            className="h-4 w-4 accent-primary"
                                            onChange={() =>
                                              handleScoreChange(param.id, "na")
                                            }
                                            checked={scores[param.id]?.score === "na"}
                                          />
                                          <label
                                            htmlFor={`${param.id}-na`}
                                            className="text-sm font-medium"
                                          >
                                            N/A
                                          </label>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex gap-3 flex-wrap">
                                        {[1, 2, 3, 4, 5].map((score) => (
                                          <div
                                            key={score}
                                            className="flex items-center gap-2"
                                          >
                                            <input
                                              type="radio"
                                              id={`${param.id}-${score}`}
                                              name={`param-${param.id}`}
                                              value={score.toString()}
                                              className="h-4 w-4 accent-primary"
                                              onChange={() =>
                                                handleScoreChange(
                                                  param.id,
                                                  score.toString()
                                                )
                                              }
                                              checked={
                                                scores[param.id]?.score ===
                                                score.toString()
                                              }
                                            />
                                            <label
                                              htmlFor={`${param.id}-${score}`}
                                              className="text-sm font-medium"
                                            >
                                              {score}
                                            </label>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* "No" Reason Selection */}
                                    {param.ratingType === "yes_no_na" &&
                                      scores[param.id]?.score === "no" && (
                                        <div className="pt-3 space-y-2">
                                          <Label
                                            htmlFor={`${param.id}-no-reason`}
                                            className="text-sm"
                                          >
                                            Reason for "No":
                                          </Label>
                                          <Select
                                            onValueChange={(value) =>
                                              handleNoReasonSelect(param.id, value)
                                            }
                                            value={scores[param.id]?.noReason}
                                          >
                                            <SelectTrigger id={`${param.id}-no-reason`}>
                                              <SelectValue placeholder="Select reason" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="missed">
                                                Missed requirement
                                              </SelectItem>
                                              <SelectItem value="incorrect">
                                                Incorrect implementation
                                              </SelectItem>
                                              <SelectItem value="incomplete">
                                                Incomplete implementation
                                              </SelectItem>
                                              <SelectItem value="other">
                                                Other (specify in comments)
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      )}

                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`${param.id}-comment`}
                                        className="text-sm"
                                      >
                                        Comments:
                                      </Label>
                                      <Textarea
                                        id={`${param.id}-comment`}
                                        placeholder="Enter your comments here"
                                        value={scores[param.id]?.comment || ""}
                                        onChange={(e) =>
                                          handleCommentChange(param.id, e.target.value)
                                        }
                                        className="h-20 resize-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t bg-muted/20 py-3">
                  <Button
                    onClick={handleSubmit}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Submit Evaluation
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="audio" className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Headphones className="h-6 w-6 text-primary" />
              <span>Conduct Audio Evaluation</span>
            </h1>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              {/* Audio File Selection */}
              <div className="w-full sm:w-[280px]">
                <Label htmlFor="audio-file-select" className="mb-1.5 block text-sm font-medium">
                  Audio File
                </Label>
                <Select
                  onValueChange={handleAudioFileSelect}
                  value={selectedAudioFile?.toString()}
                >
                  <SelectTrigger id="audio-file-select" className="bg-background">
                    <SelectValue placeholder="Select Audio File" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignedAudioFiles && assignedAudioFiles.length > 0 ? (
                      assignedAudioFiles.map((file: any) => (
                        <SelectItem
                          key={file.audioFileId || file.id}
                          value={(file.audioFileId || file.id).toString()}
                        >
                          Audio File #{file.audioFileId || file.id}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-files" disabled>
                        No audio files assigned
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Template Selection */}
              <div className="w-full sm:w-[240px]">
                <Label htmlFor="template-select" className="mb-1.5 block text-sm font-medium">
                  Evaluation Template
                </Label>
                <Select
                  onValueChange={(value) => setSelectedTemplate(parseInt(value))}
                  value={selectedTemplate?.toString()}
                  disabled={!selectedAudioFile}
                >
                  <SelectTrigger id="template-select" className="bg-background">
                    <SelectValue placeholder="Select Template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template: any) => (
                      <SelectItem
                        key={template.id}
                        value={template.id.toString()}
                      >
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Audio Player Section */}
            <div className="lg:col-span-5">
              {selectedAudioFileDetails ? (
                <Card className="overflow-hidden border-primary/10">
                  <CardHeader className="bg-primary/5 border-b border-primary/10 pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileAudio className="h-5 w-5 text-primary" />
                      <span className="truncate">
                        Audio File #{selectedAudioFileDetails.id}
                      </span>
                    </CardTitle>
                    <CardDescription className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      <span className="flex items-center">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        <span>{formatTime(duration || 0)}</span>
                      </span>
                      <span className="flex items-center">
                        <Globe className="h-3.5 w-3.5 mr-1" />
                        <span>{selectedAudioFileDetails.language || "Unknown"}</span>
                      </span>
                      <span className="flex items-center">
                        <Tag className="h-3.5 w-3.5 mr-1" />
                        <span>{selectedAudioFileDetails.version || "N/A"}</span>
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    {/* Audio Element */}
                    <audio
                      ref={audioRef}
                      src={audioUrl || ""}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      className="w-full mb-4"
                      controls
                      preload="metadata"
                    />
                    
                    {/* Enhanced Controls */}
                    {audioUrl && (
                      <div className="space-y-3">
                        {/* Basic Controls */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handlePlayPause}
                            disabled={!audioUrl}
                          >
                            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (audioRef.current) {
                                audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
                              }
                            }}
                          >
                            <SkipBack className="h-4 w-4" />
                            10s
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (audioRef.current) {
                                audioRef.current.currentTime = Math.min(
                                  audioRef.current.duration,
                                  audioRef.current.currentTime + 10
                                );
                              }
                            }}
                          >
                            <SkipForward className="h-4 w-4" />
                            10s
                          </Button>
                          <div className="text-sm text-muted-foreground">
                            {formatTime(currentTime)} / {formatTime(duration)}
                          </div>
                        </div>
                      </div>
                    )}

                    {!audioUrl && (
                      <div className="p-4 bg-muted/20 rounded-md text-center">
                        <p className="text-sm text-muted-foreground">
                          Select an audio file from the dropdown above to begin streaming and evaluation.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Audio files will be streamed directly from Azure Blob Storage.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full flex items-center justify-center p-8 text-center border-dashed">
                  <div className="flex flex-col items-center max-w-sm">
                    <FileAudio className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Audio Selected</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Please select an audio file from the dropdown above to begin your evaluation.
                    </p>
                  </div>
                </Card>
              )}
            </div>

            {/* Evaluation Form Section */}
            <div className="lg:col-span-7">
              {selectedAudioFileDetails && selectedTemplateDetails ? (
                <div className="space-y-5">
                  <Card className="border-primary/10">
                    <CardHeader className="bg-primary/5 border-b border-primary/10 pb-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <ClipboardCheck className="h-5 w-5 text-primary" />
                          <span>Evaluation Form</span>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-normal">
                            Final Score: {calculateScore()}%
                          </Badge>
                        </div>
                      </div>
                      <CardDescription>
                        {selectedTemplateDetails.description ||
                          "Please complete all required fields below for a thorough evaluation"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="text-sm px-4 py-3 bg-muted/30 border-b">
                        <strong className="font-medium">Instructions:</strong> Evaluate the audio recording using the criteria below. Mark N/A for criteria that don't apply.
                      </div>
                      <div className="p-4 max-h-[calc(100vh-20rem)] overflow-y-auto">
                        <Accordion
                          type="multiple"
                          defaultValue={selectedTemplateDetails.pillars.map((p: any) => p.id.toString())}
                          className="space-y-4"
                        >
                          {selectedTemplateDetails.pillars.map((pillar: any) => (
                            <AccordionItem
                              key={pillar.id}
                              value={pillar.id.toString()}
                              className="border rounded-lg overflow-hidden"
                            >
                              <AccordionTrigger className="px-4 py-3 hover:no-underline bg-muted/20 hover:bg-muted/30">
                                <div className="flex items-center gap-2 text-left">
                                  <span className="font-medium">{pillar.name}</span>
                                  <Badge variant="outline" className="ml-2 font-normal">
                                    {pillar.weightage}%
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="p-4 pt-2">
                                <div className="text-sm text-muted-foreground mb-4">
                                  {pillar.description}
                                </div>
                                <div className="space-y-5">
                                  {pillar.parameters.map((param: any) => (
                                    <div
                                      key={param.id}
                                      className="border rounded-md overflow-hidden"
                                    >
                                      <div className="p-3 bg-muted/10 border-b">
                                        <div className="flex justify-between items-start">
                                          <div className="flex items-start gap-2">
                                            <div>
                                              <h4 className="font-medium text-sm flex items-center gap-2">
                                                {param.name}
                                                {param.isFatal && (
                                                  <Badge variant="destructive" className="ml-1 text-[10px] py-0 h-4">
                                                    Fatal
                                                  </Badge>
                                                )}
                                              </h4>
                                              <p className="text-xs text-muted-foreground mt-1">
                                                {param.description}
                                              </p>
                                            </div>
                                          </div>
                                          {param.weightageEnabled && (
                                            <Badge variant="outline" className="font-normal">
                                              {param.weightage}%
                                            </Badge>
                                          )}
                                        </div>
                                        {param.guidelines && (
                                          <div className="mt-2 text-xs bg-muted/30 p-2 rounded">
                                            <strong>Guidelines:</strong> {param.guidelines}
                                          </div>
                                        )}
                                      </div>
                                      <div className="p-3 space-y-3">
                                        {param.ratingType === "yes_no_na" ? (
                                          <div className="space-y-3">
                                            <Select
                                              onValueChange={(value) =>
                                                handleScoreChange(param.id, value)
                                              }
                                              value={scores[param.id]?.score}
                                            >
                                              <SelectTrigger>
                                                <SelectValue placeholder="Select Rating" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="yes">Yes</SelectItem>
                                                <SelectItem value="no">No</SelectItem>
                                                <SelectItem value="na">N/A</SelectItem>
                                              </SelectContent>
                                            </Select>

                                            {scores[param.id]?.score === "no" &&
                                              param.noReasons && (
                                                <Select
                                                  onValueChange={(value) =>
                                                    handleNoReasonSelect(param.id, value)
                                                  }
                                                >
                                                  <SelectTrigger>
                                                    <SelectValue placeholder="Select Reason" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {param.noReasons.map(
                                                      (reason: string, idx: number) => (
                                                        <SelectItem key={idx} value={reason}>
                                                          {reason}
                                                        </SelectItem>
                                                      ),
                                                    )}
                                                  </SelectContent>
                                                </Select>
                                              )}
                                          </div>
                                        ) : param.ratingType === "numeric" ? (
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <Label htmlFor={`numeric-score-${param.id}`}>
                                                Score (1-5)
                                              </Label>
                                              <span className="text-sm font-medium">
                                                {scores[param.id]?.score || "-"}
                                              </span>
                                            </div>
                                            <Slider
                                              id={`numeric-score-${param.id}`}
                                              min={1}
                                              max={5}
                                              step={1}
                                              value={[scores[param.id]?.score ? parseInt(scores[param.id].score) : 3]}
                                              onValueChange={(value) =>
                                                handleScoreChange(param.id, value[0].toString())
                                              }
                                              className="w-full"
                                            />
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                              <span>Poor (1)</span>
                                              <span>Excellent (5)</span>
                                            </div>
                                          </div>
                                        ) : null}

                                        {/* Comment Section */}
                                        <div className="space-y-2">
                                          <Label htmlFor={`${param.id}-comment`} className="text-xs">
                                            Comments (Optional)
                                          </Label>
                                          <Textarea
                                            id={`${param.id}-comment`}
                                            placeholder="Enter your comments here"
                                            value={scores[param.id]?.comment || ""}
                                            onChange={(e) =>
                                              handleCommentChange(param.id, e.target.value)
                                            }
                                            className="h-20 resize-none"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    </CardContent>
                    <CardFooter className="border-t p-4 flex justify-between bg-muted/10">
                      <div className="flex items-center">
                        <span className="text-sm text-muted-foreground">
                          Final Score: <strong>{calculateScore()}%</strong>
                        </span>
                      </div>
                      <Button
                        onClick={handleAudioSubmit}
                        disabled={
                          !selectedAudioFile ||
                          !selectedTemplate ||
                          submitEvaluationMutation.isPending
                        }
                        className="flex items-center gap-2"
                      >
                        {submitEvaluationMutation.isPending ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Submit Evaluation
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              ) : selectedAudioFileDetails ? (
                <Card className="h-full flex items-center justify-center p-8 text-center border-dashed">
                  <div className="flex flex-col items-center max-w-sm">
                    <ClipboardList className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Template Selected</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Please select an evaluation template to begin scoring this audio file.
                    </p>
                  </div>
                </Card>
              ) : (
                <Card className="h-full flex items-center justify-center p-8 text-center border-dashed">
                  <div className="flex flex-col items-center max-w-sm">
                    <ClipboardList className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Select Audio to Begin</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      First select an audio file, then choose an evaluation template to proceed.
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Removed duplicate evaluation form section that was causing UI duplication */}
      
      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Evaluation Submission</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3 mt-2">
                <p>Please review the evaluation details before final submission:</p>
                <div className="bg-muted p-3 rounded-md">
                  <p><strong>Final Score:</strong> {pendingEvaluation?.finalScore || calculateScore()}%</p>
                  {selectedTemplateDetails && (
                    <p><strong>Template:</strong> {selectedTemplateDetails.name}</p>
                  )}
                  {selectedTrainee && (
                    <p><strong>Trainee:</strong> Selected Trainee ID: {selectedTrainee}</p>
                  )}

                </div>
                <p>Are you sure you want to submit this evaluation?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndSubmit}>
              {submitEvaluationMutation.isPending ? (
                <div className="flex items-center">
                  <Spinner className="mr-2 h-4 w-4" /> Submitting...
                </div>
              ) : "Submit Evaluation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Evaluation Details Dialog */}
      <EvaluationDetailsDialog
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        evaluationDetails={evaluationDetails}
        loading={loadingDetails}
      />
    </div>
  );
}

// Permission guard wrapper
const PermissionGuardedConductEvaluation = () => {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission('manage_conduct_form')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <h2 className="text-2xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground mb-4">
          You do not have permission to access the Conduct Evaluation section.
        </p>
        <Button asChild variant="outline">
          <a href="/">Return to Dashboard</a>
        </Button>
      </div>
    );
  }
  
  return <ConductEvaluation />;
};

export default PermissionGuardedConductEvaluation;
