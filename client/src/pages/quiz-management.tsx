import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import type { Question, QuizTemplate, OrganizationBatch } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Alert,
  AlertDescription,
  AlertTitle
} from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  Pencil, 
  Trash2, 
  Loader2, 
  PlayCircle, 
  Edit, 
  Eye, 
  EyeOff,
  ShieldAlert, 
  Clock, 
  FileQuestion, 
  CheckCircle2,
  CalendarDays,
  Briefcase,
  User,
  BarChart,
  X
} from "lucide-react";

// Process filter form schema
const filterFormSchema = z.object({
  processId: z.string().optional()
});

// Add templateFilterFormSchema
const templateFilterFormSchema = z.object({
  processId: z.string().default("all")
});

// Process type definitions
interface Process {
  id: number;
  name: string;
  description?: string;
  status: string;
}

interface QuestionWithProcess extends Question {
  process?: Process;
  active: boolean;
}

// Question form schema
const questionFormSchema = z.object({
  question: z.string().min(1, "Question is required"),
  type: z.enum(["multiple_choice", "true_false", "short_answer"]),
  options: z.array(z.string()).default([]),
  correctAnswer: z.string().min(1, "Correct answer is required"),
  explanation: z.string().optional(),
  difficultyLevel: z.number().int().min(1).max(5),
  category: z.string().min(1, "Category is required"),
  processId: z.number().min(1).optional()
});

// Quiz template schema
const quizTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  timeLimit: z.number().int().min(1, "Time limit is required"),
  questionCount: z.number().int().min(1, "Question count is required"),
  passingScore: z.number().int().min(0).max(100, "Passing score must be between 0 and 100"),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  oneTimeOnly: z.boolean().default(false),
  quizType: z.enum(["internal", "final"]).default("internal"),
  categoryDistribution: z.record(z.string(), z.number()).optional(),
  difficultyDistribution: z.record(z.string(), z.number()).optional(),
  processId: z.number().min(1, "Process is required"),
  batchId: z.union([z.number(), z.literal("none")]).optional(),
});

// Define all types after schemas
type QuestionFormValues = z.infer<typeof questionFormSchema>;
type QuizTemplateFormValues = z.infer<typeof quizTemplateSchema>;
type FilterFormValues = z.infer<typeof filterFormSchema>;
type TemplateFilterFormValues = z.infer<typeof templateFilterFormSchema>;

// Component to display quiz template details including process name, batch name, and trainer
interface QuizTemplateDetailsSectionProps {
  template: QuizTemplate;
  processes: Process[];
  batches: OrganizationBatch[];
}

export function QuizManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [isAddTemplateOpen, setIsAddTemplateOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<number | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<QuizTemplate | null>(null);
  const [deletingQuizId, setDeletingQuizId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Create a form for the process filter
  const filterForm = useForm<FilterFormValues>({
    resolver: zodResolver(filterFormSchema),
    defaultValues: {
      processId: "all"
    }
  });

  // Get selected process ID from form
  const selectedProcessId = filterForm.watch("processId") !== "all" ? parseInt(filterForm.watch("processId")) : null;

  // Update process query with proper typing
  const { data: processes = [], isLoading: processesLoading } = useQuery<Process[]>({
    queryKey: ['/api/processes'],
    enabled: !!user?.organizationId
  });
  
  // Add query for batches
  const { data: batches = [], isLoading: batchesLoading } = useQuery<OrganizationBatch[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId
  });

  // Update the questions query with detailed logging to include all questions (active and inactive)
  const { data: allQuestions = [], isLoading: questionsLoading } = useQuery<QuestionWithProcess[]>({
    queryKey: ['/api/questions', selectedProcessId, true], // Add true to include inactive questions
    queryFn: async () => {
      try {
        const url = new URL('/api/questions', window.location.origin);

        if (selectedProcessId) {
          url.searchParams.append('processId', selectedProcessId.toString());
          console.log('[Quiz Management] Fetching questions with URL:', url.toString());
          console.log('[Quiz Management] Selected Process ID:', selectedProcessId);
        } else {
          console.log('[Quiz Management] Fetching all questions (no process filter)');
        }
        
        // Include both active and inactive questions
        url.searchParams.append('includeInactive', 'true');

        const response = await fetch(url, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error('Failed to fetch questions');
        }

        const data = await response.json();
        console.log('[Quiz Management] API Response:', {
          selectedProcess: selectedProcessId,
          questionCount: data.length,
          questions: data.map((q: QuestionWithProcess) => ({ id: q.id, processId: q.processId, active: q.active }))
        });

        return data;
      } catch (error) {
        console.error('[Quiz Management] Error fetching questions:', error);
        throw error;
      }
    },
    enabled: !!user?.organizationId,
  });
  
  // Separate questions into active and inactive
  const activeQuestions = useMemo(() => {
    return allQuestions.filter(q => q.active);
  }, [allQuestions]);
  
  const inactiveQuestions = useMemo(() => {
    return allQuestions.filter(q => !q.active);
  }, [allQuestions]);
  
  // Filter questions based on search term
  const filteredActiveQuestions = useMemo(() => {
    if (!searchTerm.trim()) return activeQuestions;
    return activeQuestions.filter(q => 
      q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.process?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activeQuestions, searchTerm]);
  
  const filteredInactiveQuestions = useMemo(() => {
    if (!searchTerm.trim()) return inactiveQuestions;
    return inactiveQuestions.filter(q => 
      q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.process?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inactiveQuestions, searchTerm]);

  const templateForm = useForm<QuizTemplateFormValues>({
    resolver: zodResolver(quizTemplateSchema),
    defaultValues: {
      timeLimit: 10,
      questionCount: 10,
      passingScore: 70,
      shuffleQuestions: false,
      shuffleOptions: false,
      oneTimeOnly: false,
      quizType: "internal"
    }
  });

  const questionForm = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      type: "multiple_choice",
      difficultyLevel: 1,
      options: ["", ""],
      category: "",
      processId: undefined
    }
  });

  // Add update mutation
  const updateQuestionMutation = useMutation({
    mutationFn: async (data: { id: number; question: Partial<Question> }) => {
      const response = await fetch(`/api/questions/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data.question),
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to update question');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/questions', selectedProcessId, true] });
      toast({
        title: "Success",
        description: "Question updated successfully",
      });
      setEditingQuestion(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add delete mutation
  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/questions/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to delete question');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/questions', selectedProcessId, true] });
      toast({
        title: "Success",
        description: "Question deleted successfully",
      });
      setDeletingQuestionId(null);
    },
    onError: (error: Error) => {
      // Handle different error scenarios with user-friendly messages
      let errorMessage = error.message;
      let errorTitle = "Error";
      
      if (errorMessage.includes("permission") || errorMessage.includes("not authorized")) {
        errorMessage = "You don't have permission to delete this question. Please contact your administrator.";
        errorTitle = "Permission Denied";
      } else if (errorMessage.includes("not found")) {
        errorMessage = "This question couldn't be found. It may have been removed by another user.";
        errorTitle = "Question Not Found";
      } else if (errorMessage.includes("in use") || errorMessage.includes("reference")) {
        errorMessage = "This question is being used in one or more quizzes and cannot be deleted.";
        errorTitle = "Cannot Delete";
      } else if (errorMessage.includes("network") || errorMessage.includes("connection")) {
        errorMessage = "Network connection issue. Please check your internet connection and try again.";
        errorTitle = "Connection Error";
      } else {
        errorMessage = "There was a problem deleting the question. Please try again later.";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
  
  // Add toggle active mutation
  const toggleQuestionActiveMutation = useMutation({
    mutationFn: async ({ id, currentState }: { id: number, currentState: boolean }) => {
      console.log(`Attempting to toggle question ${id} active state from ${currentState} to ${!currentState}`);
      
      const response = await fetch(`/api/questions/${id}/toggle-active`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Log the response details for debugging
      console.log(`Toggle response status: ${response.status}, Content-Type: ${response.headers.get('content-type')}`);
      
      if (!response.ok) {
        // If the response is 401, it's an authentication error
        if (response.status === 401) {
          console.error('Authentication error when toggling question state');
          throw new Error('Authentication failed. Please refresh the page and try again.');
        }
        
        // Try to parse error message from response, but handle case where it's not JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            console.error('Server returned error:', errorData);
            throw new Error(errorData.message || 'Failed to toggle question active state');
          } catch (e) {
            console.error('Error parsing JSON response:', e);
            throw new Error(`Failed to toggle question active state: ${response.statusText}`);
          }
        } else {
          // If the response is not JSON, log and handle accordingly
          const text = await response.text();
          console.error('Received non-JSON response:', text);
          throw new Error('Server returned an unexpected response. Please try again later.');
        }
      }
      
      const text = await response.text();
      let data;
      
      try {
        // Only try to parse as JSON if there's actually content to parse
        if (text.trim()) {
          data = JSON.parse(text);
          console.log('Toggle successful:', data);
        } else {
          // Handle empty response
          data = { message: "Question status updated successfully" };
        }
      } catch (e) {
        console.error('Error parsing success response:', e);
        // Provide a more helpful message
        data = { 
          message: currentState ? "Question deactivated successfully" : "Question activated successfully",
          parseFailed: true 
        };
      }
      
      return { ...data, id, newState: !currentState };
    },
    onSuccess: (data) => {
      console.log('Toggle successful, invalidating queries...', data);
      // Invalidate the questions query to refetch the updated data
      queryClient.invalidateQueries({ queryKey: ['/api/questions', selectedProcessId, true] });
      
      toast({
        title: "Success",
        description: data.message || "Question state updated successfully",
      });
    },
    onError: (error: Error) => {
      console.error('Error in toggle active mutation:', error);
      
      // Create user-friendly error messages for toggle active/inactive
      let errorMessage = error.message;
      let errorTitle = "Action Failed";
      
      if (errorMessage.includes("permission") || errorMessage.includes("not authorized") || errorMessage.includes("Authentication failed")) {
        errorMessage = "You don't have permission to change the status of this question.";
        errorTitle = "Permission Denied";
      } else if (errorMessage.includes("not found")) {
        errorMessage = "This question couldn't be found. It may have been deleted by another user.";
        errorTitle = "Question Not Found";
      } else if (errorMessage.includes("in use") || errorMessage.includes("reference")) {
        errorMessage = "This question is currently in use and its status cannot be changed.";
        errorTitle = "Cannot Update";
      } else if (errorMessage.includes("network") || errorMessage.includes("connection")) {
        errorMessage = "Network connection issue. Please check your internet connection and try again.";
        errorTitle = "Connection Error";
      } else {
        errorMessage = "Unable to change question status. Please try again later.";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmitQuestion = async (data: QuestionFormValues) => {
    if (!user?.organizationId || !user?.id) {
      toast({
        title: "Error",
        description: "User or organization information not found",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingQuestion) {
        // Update existing question
        await updateQuestionMutation.mutateAsync({
          id: editingQuestion.id,
          question: {
            ...data,
            options: data.type === 'multiple_choice' ? data.options : [],
            organizationId: user.organizationId,
          },
        });
      } else {
        // Create new question (existing logic)
        const questionData = {
          ...data,
          options: data.type === 'multiple_choice' ? data.options : [],
          organizationId: user.organizationId,
          createdBy: user.id
        };

        const response = await fetch('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(questionData),
          credentials: 'include'
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to add question');
        }

        await queryClient.invalidateQueries({ queryKey: ['/api/questions', selectedProcessId, true] });

        toast({
          title: "Success",
          description: "Question added successfully",
        });
      }
      setIsAddQuestionOpen(false);
      setEditingQuestion(null);
      questionForm.reset();
    } catch (error) {
      console.error('Error saving question:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save question",
        variant: "destructive",
      });
    }
  };

  const onSubmitTemplate = async (data: QuizTemplateFormValues) => {
    if (!user?.organizationId || !user?.id) {
      toast({
        title: "Error",
        description: "User or organization information not found",
        variant: "destructive",
      });
      return;
    }

    // Validate that questions have been previewed and selected
    if (!editingTemplate && previewQuestions.length === 0) {
      toast({
        title: "Error",
        description: "Please preview questions before creating the template",
        variant: "destructive",
      });
      return;
    }

    try {
      // Process batch ID - we've already set an appropriate value in the dropdown
      // The server will convert "none" to null
      console.log(`Template batch ID: ${data.batchId || 'none'}`);
      
      if (editingTemplate) {
        // Update existing template
        await updateTemplateMutation.mutateAsync({
          id: editingTemplate.id,
          template: {
            ...data,
            organizationId: user.organizationId,
          },
        });
      } else {
        // Create new template
        const templateData = {
          ...data,
          organizationId: user.organizationId,
          createdBy: user.id,
          processId: data.processId,
          questions: previewQuestions.map(q => q.id) // Include the preview questions
        };

        const response = await fetch('/api/quiz-templates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(templateData),
          credentials: 'include'
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to add template');
        }

        await queryClient.invalidateQueries({ queryKey: ['/api/quiz-templates'] });

        toast({
          title: "Success",
          description: "Quiz template added successfully",
        });
      }
      setIsAddTemplateOpen(false);
      setEditingTemplate(null);
      setPreviewQuestions([]);
      templateForm.reset();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save template",
        variant: "destructive",
      });
    }
  };

  // Update deleteTemplateMutation implementation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/quiz-templates/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      // Even if we get an error, if the template is gone, consider it a success
      if (!response.ok) {
        const errorData = await response.json();
        // If the error is "Quiz template not found", it means it was already deleted
        if (errorData.message === "Quiz template not found") {
          return true;
        }
        throw new Error(errorData.message || 'Failed to delete template');
      }
      return true;
    },
    onSuccess: () => {
      // Invalidate both filtered and unfiltered queries
      queryClient.invalidateQueries({
        queryKey: ['/api/quiz-templates']
      });
      toast({
        title: "Success",
        description: "Quiz template deleted successfully",
      });
      setDeletingTemplateId(null);
    },
    onError: (error: Error) => {
      // Handle different error scenarios with user-friendly messages
      let errorMessage = error.message;
      let errorTitle = "Error";
      
      if (errorMessage.includes("permission") || errorMessage.includes("not authorized")) {
        errorMessage = "You don't have permission to delete this quiz template. Please contact your administrator.";
        errorTitle = "Permission Denied";
      } else if (errorMessage.includes("in use") || errorMessage.includes("active quizzes")) {
        errorMessage = "This template has active quizzes and cannot be deleted. Please delete all associated quizzes first.";
        errorTitle = "Cannot Delete";
      } else if (errorMessage.includes("network") || errorMessage.includes("connection")) {
        errorMessage = "Network connection issue. Please check your internet connection and try again.";
        errorTitle = "Connection Error";
      } else {
        errorMessage = "Unable to delete the quiz template. Please try again later.";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
      
      setDeletingTemplateId(null);
      // Force a refetch to ensure UI is in sync
      queryClient.invalidateQueries({
        queryKey: ['/api/quiz-templates']
      });
    },
  });

  // Add update mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (data: { id: number; template: Partial<QuizTemplate> }) => {
      const response = await fetch(`/api/quiz-templates/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data.template),
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update template');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all quiz template queries to ensure UI updates
      queryClient.invalidateQueries({
        queryKey: ['/api/quiz-templates']
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/quiz-templates', selectedTemplateProcessId !== 'all' ? parseInt(selectedTemplateProcessId) : null]
      });
      toast({
        title: "Success",
        description: "Quiz template updated successfully",
      });
      setEditingTemplate(null);
      setIsAddTemplateOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add delete quiz mutation after the updateTemplateMutation
  const deleteQuizMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/quizzes/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete quiz');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/quizzes']
      });
      toast({
        title: "Success",
        description: "Quiz deleted successfully",
      });
      setDeletingQuizId(null);
    },
    onError: (error: Error) => {
      // Handle different error scenarios with user-friendly messages
      let errorMessage = error.message;
      let errorTitle = "Delete Failed";
      
      if (errorMessage.includes("permission") || errorMessage.includes("not authorized")) {
        errorMessage = "You don't have permission to delete this quiz. Please contact your administrator.";
        errorTitle = "Permission Denied";
      } else if (errorMessage.includes("in progress") || errorMessage.includes("attempts")) {
        errorMessage = "This quiz has active attempts and cannot be deleted. Please wait until all attempts are complete.";
        errorTitle = "Quiz In Use";
      } else if (errorMessage.includes("network") || errorMessage.includes("connection")) {
        errorMessage = "Network connection issue. Please check your internet connection and try again.";
        errorTitle = "Connection Error";
      } else {
        errorMessage = "Unable to delete the quiz. Please try again later.";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
      setDeletingQuizId(null);
    },
  });

  // Add state for tracking selected questions preview
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);

  // Search functionality is already defined at the top of component

  // Add state for tracking unique categories from questions
  const categories = useMemo(() => {
    if (!allQuestions) return new Set<string>();
    return new Set(allQuestions.map((q: QuestionWithProcess) => q.category));
  }, [allQuestions]);

  const difficulties = [1, 2, 3, 4, 5];

  // Add function to preview random questions
  const previewRandomQuestions = async (data: QuizTemplateFormValues) => {
    setIsPreviewLoading(true);
    try {
      const params = new URLSearchParams({
        count: data.questionCount.toString(),
      });

      if (data.categoryDistribution) {
        params.append('categoryDistribution', JSON.stringify(data.categoryDistribution));
      }
      if (data.difficultyDistribution) {
        params.append('difficultyDistribution', JSON.stringify(data.difficultyDistribution));
      }

      const response = await fetch(`/api/random-questions?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to get random questions');
      }

      const randomQuestions = await response.json();
      setPreviewQuestions(randomQuestions);
    } catch (error) {
      console.error('Error previewing questions:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to preview questions",
        variant: "destructive",
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };


  // Update the process selection handler
  const handleProcessChange = (value: string) => {
    console.log('[Quiz Management] Process selection changed:', {
      newValue: value,
      parsedId: value === 'all' ? null : parseInt(value)
    });

    filterForm.setValue('processId', value);
    // Force refetch questions with new process filter
    queryClient.invalidateQueries({
      queryKey: ['/api/questions', value === 'all' ? null : parseInt(value), true]
    });
  };

  // Adding proper state management for edit dialog
  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setIsAddQuestionOpen(true);
    questionForm.reset({
      question: question.question,
      type: question.type,
      options: question.options || ["", ""],
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || "",
      difficultyLevel: question.difficultyLevel,
      category: question.category,
      processId: question.processId,
    });
  };

  // Add state for template process filter
  const [selectedTemplateProcessId, setSelectedTemplateProcessId] = useState<string>("all");

  // Add form for template filter
  const templateFilterForm = useForm<TemplateFilterFormValues>({
    resolver: zodResolver(templateFilterFormSchema),
    defaultValues: {
      processId: "all"
    }
  });

  // Add query for quiz templates with process filtering
  const { data: quizTemplates = [], isLoading: templatesLoading } = useQuery<QuizTemplate[]>({
    queryKey: ['/api/quiz-templates', selectedTemplateProcessId !== 'all' ? parseInt(selectedTemplateProcessId) : null],
    queryFn: async () => {
      const url = new URL('/api/quiz-templates', window.location.origin);
      
      // Add process ID to query params if a specific process is selected
      if (selectedTemplateProcessId !== 'all') {
        url.searchParams.append('processId', selectedTemplateProcessId);
      }
      
      const response = await fetch(url, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch quiz templates');
      }
      
      const templates = await response.json();
      
      // If we need to filter on the client side as a fallback
      if (selectedTemplateProcessId !== 'all') {
        return templates.filter(t => t.processId === parseInt(selectedTemplateProcessId));
      }
      
      return templates;
    },
    enabled: !!user?.organizationId
  });

  // Add function to handle edit template
  const handleEditTemplate = (template: QuizTemplate) => {
    setEditingTemplate(template);
    setIsAddTemplateOpen(true);
    templateForm.reset({
      name: template.name,
      description: template.description || "",
      timeLimit: template.timeLimit,
      questionCount: template.questionCount,
      passingScore: template.passingScore,
      shuffleQuestions: template.shuffleQuestions,
      shuffleOptions: template.shuffleOptions,
      oneTimeOnly: template.oneTimeOnly,
      quizType: template.quizType || "internal",
      processId: template.processId,
      batchId: template.batchId,
      categoryDistribution: template.categoryDistribution || {},
      difficultyDistribution: template.difficultyDistribution || {},
    });
  };

  // State for quiz duration selection
  const [selectedDuration, setSelectedDuration] = useState<number>(1);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  // Update the generateQuizMutation to provide better feedback
  // Add state for trainee selection
  const [assignmentType, setAssignmentType] = useState<'all' | 'specific'>('all');
  const [selectedTrainees, setSelectedTrainees] = useState<number[]>([]);
  const [traineesData, setTraineesData] = useState<{userId: number; fullName: string}[]>([]);
  
  // Update the generateQuizMutation to support trainee-specific assignments
  const generateQuizMutation = useMutation({
    mutationFn: async ({ 
      templateId, 
      durationInHours,
      trainees 
    }: { 
      templateId: number; 
      durationInHours: number;
      trainees?: number[] 
    }) => {
      // Get the template to check if it has a batch
      const template = quizTemplates.find(t => t.id === templateId);
      const hasBatch = template && template.batchId;
      
      // Prepare the request body
      const requestBody: any = {
        status: 'active',
        durationInHours
      };
      
      // Determine assignment strategy
      if (hasBatch) {
        if (assignmentType === 'all') {
          // Assign to all trainees in batch
          requestBody.assignToAllBatch = true;
        } else if (trainees && trainees.length > 0) {
          // Assign to specific trainees
          requestBody.assignToUsers = trainees;
        }
      }
      
      console.log('Generating quiz with parameters:', {
        templateId,
        durationInHours,
        assignmentType,
        assignToAllBatch: requestBody.assignToAllBatch,
        assignToUsers: requestBody.assignToUsers
      });
      
      // Generate the quiz with assignments in a single request
      const response = await fetch(`/api/quiz-templates/${templateId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate quiz');
      }
      
      const quizData = await response.json();
      return quizData;
    },
    onSuccess: (data) => {
      // Store the newly generated quiz ID
      const generatedQuizId = data.id;
      
      // Close the dialog
      setIsGenerateDialogOpen(false);
      
      // Clear the selection
      setSelectedTemplateId(null);
      setSelectedTrainees([]);
      setAssignmentType('all');
      
      queryClient.invalidateQueries({ queryKey: ['/api/quizzes'] });
      toast({
        title: "Success",
        description: (
          <div className="flex flex-col gap-2">
            <p>Quiz #{generatedQuizId} has been generated and is now available to trainees</p>
            <p className="text-sm text-muted-foreground">
              Available from {new Date(data.startTime).toLocaleString()} to {new Date(data.endTime).toLocaleString()}
            </p>
            <a 
              href={`/quiz/${generatedQuizId}`} 
              className="text-blue-500 underline hover:text-blue-700 font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              View this quiz
            </a>
          </div>
        ),
        duration: 10000, // Show for 10 seconds to give user time to click the link
      });
      
      // Also invalidate the quiz templates to refresh any stats or indicators
      queryClient.invalidateQueries({ queryKey: ['/api/quiz-templates'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Quiz Management</h1>

      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">Question Bank</TabsTrigger>
          <TabsTrigger value="templates">Quiz Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="questions">
          <Card className="p-4">
            <div className="flex flex-col gap-4">
              {/* Process Filter Form */}
              <Form {...filterForm}>
                <form className="flex items-center gap-4">
                  <div className="flex-1">
                    <FormField
                      control={filterForm.control}
                      name="processId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Filter by Process</FormLabel>
                          <Select
                            onValueChange={handleProcessChange}
                            value={filterForm.watch('processId')}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="All Processes" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all">All Processes</SelectItem>
                              {processes.map((process) => (
                                <SelectItem key={process.id} value={process.id.toString()}>
                                  {process.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex-1">
                    <FormItem>
                      <FormLabel>Search Questions</FormLabel>
                      <div className="flex items-center relative">
                        <Input
                          type="text"
                          placeholder="Search by question, category, or process"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pr-10"
                        />
                        {searchTerm && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 h-7 w-7"
                            onClick={() => setSearchTerm("")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </FormItem>
                  </div>
                  <div className="flex items-end">
                    <Dialog open={isAddQuestionOpen} onOpenChange={(open) => {
                      setIsAddQuestionOpen(open);
                      if (!open) {
                        setEditingQuestion(null);
                        questionForm.reset({
                          question: "",
                          type: "multiple_choice",
                          options: ["", ""],
                          correctAnswer: "",
                          explanation: "",
                          difficultyLevel: 1,
                          category: "",
                          processId: undefined
                        });
                      }
                    }}>
                      <DialogTrigger asChild>
                        {hasPermission('manage_quiz') ? (
                          <Button onClick={() => {
                            // Reset form before opening dialog
                            questionForm.reset({
                              question: "",
                              type: "multiple_choice",
                              options: ["", ""],
                              correctAnswer: "",
                              explanation: "",
                              difficultyLevel: 1,
                              category: "",
                              processId: undefined
                            });
                            setEditingQuestion(null);
                            setIsAddQuestionOpen(true);
                          }}>Add Question</Button>
                        ) : (
                          <Button variant="outline" disabled className="flex items-center gap-1">
                            <ShieldAlert className="h-4 w-4" />
                            <span>Add Question</span>
                          </Button>
                        )}
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add New Question'}</DialogTitle>
                        </DialogHeader>
                        <Form {...questionForm}>
                          <form onSubmit={questionForm.handleSubmit(onSubmitQuestion)} className="space-y-4">
                            <FormField
                              control={questionForm.control}
                              name="processId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Process</FormLabel>
                                  <Select
                                    onValueChange={(value) => field.onChange(parseInt(value))}
                                    value={field.value?.toString()}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder={processesLoading ? "Loading..." : "Select a process"} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {processesLoading ? (
                                        <SelectItem value="" disabled>Loading processes...</SelectItem>
                                      ) : processes.length > 0 ? (
                                        processes.map((process) => (
                                          <SelectItem key={process.id} value={process.id.toString()}>
                                            {process.name}
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <SelectItem value="" disabled>No processes available</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={questionForm.control}
                              name="question"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Question Text</FormLabel>
                                  <FormControl>
                                    <Textarea placeholder="Enter your question" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={questionForm.control}
                              name="type"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Question Type</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select question type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                      <SelectItem value="true_false">True/False</SelectItem>
                                      <SelectItem value="short_answer">Short Answer</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {questionForm.watch("type") === "multiple_choice" && (
                              <FormField
                                control={questionForm.control}
                                name="options"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Options</FormLabel>
                                    <FormControl>
                                      <div className="space-y-2">
                                        {field.value?.map((_, index) => (
                                          <Input
                                            key={index}
                                            placeholder={`Option ${index + 1}`}
                                            value={field.value[index]}
                                            onChange={(e) => {
                                              const newOptions = [...field.value!];
                                              newOptions[index] = e.target.value;
                                              field.onChange(newOptions);
                                            }}
                                          />
                                        ))}
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() => field.onChange([...field.value!, ""])}
                                        >
                                          Add Option
                                        </Button>
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}

                            <FormField
                              control={questionForm.control}
                              name="correctAnswer"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Correct Answer</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter correct answer" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={questionForm.control}
                              name="explanation"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Explanation (Optional)</FormLabel>
                                  <FormControl>
                                    <Textarea placeholder="Explain the correct answer" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={questionForm.control}
                              name="difficultyLevel"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Difficulty Level (1-5)</FormLabel>
                                  <Select
                                    onValueChange={(value) => field.onChange(parseInt(value))}
                                    defaultValue={field.value.toString()}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select difficulty" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {[1, 2, 3, 4, 5].map((level) => (
                                        <SelectItem key={level} value={level.toString()}>
                                          Level {level}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={questionForm.control}
                              name="category"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Category</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter question category" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <Button type="submit">Save Question</Button>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </form>
              </Form>

              {questionsLoading ? (
                <p>Loading questions...</p>
              ) : allQuestions?.length === 0 ? (
                <p>No questions found for the selected process.</p>
              ) : (
                <div className="space-y-6">
                  {/* Active Questions Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <span className="mr-2">Active Questions</span>
                      <Badge>{activeQuestions.length}</Badge>
                    </h3>
                    {activeQuestions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No active questions found.</p>
                    ) : filteredActiveQuestions.length === 0 && searchTerm ? (
                      <p className="text-sm text-muted-foreground">No active questions match your search.</p>
                    ) : (
                      <div className="grid gap-4">
                        {filteredActiveQuestions.map((question: QuestionWithProcess) => (
                    <Card key={question.id} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="space-y-1">
                          <h3 className="font-medium text-lg">{question.question}</h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            {question.processId && (
                              <Badge variant="outline">
                                Process: {processes.find(p => p.id === question.processId)?.name || 'Unknown Process'}
                              </Badge>
                            )}
                            <Badge variant="default">Active</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasPermission('manage_quiz') ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditQuestion(question)}
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="opacity-50"
                            >
                              <ShieldAlert className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          )}

                          {hasPermission('manage_quiz') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleQuestionActiveMutation.mutate({ 
                                id: question.id, 
                                currentState: question.active 
                              })}
                              disabled={toggleQuestionActiveMutation.isPending}
                            >
                              {toggleQuestionActiveMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <EyeOff className="h-4 w-4 mr-1" />
                              )}
                              Deactivate
                            </Button>
                          )}
                          
                          {hasPermission('manage_quiz') ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => setDeletingQuestionId(question.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled
                              className="opacity-50"
                            >
                              <ShieldAlert className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {question.type === 'multiple_choice' && (
                          <div className="ml-4 space-y-1">
                            {question.options.map((option, index) => (
                              <div
                                key={index}
                                className={`flex items-center gap-2 p-2 rounded-md ${
                                  option === question.correctAnswer
                                    ? 'bg-green-100 dark:bg-green-900/20'
                                    : ''
                                  }`}
                              >
                                <span className="w-6">{String.fromCharCode(65 + index)}.</span>
                                <span>{option}</span>
                                {option === question.correctAnswer && (
                                  <span className="text-sm text-green-600 dark:text-green-400 ml-2">
                                    (Correct)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {question.type === 'true_false' && (
                          <div className="ml-4 space-y-1">
                            <div className={`p-2 rounded-md ${
                              'true' === question.correctAnswer ? 'bg-green-100 dark:bg-green-900/20' : ''
                            }`}>
                              True {question.correctAnswer === 'true' && '(Correct)'}
                            </div>
                            <div className={`p-2 rounded-md ${
                              'false' === question.correctAnswer ? 'bg-green-100 dark:bg-green-900/20' : ''
                            }`}>
                              False {question.correctAnswer === 'false' && '(Correct)'}
                            </div>
                          </div>
                        )}

                        {question.type === 'short_answer' && (
                          <div className="ml-4 p-2 bg-green-100 dark:bg-green-900/20 rounded-md">
                            <span className="font-medium">Correct Answer: </span>
                            {question.correctAnswer}
                          </div>
                        )}

                        {question.explanation && (
                          <div className="mt-2 p-3 bg-muted/50 rounded-md">
                            <span className="font-medium">Explanation: </span>
                            {question.explanation}
                          </div>
                        )}
                      </div>
                    </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Inactive Questions Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <span className="mr-2">Inactive Questions</span>
                      <Badge variant="outline">{inactiveQuestions.length}</Badge>
                    </h3>
                    {inactiveQuestions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No inactive questions found.</p>
                    ) : filteredInactiveQuestions.length === 0 && searchTerm ? (
                      <p className="text-sm text-muted-foreground">No inactive questions match your search.</p>
                    ) : (
                      <div className="grid gap-4">
                        {filteredInactiveQuestions.map((question: QuestionWithProcess) => (
                          <Card key={question.id} className="p-4 border-dashed">
                            <div className="flex justify-between items-start mb-2">
                              <div className="space-y-1">
                                <h3 className="font-medium text-lg text-muted-foreground">{question.question}</h3>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {question.processId && (
                                    <Badge variant="outline">
                                      Process: {processes.find(p => p.id === question.processId)?.name || 'Unknown Process'}
                                    </Badge>
                                  )}
                                  <Badge variant="destructive">Inactive</Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {hasPermission('manage_quiz') ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditQuestion(question)}
                                  >
                                    <Pencil className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    className="opacity-50"
                                  >
                                    <ShieldAlert className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                )}

                                {hasPermission('manage_quiz') && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => toggleQuestionActiveMutation.mutate({ 
                                      id: question.id, 
                                      currentState: question.active 
                                    })}
                                    disabled={toggleQuestionActiveMutation.isPending}
                                  >
                                    {toggleQuestionActiveMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : (
                                      <Eye className="h-4 w-4 mr-1" />
                                    )}
                                    Activate
                                  </Button>
                                )}
                                
                                {hasPermission('manage_quiz') ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600"
                                    onClick={() => setDeletingQuestionId(question.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    className="opacity-50"
                                  >
                                    <ShieldAlert className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2 opacity-75">
                              {question.type === 'multiple_choice' && (
                                <div className="ml-4 space-y-1">
                                  {question.options.map((option, index) => (
                                    <div
                                      key={index}
                                      className={`flex items-center gap-2 p-2 rounded-md ${
                                        option === question.correctAnswer
                                          ? 'bg-green-100/50 dark:bg-green-900/10'
                                          : ''
                                        }`}
                                    >
                                      <span className="w-6">{String.fromCharCode(65 + index)}.</span>
                                      <span>{option}</span>
                                      {option === question.correctAnswer && (
                                        <span className="text-sm text-green-600/70 dark:text-green-400/70 ml-2">
                                          (Correct)
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {question.type === 'true_false' && (
                                <div className="ml-4 space-y-1">
                                  <div className={`p-2 rounded-md ${
                                    'true' === question.correctAnswer ? 'bg-green-100/50 dark:bg-green-900/10' : ''
                                  }`}>
                                    True {question.correctAnswer === 'true' && '(Correct)'}
                                  </div>
                                  <div className={`p-2 rounded-md ${
                                    'false' === question.correctAnswer ? 'bg-green-100/50 dark:bg-green-900/10' : ''
                                  }`}>
                                    False {question.correctAnswer === 'false' && '(Correct)'}
                                  </div>
                                </div>
                              )}

                              {question.type === 'short_answer' && (
                                <div className="ml-4 p-2 bg-green-100/50 dark:bg-green-900/10 rounded-md">
                                  <span className="font-medium">Correct Answer: </span>
                                  {question.correctAnswer}
                                </div>
                              )}

                              {question.explanation && (
                                <div className="mt-2 p-3 bg-muted/30 rounded-md">
                                  <span className="font-medium">Explanation: </span>
                                  {question.explanation}
                                </div>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card className="p-4">
            <div className="flex flex-col gap-4">
              {/* Process Filter for Templates */}
              <Form {...templateFilterForm}>
                <form className="flex items-center gap-4">
                  <div className="flex-1">
                    <FormField
                      control={templateFilterForm.control}
                      name="processId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Filter by Process</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              setSelectedTemplateProcessId(value);
                              field.onChange(value);
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="All Processes" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all">All Processes</SelectItem>
                              {processes.map((process) => (
                                <SelectItem key={process.id} value={process.id.toString()}>
                                  {process.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex items-end">
                    <Dialog open={isAddTemplateOpen || editingTemplate !== null} onOpenChange={(open) => {
                      setIsAddTemplateOpen(open);
                      if (!open) {
                        setEditingTemplate(null);
                        templateForm.reset();
                        setPreviewQuestions([]);
                      }
                    }}>
                      <DialogTrigger asChild>
                        {hasPermission('manage_quiz') ? (
                          <Button>Create Quiz Template</Button>
                        ) : (
                          <Button variant="outline" disabled className="flex items-center gap-1">
                            <ShieldAlert className="h-4 w-4" />
                            <span>Create Quiz Template</span>
                          </Button>
                        )}
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            {editingTemplate ? 'Edit Quiz Template' : 'Create Quiz Template'}
                          </DialogTitle>
                        </DialogHeader>
                        <Form {...templateForm}>
                          <form onSubmit={templateForm.handleSubmit(onSubmitTemplate)} className="space-y-4">
                            {/* Inside the template form, add process selection before other fields */}
                            <FormField
                              control={templateForm.control}
                              name="processId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Process</FormLabel>
                                  <Select
                                    onValueChange={(value) => field.onChange(parseInt(value))}
                                    defaultValue={field.value?.toString()}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder={processesLoading ? "Loading..." : "Select a process"} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {processesLoading ? (
                                        <SelectItem value="" disabled>Loading processes...</SelectItem>
                                      ) : processes.length > 0 ? (
                                        processes.map((process) => (
                                          <SelectItem key={process.id} value={process.id.toString()}>
                                            {process.name}
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <SelectItem value="" disabled>No processes available</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Batch selection field */}
                            <FormField
                              control={templateForm.control}
                              name="batchId"
                              render={({ field }) => {
                                // Get the currently selected process ID from the form
                                const selectedProcessId = templateForm.watch("processId");
                                
                                // Filter batches to only show those matching the selected process
                                const filteredBatches = batches.filter(batch => 
                                  // If no process is selected, show all batches
                                  !selectedProcessId || batch.processId === selectedProcessId
                                );
                                
                                return (
                                  <FormItem>
                                    <FormLabel>Restrict to Batch (Optional)</FormLabel>
                                    <Select
                                      onValueChange={(value) => field.onChange(value === "none" ? "none" : parseInt(value))}
                                      defaultValue={field.value?.toString() || "none"}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder={batchesLoading ? "Loading..." : "Select a batch"} />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="none">No batch restriction (Available to all)</SelectItem>
                                        {batchesLoading ? (
                                          <SelectItem value="loading" disabled>Loading batches...</SelectItem>
                                        ) : filteredBatches.length > 0 ? (
                                          filteredBatches.map((batch) => (
                                            <SelectItem key={batch.id} value={batch.id.toString()}>
                                              {batch.name}
                                            </SelectItem>
                                          ))
                                        ) : (
                                          <SelectItem value="na" disabled>No batches available for selected process</SelectItem>
                                        )}
                                      </SelectContent>
                                    </Select>
                                    <FormDescription>
                                      If selected, only trainees in this batch will be able to access this quiz template.
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                );
                              }}
                            />



                            <FormField
                              control={templateForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Template Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter template name" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={templateForm.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Description (Optional)</FormLabel>
                                  <FormControl>
                                    <Textarea placeholder="Enter template description" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={templateForm.control}
                              name="quizType"
                              render={({ field }) => (
                                <FormItem className="space-y-3">
                                  <FormLabel>Quiz Type</FormLabel>
                                  <FormControl>
                                    <RadioGroup
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                      className="flex flex-col space-y-1"
                                    >
                                      <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl>
                                          <RadioGroupItem value="internal" />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                          Internal (Practice)
                                        </FormLabel>
                                      </FormItem>
                                      <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl>
                                          <RadioGroupItem value="final" />
                                        </FormControl>
                                        <FormLabel className="font-normal">
                                          Final (Assessment)
                                        </FormLabel>
                                      </FormItem>
                                    </RadioGroup>
                                  </FormControl>
                                  <FormDescription>
                                    Internal quizzes are for practice, while Final quizzes are used for formal assessments.
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={templateForm.control}
                              name="timeLimit"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Time Limit (minutes)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={1}
                                      placeholder="Enter time limit"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={templateForm.control}
                              name="questionCount"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Number of Questions</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={1}
                                      placeholder="Enter number of questions"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={templateForm.control}
                              name="passingScore"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Passing Score (%)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      placeholder="Enter passing score"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="flex flex-col gap-4">
                              <FormField
                                control={templateForm.control}
                                name="shuffleQuestions"
                                render={({ field }) => (
                                  <div className="flex items-center justify-between">
                                    <Label htmlFor="shuffle-questions">Shuffle Questions</Label>
                                    <Switch
                                      id="shuffle-questions"
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </div>
                                )}
                              />

                              <FormField
                                control={templateForm.control}
                                name="shuffleOptions"
                                render={({ field }) => (
                                  <div className="flex items-center justify-between">
                                    <Label htmlFor="shuffle-options">Shuffle Answer Options</Label>
                                    <Switch
                                      id="shuffle-options"
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </div>
                                )}
                              />

                              <FormField
                                control={templateForm.control}
                                name="oneTimeOnly"
                                render={({ field }) => (
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <Label htmlFor="one-time-only" className="flex items-center gap-2">
                                        One-Time Only Quiz
                                        <span className="inline-block">
                                          <Badge variant="destructive" className="ml-2">Restricted</Badge>
                                        </span>
                                      </Label>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Trainees only get one attempt to complete this quiz
                                      </p>
                                    </div>
                                    <Switch
                                      id="one-time-only"
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </div>
                                )}
                              />
                            </div>

                            <div className="space-y-4">
                              <h4 className="font-medium">Question Distribution</h4>

                              {/* Category Distribution */}
                              <div className="space-y-2">
                                <Label>Category Distribution</Label>
                                <div className="grid grid-cols-2 gap-2">
                                  {Array.from(categories).map((category) => (
                                    <div key={category} className="flex items-center gap-2">
                                      <Label>{category}</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        placeholder="Count"
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value);
                                          const current = templateForm.getValues('categoryDistribution') || {};
                                          if (value > 0) {
                                            templateForm.setValue('categoryDistribution', {
                                              ...current,
                                              [category]: value
                                            });
                                          } else {
                                            const { [category]: _, ...rest } = current;
                                            templateForm.setValue('categoryDistribution', rest);
                                          }
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Difficulty Distribution */}
                              <div className="space-y-2">
                                <Label>Difficulty Distribution</Label>
                                <div className="grid grid-cols-2 gap-2">
                                  {difficulties.map((level) => (
                                    <div key={level} className="flex items-center gap-2">
                                      <Label>Level {level}</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        placeholder="Count"
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value);
                                          const current = templateForm.getValues('difficultyDistribution') || {};
                                          if (value > 0) {
                                            templateForm.setValue('difficultyDistribution', {
                                              ...current,
                                              [level]: value
                                            });
                                          } else {
                                            const { [level]: _, ...rest } = current;
                                            templateForm.setValue('difficultyDistribution', rest);
                                          }
                                        }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-between gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  const data = templateForm.getValues();
                                  previewRandomQuestions(data);
                                }}
                                disabled={isPreviewLoading}
                              >
                                {isPreviewLoading ? "Loading..." : "Preview Questions"}
                              </Button>
                              <Button type="submit">
                                {editingTemplate ? 'Update Template' : 'Create Template'}
                              </Button>
                            </div>
                          </form>

                        </Form>

                        {/* Preview Questions */}
                        {previewQuestions.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <h4 className="font-medium">Preview Selected Questions</h4>
                            <div className="max-h-[300px] overflow-y-auto space-y-2">
                              {previewQuestions.map((question) => (
                                <Card key={question.id} className="p-2">
                                  <div className="flex justify-between items-start">
                                    <p className="text-sm">{question.question}</p>
                                    <div className="flex gap-1">
                                      <Badge variant="outline">Level {question.difficultyLevel}</Badge>
                                      <Badge variant="outline">{question.category}</Badge>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </form>
              </Form>

              {/* Template List */}
              {templatesLoading ? (
                <p>Loading templates...</p>
              ) : quizTemplates.length === 0 ? (
                <p>No quiz templates found for the selected process.</p>
              ) : (
                <div className="grid gap-4">
                  {quizTemplates.map((template: QuizTemplate) => (
                    <div key={template.id} className={`border rounded-lg p-4 shadow-sm hover:shadow-md transition-all 
                      ${template.quizType === "final" 
                        ? "border-l-4 border-l-red-500 bg-gradient-to-r from-red-50 to-transparent" 
                        : "border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-transparent"}`}>
                      <div className="flex items-center justify-between">
                        <div className="w-full">
                          <div className="flex justify-between items-center mb-3">
                            <h3 className={`text-lg font-semibold ${template.quizType === "final" ? "text-red-700" : "text-blue-700"}`}>
                              {template.name}
                            </h3>
                            <Badge variant={template.quizType === "final" ? "destructive" : "secondary"} 
                              className={`ml-2 ${template.quizType === "final" ? "bg-red-600" : "bg-blue-600"}`}>
                              {template.quizType === "final" ? "Final Quiz" : "Internal Quiz"}
                            </Badge>
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mb-3 border-l-2 border-gray-200 pl-2">{template.description}</p>
                          )}
                          <div className="flex flex-wrap gap-2 my-3 p-2 rounded-md bg-white bg-opacity-70">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 shadow-sm">
                              <Clock className="w-3 h-3 mr-1" /> {template.timeLimit} min
                            </Badge>
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 shadow-sm">
                              <FileQuestion className="w-3 h-3 mr-1" /> {template.questionCount} questions
                            </Badge>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 shadow-sm">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> {template.passingScore}% to pass
                            </Badge>
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 shadow-sm">
                              <BarChart className="w-3 h-3 mr-1" /> Generated: {template.generationCount || 0} times
                            </Badge>
                          </div>
                          <QuizTemplateDetailsSection template={template} processes={processes} batches={batches} />
                        </div>
                        <div className="flex items-center gap-2 ml-4 backdrop-blur-sm bg-white bg-opacity-50 p-2 rounded-md">
                          {hasPermission('manage_quiz') ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (generateQuizMutation.isPending) return;
                                
                                // Set the selected template ID
                                setSelectedTemplateId(template.id);
                                
                                // Reset trainee selection
                                setSelectedTrainees([]);
                                setAssignmentType('all');
                                
                                // Open the dialog first for better UX
                                setIsGenerateDialogOpen(true);
                                
                                // If the template has a batchId, fetch trainees for this batch
                                if (template.batchId) {
                                  try {
                                    console.log(`Fetching trainees for batch ID: ${template.batchId}`);
                                    // Adding timestamp to avoid caching issues
                                    const response = await fetch(`/api/batches/${template.batchId}/trainees?t=${Date.now()}`);
                                    
                                    if (response.ok) {
                                      const trainees = await response.json();
                                      console.log('Fetched trainees:', trainees);
                                      
                                      // Process trainees data based on the format returned by the API
                                      setTraineesData(trainees.map((trainee: any) => {
                                        // Check if the data is already in the expected format
                                        if (trainee.user && trainee.user.fullName) {
                                          return {
                                            userId: trainee.userId,
                                            fullName: trainee.user.fullName
                                          };
                                        } 
                                        
                                        // Alternative format - trainee might have fullName directly
                                        if (trainee.fullName) {
                                          return {
                                            userId: trainee.userId || trainee.id,
                                            fullName: trainee.fullName
                                          };
                                        }
                                        
                                        // Last fallback for unexpected data structure
                                        return {
                                          userId: trainee.userId || trainee.id,
                                          fullName: `Trainee ${trainee.userId || trainee.id}`
                                        };
                                      }));
                                    } else {
                                      console.error('Failed to fetch trainees for batch', {
                                        status: response.status,
                                        statusText: response.statusText
                                      });
                                      toast({
                                        title: "Warning",
                                        description: "Failed to load trainees. You can still generate the quiz for all trainees.",
                                        variant: "destructive",
                                      });
                                      setTraineesData([]);
                                    }
                                  } catch (error) {
                                    console.error('Error fetching trainees:', error);
                                    toast({
                                      title: "Warning",
                                      description: "Error loading trainees. You can still generate the quiz for all trainees.",
                                      variant: "destructive",
                                    });
                                    setTraineesData([]);
                                  }
                                } else {
                                  // Reset trainees if template doesn't have a batch
                                  setTraineesData([]);
                                }
                              }}
                              disabled={generateQuizMutation.isPending}
                              className={`text-amber-600 hover:text-amber-700 hover:bg-amber-50 ${template.quizType === "final" ? "bg-red-50" : "bg-blue-50"}`}
                            >
                              {generateQuizMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <PlayCircle className="h-4 w-4" />
                              )}
                              <span className="ml-2">Generate Quiz</span>
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              className="opacity-50"
                              title="You don't have permission to generate quizzes"
                            >
                              <ShieldAlert className="h-4 w-4" />
                              <span className="ml-2">Generate Quiz</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIsPreviewLoading(true);
                              // Prepare the template data for preview
                              const previewData: QuizTemplateFormValues = {
                                name: template.name,
                                questionCount: template.questionCount,
                                categoryDistribution: template.categoryDistribution || {},
                                difficultyDistribution: template.difficultyDistribution || {},
                                processId: template.processId,
                                timeLimit: template.timeLimit,
                                passingScore: template.passingScore,
                                shuffleQuestions: template.shuffleQuestions,
                                shuffleOptions: template.shuffleOptions,
                                oneTimeOnly: template.oneTimeOnly,
                                quizType: template.quizType
                              };
                              previewRandomQuestions(previewData);
                              // Open the preview dialog
                              setIsPreviewDialogOpen(true);
                            }}
                            className={`text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 ${template.quizType === "final" ? "bg-red-50" : "bg-blue-50"}`}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="ml-2">Preview</span>
                          </Button>
                          {hasPermission('manage_quiz') ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTemplate(template)}
                              className={`text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 ${template.quizType === "final" ? "bg-red-50" : "bg-blue-50"}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              className="opacity-50"
                            >
                              <ShieldAlert className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {hasPermission('manage_quiz') ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingTemplateId(template.id)}
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled
                              className="opacity-50"
                            >
                              <ShieldAlert className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deletingQuestionId !== null} onOpenChange={(open) => !open && setDeletingQuestionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingQuestionId && deleteQuestionMutation.mutate(deletingQuestionId)}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={deletingTemplateId !== null}
        onOpenChange={(open) => !open && setDeletingTemplateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quiz template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTemplateId && deleteTemplateMutation.mutate(deletingTemplateId)}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Add delete confirmation dialog in the return statement after the quiz templates section */}
      <AlertDialog open={!!deletingQuizId} onOpenChange={(open) => !open && setDeletingQuizId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quiz? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingQuizId && deleteQuizMutation.mutateAsync(deletingQuizId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteQuizMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Quiz'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quiz Generation Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Generate Quiz</DialogTitle>
            <DialogDescription>
              Set the duration for how long trainees will have access to take this quiz.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="duration-select">Quiz Availability Duration</Label>
                <Select 
                  value={selectedDuration.toString()} 
                  onValueChange={(value) => setSelectedDuration(parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="2">2 hours</SelectItem>
                    <SelectItem value="4">4 hours</SelectItem>
                    <SelectItem value="8">8 hours</SelectItem>
                    <SelectItem value="12">12 hours</SelectItem>
                    <SelectItem value="24">24 hours (1 day)</SelectItem>
                    <SelectItem value="48">48 hours (2 days)</SelectItem>
                    <SelectItem value="72">72 hours (3 days)</SelectItem>
                    <SelectItem value="168">1 week</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  Trainees will have access to this quiz for {selectedDuration} hour{selectedDuration !== 1 ? 's' : ''} after generation.
                </p>
              </div>
              
              {/* Trainee Assignment Selection */}
              {selectedTemplateId && quizTemplates.find(t => t.id === selectedTemplateId)?.batchId && (
                <div>
                  <Label htmlFor="assignment-type">Quiz Assignment</Label>
                  <RadioGroup 
                    onValueChange={(value) => setAssignmentType(value as 'all' | 'specific')} 
                    value={assignmentType}
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="all-trainees" />
                      <Label htmlFor="all-trainees" className="cursor-pointer">Assign to all trainees in batch</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="specific" id="specific-trainees" />
                      <Label htmlFor="specific-trainees" className="cursor-pointer">Assign to specific trainees</Label>
                    </div>
                  </RadioGroup>
                  
                  {assignmentType === 'specific' && (
                    <div className="mt-3">
                      <Label>Select Trainees</Label>
                      <div className="border rounded-md p-2 mt-1 max-h-[200px] overflow-y-auto">
                        {traineesData.length > 0 ? (
                          <>
                            <div className="mb-2 flex items-center space-x-2">
                              <Checkbox 
                                id="select-all-trainees"
                                checked={traineesData.length > 0 && selectedTrainees.length === traineesData.length}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    // Select all trainees
                                    setSelectedTrainees(traineesData.map(t => t.userId));
                                  } else {
                                    // Deselect all
                                    setSelectedTrainees([]);
                                  }
                                }}
                              />
                              <Label 
                                htmlFor="select-all-trainees"
                                className="ml-2 cursor-pointer font-semibold"
                              >
                                Select All ({traineesData.length})
                              </Label>
                            </div>
                            <div className="border-t pt-2">
                              {traineesData.map(trainee => (
                                <div key={trainee.userId} className="flex items-center py-1 hover:bg-slate-50 rounded px-1">
                                  <Checkbox 
                                    id={`trainee-${trainee.userId}`}
                                    checked={selectedTrainees.includes(trainee.userId)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedTrainees(prev => [...prev, trainee.userId]);
                                      } else {
                                        setSelectedTrainees(prev => prev.filter(id => id !== trainee.userId));
                                      }
                                    }}
                                  />
                                  <Label 
                                    htmlFor={`trainee-${trainee.userId}`}
                                    className="ml-2 cursor-pointer w-full"
                                  >
                                    {trainee.fullName}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            <div className="flex justify-center mb-3">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            </div>
                            <p>Loading trainees...</p>
                            <p className="text-xs mt-1 text-muted-foreground">This may take a moment</p>
                          </div>
                        )}
                      </div>
                      {selectedTrainees.length > 0 && (
                        <p className="text-sm font-medium text-primary mt-2">
                          Selected {selectedTrainees.length} of {traineesData.length} trainee{selectedTrainees.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className="relative w-full rounded-lg border p-4 bg-background text-foreground mt-2">
                <div className="flex items-start">
                  <div className="mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="mb-1 font-medium leading-none tracking-tight">Time-bound Quiz</h5>
                    <div className="text-sm">
                      This quiz will be available to trainees from the moment it's generated until {selectedDuration} hour{selectedDuration !== 1 ? 's' : ''} later. 
                      The quiz timer of {quizTemplates.find(t => t.id === selectedTemplateId)?.timeLimit || 0} minutes begins when a trainee starts the quiz.
                      {assignmentType === 'specific' && selectedTrainees.length > 0 && (
                        <p className="mt-1">
                          This quiz will only be visible to the {selectedTrainees.length} trainee{selectedTrainees.length !== 1 ? 's' : ''} you've selected.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (!selectedTemplateId || generateQuizMutation.isPending) return;
                  
                  // Check if we need to include trainees in the request
                  const templateHasBatch = quizTemplates.find(t => t.id === selectedTemplateId)?.batchId;
                  const specificTrainees = assignmentType === 'specific' && selectedTrainees.length > 0;
                  
                  generateQuizMutation.mutate({ 
                    templateId: selectedTemplateId, 
                    durationInHours: selectedDuration,
                    trainees: specificTrainees ? selectedTrainees : undefined
                  });
                }}
                disabled={
                  generateQuizMutation.isPending || 
                  (assignmentType === 'specific' && selectedTrainees.length === 0)
                }
              >
                {generateQuizMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Quiz'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Questions Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quiz Preview</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {isPreviewLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading questions...</span>
              </div>
            ) : previewQuestions.length > 0 ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Sample Questions ({previewQuestions.length})</h4>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // Get the template data from the last preview and refresh
                      const lastTemplateData: QuizTemplateFormValues = {
                        name: "Preview Refresh",
                        questionCount: previewQuestions.length,
                        categoryDistribution: previewQuestions.reduce((acc, q) => {
                          acc[q.category] = (acc[q.category] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>),
                        difficultyDistribution: previewQuestions.reduce((acc, q) => {
                          const key = q.difficultyLevel.toString();
                          acc[key] = (acc[key] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>),
                        processId: previewQuestions[0]?.processId,
                        timeLimit: 10,
                        passingScore: 70,
                        shuffleQuestions: true,
                        shuffleOptions: true,
                        oneTimeOnly: false,
                        quizType: "internal"
                      };
                      previewRandomQuestions(lastTemplateData);
                    }}
                  >
                    <Loader2 className="h-4 w-4 mr-2" />
                    Refresh Preview
                  </Button>
                </div>
                <div className="space-y-4">
                  {previewQuestions.map((question, index) => (
                    <Card key={question.id} className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div className="flex gap-2">
                            <Badge>{question.category}</Badge>
                            <Badge variant="outline">Difficulty: {question.difficultyLevel}</Badge>
                          </div>
                          <Badge variant="secondary">Question {index + 1}</Badge>
                        </div>
                        <h4 className="font-medium">{question.question}</h4>
                        
                        {question.type === 'multiple_choice' && question.options && (
                          <div className="grid gap-2 mt-2">
                            {question.options.map((option, optIndex) => (
                              <div 
                                key={optIndex}
                                className={`p-2 border rounded ${option === question.correctAnswer ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                              >
                                {option} {option === question.correctAnswer && <span className="text-green-600 ml-2">(Correct)</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {question.type === 'true_false' && (
                          <div className="grid gap-2 mt-2">
                            <div className={`p-2 border rounded ${question.correctAnswer === 'true' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                              True {question.correctAnswer === 'true' && <span className="text-green-600 ml-2">(Correct)</span>}
                            </div>
                            <div className={`p-2 border rounded ${question.correctAnswer === 'false' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                              False {question.correctAnswer === 'false' && <span className="text-green-600 ml-2">(Correct)</span>}
                            </div>
                          </div>
                        )}
                        
                        {question.explanation && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            <strong>Explanation:</strong> {question.explanation}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">No preview questions available. Try modifying the template settings.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component to display additional information about a quiz template
function QuizTemplateDetailsSection({ template, processes, batches }: QuizTemplateDetailsSectionProps) {
  // Find the process corresponding to this template
  const process = processes.find(p => p.id === template.processId);
  
  // Find the batch if the template has a batchId
  const batch = template.batchId ? batches.find(b => b.id === template.batchId) : null;
  
  // Get users data for finding trainer name
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    enabled: !!batch?.trainerId
  });
  
  // Find trainer name from batch trainer ID
  const getTrainerName = () => {
    if (!batch?.trainerId) return null;
    
    // Find the trainer in the users array
    const trainer = users.find(user => user.id === batch.trainerId);
    
    // Return trainer name if found, otherwise fallback to ID
    if (trainer) {
      return trainer.name || trainer.username || trainer.email;
    }
    
    return `Trainer #${batch.trainerId}`;
  };
  
  const trainerName = getTrainerName();
  
  // Calculate additional quiz template stats
  const hasCategory = !!template.categoryDistribution && Object.keys(template.categoryDistribution).length > 0;
  const hasDifficulty = !!template.difficultyDistribution && Object.keys(template.difficultyDistribution).length > 0;
  
  return (
    <div className="mt-2 text-sm">
      {/* Primary information badges */}
      <div className="flex flex-wrap gap-2 mt-2 p-2 rounded-md bg-white bg-opacity-50 backdrop-blur-sm shadow-inner">
        {process && (
          <Badge variant="outline" className="bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border-amber-200 shadow-sm">
            <Briefcase className="w-3 h-3 mr-1" /> {process.name}
          </Badge>
        )}
        
        {batch && (
          <Badge variant="outline" className="bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700 border-indigo-200 shadow-sm">
            <CalendarDays className="w-3 h-3 mr-1" /> {batch.name}
          </Badge>
        )}
        
        {trainerName && (
          <Badge variant="outline" className="bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200 shadow-sm">
            <User className="w-3 h-3 mr-1" /> {trainerName}
          </Badge>
        )}

        {/* Quiz settings badges */}
        {template.shuffleQuestions && (
          <Badge variant="outline" className="bg-gradient-to-r from-violet-50 to-violet-100 text-violet-700 border-violet-200 shadow-sm">
            <FileQuestion className="w-3 h-3 mr-1" /> Shuffled Questions
          </Badge>
        )}
        
        {template.shuffleOptions && (
          <Badge variant="outline" className="bg-gradient-to-r from-fuchsia-50 to-fuchsia-100 text-fuchsia-700 border-fuchsia-200 shadow-sm">
            <FileQuestion className="w-3 h-3 mr-1" /> Shuffled Options
          </Badge>
        )}
        
        {template.oneTimeOnly && (
          <Badge variant="outline" className="bg-gradient-to-r from-rose-50 to-rose-100 text-rose-700 border-rose-200 shadow-sm">
            <FileQuestion className="w-3 h-3 mr-1" /> One-Time Only
          </Badge>
        )}
      </div>
      
      {/* Show distribution information if any */}
      {(hasCategory || hasDifficulty) && (
        <div className="mt-2 p-2 rounded-md bg-slate-50 bg-opacity-50 border border-slate-100 text-xs">
          {hasCategory && (
            <div className="flex items-center gap-1 mb-1">
              <FileQuestion className="w-3 h-3 text-slate-500" />
              <span className="text-slate-600 font-medium">Categories:</span>
              <span className="text-slate-500">
                {Object.entries(template.categoryDistribution || {})
                  .map(([cat, count]) => `${cat} (${count})`)
                  .join(', ')}
              </span>
            </div>
          )}
          
          {hasDifficulty && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-slate-500" />
              <span className="text-slate-600 font-medium">Difficulty:</span>
              <span className="text-slate-500">
                {Object.entries(template.difficultyDistribution || {})
                  .map(([level, count]) => `Level ${level} (${count})`)
                  .join(', ')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default QuizManagement;