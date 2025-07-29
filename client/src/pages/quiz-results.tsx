import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface QuizAttemptResult {
  id: number;
  score: number;
  completedAt: string;
  quiz: {
    name: string;
    description: string | null;
  };
}

export function QuizResultsPage() {
  const { attemptId } = useParams();

  // Debug: Log the attempt ID
  console.log("Debug - Attempt ID from URL:", attemptId);

  const { data: result, isLoading, error } = useQuery<QuizAttemptResult>({
    queryKey: [`/api/quiz-attempts/${attemptId}`],
    enabled: !!attemptId,
  });

  // Debug: Log the query result and any errors
  console.log("Debug - Query Result:", result);
  console.log("Debug - Query Error:", error);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading results...</span>
      </div>
    );
  }

  if (!result) {
    console.log("Debug - No result found. Attempt ID:", attemptId);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Results not found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Quiz Score</CardTitle>
          <CardDescription>
            Your score: {result.score.toFixed(1)}%
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center pt-4">
            <Button onClick={() => window.history.back()}>
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}