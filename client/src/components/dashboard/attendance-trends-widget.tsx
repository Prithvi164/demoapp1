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
  Cell,
  Area,
  AreaChart
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

type DailyAttendance = {
  date: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendanceRate: number;
};

type WeeklyTrend = {
  startDate: string;
  endDate: string;
  presentRate: number;
  absentRate: number;
  lateRate: number;
  leaveRate: number;
  overallAttendanceRate: number;
};

type AttendanceTrendsData = {
  dailyTrends: DailyAttendance[];
  weeklyTrends: WeeklyTrend[];
  monthlyAverageRate: number;
  previousMonthAverageRate: number;
  rateChange: number;
};

type AttendanceTrendsWidgetProps = {
  title: string;
  chartType: ChartType;
  batchIds?: number[];
  className?: string;
};

// Color constants for charts
const COLORS = {
  present: '#22c55e', // green-500
  absent: '#ef4444',  // red-500
  late: '#eab308',    // yellow-500
  leave: '#3b82f6',   // blue-500
  rate: '#8b5cf6',    // violet-500
  background: '#f3f4f6' // gray-100
};

export function AttendanceTrendsWidget({ 
  title, 
  chartType = "line", 
  batchIds = [], 
  className 
}: AttendanceTrendsWidgetProps) {
  const { user } = useAuth();
  
  // State to store trends data
  const [trendsData, setTrendsData] = useState<AttendanceTrendsData>({
    dailyTrends: [],
    weeklyTrends: [],
    monthlyAverageRate: 0,
    previousMonthAverageRate: 0,
    rateChange: 0
  });
  
  // If no batch IDs are specified, fetch for all available batches
  const effectiveBatchIds = batchIds.length > 0 
    ? batchIds 
    : undefined; // undefined will make the backend return all batches
  
  // Fetch attendance trend data for the selected batches
  const { data, isLoading, error } = useQuery<AttendanceTrendsData>({
    queryKey: [
      `/api/organizations/${user?.organizationId}/attendance/trends`, 
      { batchIds: effectiveBatchIds }
    ],
    enabled: !!user?.organizationId,
    queryFn: async ({ queryKey }) => {
      const orgId = user?.organizationId;
      const batchQuery = effectiveBatchIds ? `?batchIds=${JSON.stringify(effectiveBatchIds)}` : '';
      
      try {
        const response = await fetch(`/api/organizations/${orgId}/attendance/trends${batchQuery}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch attendance trend data');
        }
        
        return response.json();
      } catch (error) {
        console.error("Error fetching attendance trend data:", error);
        // For development - return some sample data to allow UI testing
        // This should be removed in production
        // Generate 14 days of sample data
        const dailyTrends = Array.from({ length: 14 }).map((_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (13 - i));
          const randomRate = 70 + Math.random() * 25;
          const presentCount = Math.floor(Math.random() * 30) + 40;
          const absentCount = Math.floor(Math.random() * 10);
          const lateCount = Math.floor(Math.random() * 8);
          const leaveCount = Math.floor(Math.random() * 5);
          
          return {
            date: date.toISOString().split('T')[0],
            presentCount,
            absentCount,
            lateCount,
            leaveCount,
            attendanceRate: randomRate
          };
        });
        
        // Generate 4 weeks of sample data
        const weeklyTrends = Array.from({ length: 4 }).map((_, i) => {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() - (i * 7));
          const startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 6);
          
          return {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            presentRate: 70 + Math.random() * 20,
            absentRate: Math.random() * 10,
            lateRate: Math.random() * 15,
            leaveRate: Math.random() * 5,
            overallAttendanceRate: 80 + Math.random() * 15
          };
        });
        
        return {
          dailyTrends,
          weeklyTrends: weeklyTrends.reverse(), // Oldest to newest
          monthlyAverageRate: 85.7,
          previousMonthAverageRate: 82.3,
          rateChange: 3.4
        };
      }
    }
  });
  
  // Process data when it's received or batch selection changes
  useEffect(() => {
    if (data) {
      setTrendsData(data);
    }
  }, [data, batchIds]);
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };
  
  // Format data for charts
  const prepareDailyTrendData = () => {
    return trendsData.dailyTrends.map(day => ({
      date: formatDate(day.date),
      Present: day.presentCount,
      Absent: day.absentCount,
      Late: day.lateCount,
      Leave: day.leaveCount,
      Rate: day.attendanceRate
    }));
  };
  
  const prepareWeeklyTrendData = () => {
    return trendsData.weeklyTrends.map(week => {
      const weekRange = `${formatDate(week.startDate)}-${formatDate(week.endDate)}`;
      return {
        week: weekRange,
        Present: week.presentRate,
        Absent: week.absentRate,
        Late: week.lateRate,
        Leave: week.leaveRate,
        Rate: week.overallAttendanceRate
      };
    });
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
          <span className="text-destructive">Error loading attendance trend data</span>
        </div>
      );
    }
    
    const dailyData = prepareDailyTrendData();
    const weeklyData = prepareWeeklyTrendData();
    
    // Use the appropriate data based on chart type
    // Bar and pie charts work better with weekly data (less cluttered)
    // Line charts can handle the more detailed daily data
    const data = chartType === 'line' ? dailyData : weeklyData;
    const dateKey = chartType === 'line' ? 'date' : 'week';
    
    switch (chartType) {
      case "pie":
        // For pie charts, we'll show the distribution of attendance statuses
        // Calculate the average values across all data points
        const avgData = weeklyData.reduce((acc, curr) => {
          acc.Present += curr.Present;
          acc.Absent += curr.Absent;
          acc.Late += curr.Late;
          acc.Leave += curr.Leave;
          return acc;
        }, { Present: 0, Absent: 0, Late: 0, Leave: 0 });
        
        // Calculate percentage and prepare pie data
        const total = avgData.Present + avgData.Absent + avgData.Late + avgData.Leave;
        const pieData = [
          { name: 'Present', value: avgData.Present / weeklyData.length, color: COLORS.present },
          { name: 'Absent', value: avgData.Absent / weeklyData.length, color: COLORS.absent },
          { name: 'Late', value: avgData.Late / weeklyData.length, color: COLORS.late },
          { name: 'Leave', value: avgData.Leave / weeklyData.length, color: COLORS.leave }
        ];
        
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={true}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
        
      case "bar":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={dateKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Present" name="Present %" fill={COLORS.present} />
              <Bar dataKey="Absent" name="Absent %" fill={COLORS.absent} />
              <Bar dataKey="Late" name="Late %" fill={COLORS.late} />
              <Bar dataKey="Leave" name="Leave %" fill={COLORS.leave} />
            </BarChart>
          </ResponsiveContainer>
        );
        
      case "line":
      default:
        // For line charts, the attendance rate is the most important trend to visualize
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.rate} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={COLORS.rate} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={dateKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="Rate" 
                name="Attendance Rate %" 
                stroke={COLORS.rate} 
                fillOpacity={1} 
                fill="url(#colorRate)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        );
    }
  };
  
  return (
    <div className={`${className} w-full h-full`}>
      {/* Metrics summary with improved styling */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-sm font-medium">Monthly Average:</span>
          <span className="ml-2 text-lg font-bold text-primary">
            {trendsData.monthlyAverageRate.toFixed(1)}%
          </span>
        </div>
        
        <div className={`flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full ${
          trendsData.rateChange > 0 
            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
            : trendsData.rateChange < 0 
              ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
              : 'bg-slate-50 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
        }`}>
          {trendsData.rateChange > 0 ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          ) : trendsData.rateChange < 0 ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
            </svg>
          ) : null}
          {Math.abs(trendsData.rateChange).toFixed(1)}% {trendsData.rateChange >= 0 ? 'increase' : 'decrease'}
        </div>
      </div>
      
      {/* Main chart container with proper sizing */}
      <div className="w-full h-[260px] rounded-md">
        {renderChart()}
      </div>
    </div>
  );
}