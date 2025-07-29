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
import { Loader2 } from "lucide-react";

type ChartType = "bar" | "pie" | "line";

type PerformanceData = {
  excellent: number;
  good: number;
  average: number;
  belowAverage: number;
  poor: number;
  averageScore: number;
};

type PerformanceDistributionWidgetProps = {
  title: string;
  chartType: ChartType;
  batchIds?: number[];
  className?: string;
};

// Color constants for charts
const COLORS = {
  excellent: '#22c55e', // green-500
  good: '#3b82f6',      // blue-500
  average: '#eab308',   // yellow-500
  belowAverage: '#f97316', // orange-500
  poor: '#ef4444',      // red-500
  background: '#f3f4f6' // gray-100
};

export function PerformanceDistributionWidget({ 
  title, 
  chartType = "bar", 
  batchIds = [], 
  className 
}: PerformanceDistributionWidgetProps) {
  const { user } = useAuth();
  
  // State to store aggregated performance data across selected batches
  const [aggregatedData, setAggregatedData] = useState<PerformanceData>({
    excellent: 0,
    good: 0,
    average: 0,
    belowAverage: 0,
    poor: 0,
    averageScore: 0
  });
  
  // If no batch IDs are specified, fetch for all available batches
  const effectiveBatchIds = batchIds.length > 0 
    ? batchIds 
    : undefined; // undefined will make the backend return all batches
  
  // Fetch performance data for the selected batches
  const { data: performanceData, isLoading, error } = useQuery<PerformanceData>({
    queryKey: [
      `/api/organizations/${user?.organizationId}/performance/distribution`, 
      { batchIds: effectiveBatchIds }
    ],
    enabled: !!user?.organizationId,
    queryFn: async ({ queryKey }) => {
      const orgId = user?.organizationId;
      const batchQuery = effectiveBatchIds ? `?batchIds=${JSON.stringify(effectiveBatchIds)}` : '';
      
      try {
        const response = await fetch(`/api/organizations/${orgId}/performance/distribution${batchQuery}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch performance data');
        }
        
        return response.json();
      } catch (error) {
        console.error("Error fetching performance data:", error);
        // For development - return some sample data to allow UI testing
        // This should be removed in production
        return {
          excellent: 12,
          good: 45,
          average: 30,
          belowAverage: 8,
          poor: 5,
          averageScore: 76.5
        };
      }
    }
  });
  
  // Process data when it's received or batch selection changes
  useEffect(() => {
    if (performanceData) {
      setAggregatedData(performanceData);
    }
  }, [performanceData, batchIds]);
  
  // Prepare chart data
  const prepareChartData = () => {
    return [
      { name: 'Excellent (90-100%)', value: aggregatedData.excellent, color: COLORS.excellent },
      { name: 'Good (80-89%)', value: aggregatedData.good, color: COLORS.good },
      { name: 'Average (70-79%)', value: aggregatedData.average, color: COLORS.average },
      { name: 'Below Average (60-69%)', value: aggregatedData.belowAverage, color: COLORS.belowAverage },
      { name: 'Poor (<60%)', value: aggregatedData.poor, color: COLORS.poor }
    ];
  };
  
  // Render appropriate chart based on chartType
  const renderChart = () => {
    const data = prepareChartData();
    
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
          <span className="text-destructive">Error loading performance data</span>
        </div>
      );
    }
    
    switch (chartType) {
      case "pie":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={true}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
        
      case "line":
        // For line charts, we can show the distribution over score ranges
        const lineData = [
          { score: '<60', count: aggregatedData.poor },
          { score: '60-69', count: aggregatedData.belowAverage },
          { score: '70-79', count: aggregatedData.average },
          { score: '80-89', count: aggregatedData.good },
          { score: '90-100', count: aggregatedData.excellent }
        ];
        
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={lineData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="score" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="count" 
                name="Number of Trainees" 
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
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" name="Count" fill="#8884d8">
                {data.map((entry, index) => (
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
        {aggregatedData.averageScore > 0 && (
          <div className="text-sm text-muted-foreground">
            Average Score: {aggregatedData.averageScore.toFixed(1)}%
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="w-full h-[260px] rounded-md">
          {renderChart()}
        </div>
        
        {/* Summary stats */}
        <div className="grid grid-cols-5 gap-2 mt-2">
          <div className="text-center">
            <div className="text-xs font-medium">Excellent</div>
            <div className="text-lg font-bold text-green-600">{aggregatedData.excellent}</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-medium">Good</div>
            <div className="text-lg font-bold text-blue-600">{aggregatedData.good}</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-medium">Average</div>
            <div className="text-lg font-bold text-yellow-600">{aggregatedData.average}</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-medium">Below Avg</div>
            <div className="text-lg font-bold text-orange-600">{aggregatedData.belowAverage}</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-medium">Poor</div>
            <div className="text-lg font-bold text-red-600">{aggregatedData.poor}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}