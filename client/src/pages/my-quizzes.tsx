import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle } from "lucide-react";

// Define quiz type
interface Quiz {
  quiz_id: number;
  quiz_name: string;
  timeLimit: number;
  passingScore: number;
  processId: number;
  processName: string;
  startTime: string;
  endTime: string;
  oneTimeOnly?: boolean;
  quizType: 'internal' | 'final';
}

// Define quiz attempt interface
interface QuizAttempt {
  id: number;
  quizId: number;
  score: number;
  completedAt: string;
}

export function MyQuizzesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Store a map of which quizzes have attempts
  const [quizAttempts, setQuizAttempts] = useState<Record<number, QuizAttempt[]>>({});

  // Add debug logs
  console.log("Current user:", user);
  console.log("User category:", user?.category);
  console.log("Debug - quiz attempt state:", quizAttempts);

  // Fetch available quizzes for the trainee
  const { data: quizzes = [], isLoading, error } = useQuery<Quiz[]>({
    queryKey: ["/api/trainee/quizzes"],
    queryFn: async () => {
      try {
        console.log("Fetching quizzes...");
        const response = await fetch("/api/trainee/quizzes");
        console.log("Quiz response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to fetch quizzes");
        }

        const data = await response.json();
        console.log("Fetched quizzes data:", data);
        return data;
      } catch (err) {
        console.error("Error fetching quizzes:", err);
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to fetch quizzes",
          variant: "destructive",
        });
        throw err;
      }
    },
    enabled: !!user && user.category === 'trainee',
  });

  // Fetch attempts for each quiz when quizzes are loaded
  useEffect(() => {
    if (!quizzes || quizzes.length === 0 || !user) return;
    
    const fetchAttemptsForQuizzes = async () => {
      const attemptsMap: Record<number, QuizAttempt[]> = {};
      
      // Fetch attempts for all quizzes
      for (const quiz of quizzes) {
        try {
          console.log(`Fetching attempts for quiz ${quiz.quiz_id}...`);
          const response = await fetch(`/api/quizzes/${quiz.quiz_id}/attempts`);
          if (response.ok) {
            const attempts = await response.json();
            console.log(`Quiz ${quiz.quiz_id} attempts data:`, attempts);
            attemptsMap[quiz.quiz_id] = attempts;
            console.log(`Quiz ${quiz.quiz_id} has ${attempts.length} attempts`);
          } else {
            console.warn(`Failed to fetch attempts for quiz ${quiz.quiz_id}. Status: ${response.status}`);
          }
        } catch (err) {
          console.error(`Error fetching attempts for quiz ${quiz.quiz_id}:`, err);
        }
      }
      
      console.log("Final attempts map:", attemptsMap);
      setQuizAttempts(attemptsMap);
    };
    
    fetchAttemptsForQuizzes();
  }, [quizzes, user]);

  // Debug logs
  console.log("Query state:", { isLoading, error, quizzes });
  console.log("Quiz attempts:", quizAttempts);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Clock className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">
              {error instanceof Error ? error.message : "Failed to load quizzes"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quizzes || quizzes.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No quizzes are currently available. Check back later or contact your trainer.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Separate quizzes by type
  const internalQuizzes = quizzes.filter(quiz => quiz.quizType === 'internal');
  const finalQuizzes = quizzes.filter(quiz => quiz.quizType === 'final');

  // Component for rendering a quiz card
  const renderQuizCard = (quiz: Quiz) => {
    // Log per-quiz debugging information
    console.log(`Quiz ${quiz.quiz_id} (${quiz.quiz_name}):`, {
      oneTimeOnly: quiz.oneTimeOnly,
      quizType: quiz.quizType,
      hasAttempts: quizAttempts[quiz.quiz_id]?.length > 0,
      attemptsCount: quizAttempts[quiz.quiz_id]?.length || 0,
      attempts: quizAttempts[quiz.quiz_id] || []
    });
    
    // Logic to determine button state
    const hasAttempted = quizAttempts[quiz.quiz_id]?.length > 0;
    const isOneTimeQuiz = !!quiz.oneTimeOnly;
    const shouldDisableButton = isOneTimeQuiz && hasAttempted;
    
    // Style based on quiz type
    const isInternal = quiz.quizType === 'internal';
    const cardBorderClass = isInternal 
      ? "border-l-4 border-l-blue-500" 
      : "border-l-4 border-l-red-500";
    const badgeVariant = isInternal ? "secondary" : "destructive";
    const typeBadgeClass = isInternal 
      ? "bg-blue-100 text-blue-800 border-blue-200" 
      : "bg-red-100 text-red-800 border-red-200";
    
    return (
      <Card key={quiz.quiz_id} className={`${cardBorderClass} hover:shadow-md transition-all`}>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{quiz.quiz_name}</CardTitle>
            <Badge variant="outline" className={typeBadgeClass}>
              {isInternal ? "Internal Assessment" : "Final Assessment"}
            </Badge>
          </div>
          <CardDescription>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant={badgeVariant}>
                Time: {quiz.timeLimit} min
              </Badge>
              <Badge variant={badgeVariant}>
                Pass: {quiz.passingScore}%
              </Badge>
              {isOneTimeQuiz && (
                <Badge variant="destructive">
                  One-Time Only
                </Badge>
              )}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              Process: {quiz.processName}
            </div>
            <div className="mt-2 text-sm">
              <div className="text-muted-foreground">
                <span className="font-semibold">Available until:</span> {new Date(quiz.endTime).toLocaleString()}
              </div>
              {isOneTimeQuiz && (
                <div className="mt-2 text-destructive font-medium">
                  ⚠️ You can only attempt this quiz once. Make sure you're prepared before starting.
                </div>
              )}
              {shouldDisableButton && (
                <div className="mt-2 text-info font-medium">
                  You have already taken this quiz.
                </div>
              )}
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {shouldDisableButton ? (
            <Button 
              className="w-full"
              variant="outline"
              disabled
            >
              <CheckCircle className="mr-2 h-4 w-4" /> Quiz Completed
            </Button>
          ) : (
            <Button 
              className="w-full"
              variant={isInternal ? "default" : "destructive"}
              onClick={() => setLocation(`/quiz/${quiz.quiz_id}`)}
            >
              Start Quiz
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">My Quizzes</h1>
      
      {/* Internal Assessments Section */}
      {internalQuizzes.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <h2 className="text-xl font-semibold">Internal Assessments</h2>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {internalQuizzes.length} Available
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {internalQuizzes.map(renderQuizCard)}
          </div>
        </div>
      )}
      
      {/* Final Assessments Section */}
      {finalQuizzes.length > 0 && (
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <h2 className="text-xl font-semibold">Final Assessments</h2>
            <Badge variant="destructive" className="bg-red-100 text-red-800">
              {finalQuizzes.length} Available
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {finalQuizzes.map(renderQuizCard)}
          </div>
        </div>
      )}
      
      {/* If no quizzes of any type are available */}
      {internalQuizzes.length === 0 && finalQuizzes.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No quizzes are currently available. Check back later or contact your trainer.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default MyQuizzesPage;