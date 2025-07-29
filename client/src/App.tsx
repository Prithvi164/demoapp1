import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { PermissionsProvider } from "@/hooks/use-permissions";
import { setupScaleHandling } from "@/lib/scale-handler";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";

import Performance from "@/pages/performance";
import Settings from "@/pages/settings";
import TraineeManagement from "@/pages/trainee-management";
import QuizManagement from "@/pages/quiz-management";
import { BatchMonitoringPage } from "@/pages/batch-monitoring";
import { QuizTakingPage } from "@/pages/quiz-taking";
import { QuizResultsPage } from "@/pages/quiz-results";
import { MyQuizzesPage } from "@/pages/my-quizzes";
import FixHolidayPermissions from "@/pages/fix-holiday-permissions";
import MockCallScenarios from "@/pages/mock-call-scenarios";
import EvaluationTemplates from "@/pages/evaluation-templates";
import AudioFileAllocation from "@/pages/audio-file-allocation";
import AudioAssignmentDashboard from "@/pages/audio-assignment-dashboard";
import PermissionGuardedConductEvaluation from "@/pages/conduct-evaluation";
import PermissionGuardedEvaluationFeedback from "@/pages/evaluation-feedback";
import AzureStorageBrowser from "@/pages/azure-storage-browser";
import AzureStorageManagement from "@/pages/azure-storage-management";
import Reports from "@/pages/reports";
import { ProtectedRoute } from "./lib/protected-route";
import { SidebarNav } from "./components/sidebar-nav";
import { UserProfile } from "./components/user-profile";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { BatchDetailsPage } from "@/components/batch-management/batch-details-page";
import { BatchDetail } from "@/components/batch-management/batch-detail";
import { BatchDashboardPage } from "@/pages/batch-dashboard-page";

interface BatchDetailProps {
  onCreateBatch?: () => void;
}

function Router() {
  const { user } = useAuth();
  const [location] = useLocation();

  const isSettingsPage = location === "/settings";
  const isAuthPage = location.startsWith("/auth");

  if (user && !user.onboardingCompleted && !isAuthPage) {
    return <OnboardingFlow />;
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {user && !isAuthPage && !isSettingsPage && <SidebarNav />}
      <main className={`transition-all duration-300 ${user && !isSettingsPage ? "flex-1" : "w-full"} flex flex-col overflow-hidden`}>
        {user && !isAuthPage && !isSettingsPage && (
          <div className="p-2 sm:p-4 border-b flex justify-end items-center shrink-0">
            <UserProfile />
          </div>
        )}
        <div className="overflow-auto flex-1">
          <Switch>
            <Route path="/auth" component={AuthPage} />
            <Route path="/forgot-password" component={ForgotPasswordPage} />
            <Route path="/reset-password" component={ResetPasswordPage} />
            <ProtectedRoute path="/" component={Dashboard} />
            <ProtectedRoute path="/trainee-management" component={TraineeManagement} />
            <ProtectedRoute path="/performance" component={Performance} />
            <ProtectedRoute path="/settings" component={Settings} />
            <ProtectedRoute path="/batch-management" component={() => <BatchDetail onCreateBatch={() => {}} />} />
            <ProtectedRoute path="/batch-monitoring" component={BatchMonitoringPage} />
            <ProtectedRoute path="/batch-details/:batchId" component={BatchDetailsPage} />
            <ProtectedRoute path="/batch-dashboard/:batchId" component={BatchDashboardPage} />
            <ProtectedRoute path="/quiz-management" component={QuizManagement} />
            <ProtectedRoute path="/my-quizzes" component={MyQuizzesPage} />
            <ProtectedRoute path="/quiz/:quizId" component={QuizTakingPage} />
            <ProtectedRoute path="/quiz-results/:attemptId" component={QuizResultsPage} />
            <ProtectedRoute path="/mock-call-scenarios" component={MockCallScenarios} />
            <ProtectedRoute path="/evaluation-templates" component={EvaluationTemplates} />
            <ProtectedRoute path="/conduct-evaluation" component={PermissionGuardedConductEvaluation} /> 
            <ProtectedRoute path="/evaluation-feedback" component={PermissionGuardedEvaluationFeedback} />
            <ProtectedRoute path="/audio-file-allocation" component={AudioFileAllocation} />
            <ProtectedRoute path="/audio-assignment-dashboard" component={AudioAssignmentDashboard} />
            <ProtectedRoute path="/azure-storage-browser" component={AzureStorageBrowser} />
            <ProtectedRoute path="/azure-storage-browser/:containerName" component={AzureStorageBrowser} />
            <ProtectedRoute path="/azure-storage-management" component={AzureStorageManagement} />
            <ProtectedRoute path="/azure-storage-management/:containerName" component={AzureStorageManagement} />
            <ProtectedRoute path="/reports" component={Reports} />
            <ProtectedRoute path="/fix-holiday-permissions" component={FixHolidayPermissions} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
    </div>
  );
}

function App() {
  // Set up scale handling when the component mounts
  useEffect(() => {
    // Initialize scale handler
    const cleanup = setupScaleHandling();
    
    // Clean up event listeners when component unmounts
    return cleanup;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PermissionsProvider>
          <Router />
          <Toaster />
        </PermissionsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;