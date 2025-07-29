import { useParams } from "wouter";
import { BatchDashboard } from "@/components/batch-management/batch-dashboard";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";

export function BatchDashboardPage() {
  const { batchId } = useParams();
  const [, navigate] = useLocation();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate("/batch-management")}
          className="mb-4"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Batch Management
        </Button>
        
        <BatchDashboard batchId={batchId || '0'} />
      </div>
    </div>
  );
}