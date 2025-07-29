import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Loader2 } from "lucide-react";

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

interface EvaluationDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluationDetails: EvaluationDetail | null;
  loading: boolean;
}

const EvaluationDetailsDialog = ({ 
  open, 
  onOpenChange, 
  evaluationDetails,
  loading
}: EvaluationDetailsDialogProps) => {
  // Format date to readable format
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Evaluation Details</DialogTitle>
          <DialogDescription>
            Detailed breakdown of the evaluation scores and feedback
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
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
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EvaluationDetailsDialog;