import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { queryClient } from '@/lib/queryClient';
import { Loader2, ClipboardList, Eye, Check, X } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { usePermissions } from '@/hooks/use-permissions';

// Define types for evaluation data
type EvaluationParameter = {
  id: number;
  name: string;
  description: string | null;
  weight: number;
  pillarId: number;
  orderIndex: number;
};

type EvaluationPillar = {
  id: number;
  name: string;
  description: string | null;
  weight: number;
  templateId: number;
  orderIndex: number;
};

type EvaluationScore = {
  id: number;
  evaluationId: number;
  parameterId: number;
  score: string;
  comment: string | null;
  noReason: string | null;
  parameter?: EvaluationParameter;
  pillar?: EvaluationPillar;
};

type GroupedScore = {
  pillar?: EvaluationPillar;
  scores: EvaluationScore[];
};

type EvaluationDetail = {
  evaluation: {
    id: number;
    templateId: number;
    evaluationType: string;
    traineeId: number;
    evaluatorId: number;
    finalScore: number;
    createdAt: string;
    audioFileId?: number;
  };
  groupedScores: GroupedScore[];
};

// Define a type for feedback items
type FeedbackItem = {
  id: number;
  status: 'pending' | 'accepted' | 'rejected';
  evaluation: {
    id: number;
    finalScore: number;
    createdAt: string;
  };
  rejectionReason?: string;
  agentResponse?: string;
  reportingHeadResponse?: string;
};

function EvaluationFeedbackPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('pending');
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<number | null>(null);
  const [evaluationDetails, setEvaluationDetails] = useState<EvaluationDetail | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch ALL feedback items regardless of status
  const { data: feedbackItems = [], isLoading } = useQuery({
    queryKey: ['/api/evaluation-feedback', 'all'],
    queryFn: async () => {
      return fetch('/api/evaluation-feedback?all=true')
        .then(res => res.json());
    },
  });
  
  // Function to fetch evaluation details
  const fetchEvaluationDetails = async (evaluationId: number) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`/api/evaluations/${evaluationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch evaluation details');
      }
      const data = await response.json();
      setEvaluationDetails(data);
      setDetailsDialogOpen(true);
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
  
  // Handle view details click
  const handleViewDetails = (evaluationId: number) => {
    setSelectedEvaluationId(evaluationId);
    fetchEvaluationDetails(evaluationId);
  };

  // Update feedback mutation
  const updateFeedbackMutation = useMutation({
    mutationFn: async (data: { 
      feedbackId: number; 
      status: 'accepted' | 'rejected';
      agentResponse?: string;
      reportingHeadResponse?: string;
      rejectionReason?: string;
    }) => {
      const url = `/api/evaluation-feedback/${data.feedbackId}`;
      const options = {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      };
      return fetch(url, options).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/evaluation-feedback', 'all'] });
      setIsDialogOpen(false);
      toast({
        title: 'Feedback updated',
        description: 'The evaluation feedback has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update feedback: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  // Handle accept feedback
  const handleAccept = (feedback: FeedbackItem) => {
    updateFeedbackMutation.mutate({
      feedbackId: feedback.id,
      status: 'accepted',
    });
  };

  // Handle reject feedback dialog
  const openRejectDialog = (feedback: FeedbackItem) => {
    setSelectedFeedback(feedback);
    setRejectionReason('');
    setIsDialogOpen(true);
  };

  // Handle submit rejection
  const handleReject = () => {
    if (!selectedFeedback) return;
    
    if (!rejectionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Rejection reason is required',
        variant: 'destructive'
      });
      return;
    }

    updateFeedbackMutation.mutate({
      feedbackId: selectedFeedback.id,
      status: 'rejected',
      rejectionReason: rejectionReason
    });
  };

  // Filter feedback items based on the active tab
  const filteredFeedback = (Array.isArray(feedbackItems) ? feedbackItems : [])
    .filter((item: FeedbackItem) => {
      if (activeTab === 'pending') return item.status === 'pending';
      if (activeTab === 'accepted') return item.status === 'accepted';
      if (activeTab === 'rejected') return item.status === 'rejected';
      return true;
    });

  // Format date to readable format
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Get status badge based on status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-300">Pending</Badge>;
      case 'accepted':
        return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-300">Accepted</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-300">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Evaluation Feedback</h1>
      
      <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="accepted">Accepted</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="space-y-4">
          {filteredFeedback.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              No {activeTab} feedback items found
            </div>
          ) : (
            filteredFeedback.map((feedback: FeedbackItem) => (
              <Card key={feedback.id} className="mb-4">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Evaluation #{feedback.evaluation.id}</CardTitle>
                      <CardDescription>
                        Evaluated: {formatDate(feedback.evaluation.createdAt)}
                      </CardDescription>
                    </div>
                    {getStatusBadge(feedback.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Final Score</h4>
                        <p className="text-xl font-bold">
                          {feedback.evaluation.finalScore}%
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-1"
                        onClick={() => handleViewDetails(feedback.evaluation.id)}
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </Button>
                    </div>
                    
                    {feedback.rejectionReason && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-red-600">Rejection Reason</h4>
                        <p className="text-sm border p-2 rounded bg-red-50 border-red-200">
                          {feedback.rejectionReason}
                        </p>
                      </div>
                    )}
                    
                    {feedback.agentResponse && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Agent Response</h4>
                        <p className="text-sm border p-2 rounded">
                          {feedback.agentResponse}
                        </p>
                      </div>
                    )}
                    
                    {feedback.reportingHeadResponse && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Reporting Head Response</h4>
                        <p className="text-sm border p-2 rounded">
                          {feedback.reportingHeadResponse}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
                
                {feedback.status === 'pending' && (
                  <CardFooter className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => openRejectDialog(feedback)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button onClick={() => handleAccept(feedback)}>
                      <Check className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                  </CardFooter>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
      
      {/* Rejection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Evaluation</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this evaluation. This will be visible to the agent and other stakeholders.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="rejection-reason" className="mb-2 block">
              Rejection Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter the reason for rejection..."
              className="min-h-[100px]"
            />
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={updateFeedbackMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={updateFeedbackMutation.isPending || !rejectionReason.trim()}
            >
              {updateFeedbackMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Rejection'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evaluation Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Evaluation Details</DialogTitle>
            <DialogDescription>
              Detailed breakdown of the evaluation scores and feedback
            </DialogDescription>
          </DialogHeader>
          
          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : evaluationDetails ? (
            <div className="py-4">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-semibold">
                    Evaluation #{evaluationDetails.evaluation.id}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Date: {formatDate(evaluationDetails.evaluation.createdAt)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Type: {evaluationDetails.evaluation.evaluationType}
                  </p>
                </div>
                <div className="text-right">
                  <h4 className="text-sm font-medium">Final Score</h4>
                  <p className="text-2xl font-bold">{evaluationDetails.evaluation.finalScore}%</p>
                </div>
              </div>

              <Separator className="my-4" />
              
              <ScrollArea className="h-[400px] pr-4">
                {evaluationDetails.groupedScores.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No detailed scores available</p>
                ) : (
                  <Accordion type="multiple" className="w-full">
                    {evaluationDetails.groupedScores.map((group, groupIndex) => (
                      <AccordionItem key={groupIndex} value={`pillar-${group.pillar?.id || groupIndex}`}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex justify-between items-center w-full pr-4">
                            <span className="font-medium">
                              {group.pillar?.name || `Section ${groupIndex + 1}`}
                            </span>
                            {group.pillar && (
                              <span className="text-sm px-2">
                                Weight: {group.pillar.weight}%
                              </span>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 pl-2">
                            {group.scores.map((score) => (
                              <div key={score.id} className="bg-muted p-3 rounded-md">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1">
                                    <h4 className="font-medium">{score.parameter?.name || 'Parameter'}</h4>
                                    {score.parameter?.description && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {score.parameter.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {score.parameter && (
                                      <span className="text-xs bg-muted-foreground/20 px-2 py-1 rounded">
                                        Weight: {score.parameter.weight}%
                                      </span>
                                    )}
                                    <span className="text-sm font-semibold">
                                      Score: {score.score}
                                    </span>
                                  </div>
                                </div>
                                
                                {score.comment && (
                                  <div className="mt-2">
                                    <h5 className="text-xs font-medium mb-1">Comment:</h5>
                                    <p className="text-sm border-l-2 border-primary pl-2 py-1">
                                      {score.comment}
                                    </p>
                                  </div>
                                )}
                                
                                {score.noReason && (
                                  <div className="mt-2">
                                    <h5 className="text-xs font-medium mb-1">No Reason:</h5>
                                    <p className="text-sm border-l-2 border-red-500 pl-2 py-1">
                                      {score.noReason}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </ScrollArea>
            </div>
          ) : (
            <p className="text-center py-4 text-muted-foreground">
              Failed to load evaluation details
            </p>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Permission guard wrapper
const PermissionGuardedEvaluationFeedback = () => {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission('manage_evaluation_feedback')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <h2 className="text-2xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground mb-4">
          You do not have permission to access the Evaluation Feedback section.
        </p>
        <Button asChild variant="outline">
          <a href="/">Return to Dashboard</a>
        </Button>
      </div>
    );
  }
  
  return <EvaluationFeedbackPage />;
};

export default PermissionGuardedEvaluationFeedback;