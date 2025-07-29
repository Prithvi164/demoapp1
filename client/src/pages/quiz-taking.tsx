import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CountdownTimer } from "@/components/quiz/countdown-timer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function QuizTakingPage() {
  const { quizId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [previousAttempt, setPreviousAttempt] = useState<any>(null);

  // Fetch quiz details and questions
  const { data: quiz, isLoading, error: quizError } = useQuery({
    queryKey: [`/api/quizzes/${quizId}`],
    enabled: !!quizId,
  });

  // Check for previous attempts if this is a one-time quiz
  useEffect(() => {
    if (quiz?.oneTimeOnly) {
      const checkPreviousAttempts = async () => {
        try {
          const response = await fetch(`/api/quizzes/${quizId}/attempts`);
          if (response.ok) {
            const attempts = await response.json();
            if (attempts.length > 0) {
              setSubmissionError("You have already attempted this one-time quiz");
              setPreviousAttempt(attempts[0]);
            }
          }
        } catch (err) {
          console.error("Error checking previous attempts:", err);
        }
      };
      checkPreviousAttempts();
    }
  }, [quiz, quizId]);

  // Set end time when quiz data is loaded
  useEffect(() => {
    if (quiz?.timeLimit) {
      const now = new Date();
      const end = new Date(now.getTime() + quiz.timeLimit * 60 * 1000); // Convert minutes to milliseconds
      setEndTime(end);
    }
  }, [quiz]);

  const handleTimeExpired = async () => {
    if (!isSubmitting) {
      toast({
        title: "Time's Up!",
        description: "Your quiz is being submitted automatically.",
        variant: "destructive",
      });
      await handleSubmit();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (submissionError && previousAttempt) {
    // Display a message for one-time quizzes that have already been taken
    return (
      <div className="container mx-auto py-8 max-w-3xl">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Quiz Already Attempted</AlertTitle>
          <AlertDescription>
            This is a one-time quiz and you have already submitted an attempt.
            One-time quizzes cannot be retaken.
          </AlertDescription>
        </Alert>
        <Card>
          <CardHeader>
            <CardTitle>Previous Attempt Details</CardTitle>
            <CardDescription>
              You completed this quiz on {new Date(previousAttempt.completedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <span className="font-medium">Your Score: </span>
              <span className={previousAttempt.score >= quiz.passingScore ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                {previousAttempt.score.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="font-medium">Passing Score: </span>
              <span>{quiz.passingScore}%</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              onClick={() => setLocation("/my-quizzes")}
            >
              Return to My Quizzes
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="container mx-auto py-8 max-w-3xl">
        <p className="text-center mb-4">No questions available for this quiz.</p>
        <Button 
          className="mx-auto block"
          onClick={() => setLocation("/my-quizzes")}
        >
          Return to My Quizzes
        </Button>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;

  const handleAnswer = (answer: string) => {
    setAnswers({
      ...answers,
      [currentQuestion.id]: answer,
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/quizzes/${quizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Check if this is a one-time quiz that's already been attempted
        if (response.status === 403 && result.message?.includes("one-time")) {
          setSubmissionError(result.message);
          setPreviousAttempt(result.previousAttempt);
          return;
        }
        throw new Error(result.message || "Failed to submit quiz");
      }

      setLocation(`/quiz-results/${result.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit quiz. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      {quiz.oneTimeOnly && (
        <Alert className="mb-4 border-amber-500 bg-amber-50 text-amber-800">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>One-Time Quiz</AlertTitle>
          <AlertDescription>
            This is a one-time quiz. You will not be able to retake it once submitted.
            Make sure you're ready before starting and review your answers carefully before submitting.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{quiz.title}</CardTitle>
              <CardDescription>
                Question {currentQuestionIndex + 1} of {quiz.questions.length}
              </CardDescription>
            </div>
            {endTime && (
              <CountdownTimer
                endTime={endTime}
                onTimeExpired={handleTimeExpired}
                warningThresholds={[300, 60]} // Warnings at 5 minutes and 1 minute
              />
            )}
          </div>
          <Progress value={progress} className="mt-2" />
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{currentQuestion.question}</h3>

            {currentQuestion.type === "multiple_choice" && (
              <RadioGroup
                value={answers[currentQuestion.id] || ""}
                onValueChange={handleAnswer}
              >
                {currentQuestion.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`}>{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {currentQuestion.type === "true_false" && (
              <RadioGroup
                value={answers[currentQuestion.id] || ""}
                onValueChange={handleAnswer}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id="true" />
                  <Label htmlFor="true">True</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id="false" />
                  <Label htmlFor="false">False</Label>
                </div>
              </RadioGroup>
            )}

            {currentQuestion.type === "short_answer" && (
              <Input
                value={answers[currentQuestion.id] || ""}
                onChange={(e) => handleAnswer(e.target.value)}
                placeholder="Type your answer here..."
              />
            )}
          </div>

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(i => i - 1)}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </Button>

            {currentQuestionIndex === quiz.questions.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Quiz"
                )}
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentQuestionIndex(i => i + 1)}
                disabled={!answers[currentQuestion.id]}
              >
                Next
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default QuizTakingPage;