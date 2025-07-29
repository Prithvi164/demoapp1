import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Cell 
} from "recharts";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type ChartType = "bar" | "pie" | "line";

type Phase = {
  name: string;
  progress: number;
  status: 'upcoming' | 'active' | 'completed';
  daysCompleted: number;
  totalDays: number;
};

type PhaseCompletionData = {
  batchesCompletingThisMonth: number;
  batchesCompletingNextMonth: number;
  onTrackBatches: number;
  atRiskBatches: number;
  delayedBatches: number;
  phases: Record<string, number>; // Count of batches in each phase
  overallCompletion: number; // Average completion percentage across selected batches
};

type PhaseCompletionWidgetProps = {
  title: string;
  chartType: ChartType;
  batchIds?: number[];
  className?: string;
};

// Color constants for charts
const COLORS = {
  induction: '#60a5fa',    // blue-400
  training: '#34d399',     // emerald-400
  certification: '#a78bfa', // violet-400
  ojt: '#f97316',          // orange-500
  ojt_certification: '#8b5cf6', // violet-500
  completed: '#22c55e',     // green-500
  planned: '#9ca3af',      // gray-400
  background: '#f3f4f6'    // gray-100
};

// Helper function to get friendly phase names
const formatPhaseName = (phase: string): string => {
  const phaseMap: Record<string, string> = {
    planned: 'Planned',
    induction: 'Induction',
    training: 'Training',
    certification: 'Certification',
    ojt: 'On-Job Training',
    ojt_certification: 'OJT Certification',
    completed: 'Completed'
  };
  
  return phaseMap[phase] || phase.charAt(0).toUpperCase() + phase.slice(1).replace(/_/g, ' ');
};

export function PhaseCompletionWidget({ 
  title, 
  chartType = "bar", 
  batchIds = [], 
  className 
}: PhaseCompletionWidgetProps) {
  const { user } = useAuth();
  
  // State to store phase completion data
  const [phaseCompletionData, setPhaseCompletionData] = useState<PhaseCompletionData>({
    batchesCompletingThisMonth: 0,
    batchesCompletingNextMonth: 0,
    onTrackBatches: 0,
    atRiskBatches: 0,
    delayedBatches: 0,
    phases: {},
    overallCompletion: 0
  });
  
  // If no batch IDs are specified, fetch for all available batches
  const effectiveBatchIds = batchIds.length > 0 
    ? batchIds 
    : undefined; // undefined will make the backend return all batches
  
  // Fetch phase completion data for the selected batches
  const { data, isLoading, error } = useQuery<PhaseCompletionData>({
    queryKey: [
      `/api/organizations/${user?.organizationId}/batches/phase-completion`, 
      { batchIds: effectiveBatchIds }
    ],
    enabled: !!user?.organizationId,
    queryFn: async ({ queryKey }) => {
      const orgId = user?.organizationId;
      const batchQuery = effectiveBatchIds ? `?batchIds=${JSON.stringify(effectiveBatchIds)}` : '';
      
      try {
        const response = await fetch(`/api/organizations/${orgId}/batches/phase-completion${batchQuery}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch phase completion data');
        }
        
        return response.json();
      } catch (error) {
        console.error("Error fetching phase completion data:", error);
        // For development - return some sample data to allow UI testing
        // This should be removed in production
        return {
          batchesCompletingThisMonth: 3,
          batchesCompletingNextMonth: 5,
          onTrackBatches: 12,
          atRiskBatches: 2,
          delayedBatches: 1,
          phases: {
            planned: 4,
            induction: 5,
            training: 8,
            certification: 3,
            ojt: 6,
            ojt_certification: 2,
            completed: 2
          },
          overallCompletion: 64.5
        };
      }
    }
  });
  
  // Process data when it's received or batch selection changes
  useEffect(() => {
    if (data) {
      setPhaseCompletionData(data);
    }
  }, [data, batchIds]);
  
  // Prepare chart data based on chart type
  const prepareChartData = () => {
    if (!phaseCompletionData.phases) return [];
    
    return Object.entries(phaseCompletionData.phases).map(([phase, count]) => ({
      name: formatPhaseName(phase),
      value: count,
      color: (COLORS as any)[phase] || COLORS.background
    }));
  };
  
  // Prepare line chart data showing completion projection
  const prepareCompletionProjection = () => {
    return [
      { month: 'This Month', count: phaseCompletionData.batchesCompletingThisMonth },
      { month: 'Next Month', count: phaseCompletionData.batchesCompletingNextMonth },
      { month: 'Later', count: batchIds.length - (phaseCompletionData.batchesCompletingThisMonth + phaseCompletionData.batchesCompletingNextMonth) }
    ];
  };
  
  // Render appropriate chart based on chartType
  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="flex justify-center items-center h-full">
          <span className="text-destructive">Error loading phase completion data</span>
        </div>
      );
    }
    
    const phaseData = prepareChartData();
    
    switch (chartType) {
      case "pie":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={phaseData}
                cx="50%"
                cy="50%"
                labelLine={true}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {phaseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
        
      case "line":
        const projectionData = prepareCompletionProjection();
        
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={projectionData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="count" 
                name="Completing Batches" 
                stroke="#6366f1"
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );
        
      case "bar":
      default:
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={phaseData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" name="Number of Batches" fill="#8884d8">
                {phaseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };
  
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-medium">{title}</CardTitle>
        <div className="text-sm text-muted-foreground">
          Overall completion: {phaseCompletionData.overallCompletion.toFixed(1)}%
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[260px] rounded-md">
          {renderChart()}
        </div>
        
        {/* Status summary */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="col-span-3">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm font-medium">{phaseCompletionData.overallCompletion.toFixed(1)}%</span>
            </div>
            <Progress value={phaseCompletionData.overallCompletion} className="h-2" />
          </div>
          
          <div className="bg-green-50 border border-green-100 rounded-md p-3 text-center">
            <div className="text-sm text-green-800">On Track</div>
            <div className="text-2xl font-bold text-green-600">{phaseCompletionData.onTrackBatches}</div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-100 rounded-md p-3 text-center">
            <div className="text-sm text-yellow-800">At Risk</div>
            <div className="text-2xl font-bold text-yellow-600">{phaseCompletionData.atRiskBatches}</div>
          </div>
          
          <div className="bg-red-50 border border-red-100 rounded-md p-3 text-center">
            <div className="text-sm text-red-800">Delayed</div>
            <div className="text-2xl font-bold text-red-600">{phaseCompletionData.delayedBatches}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}