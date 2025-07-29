import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  BarChart as BarChartIcon,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  ArrowLeft,
  ArrowRight,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Download,
  PieChart,
  LineChart,
  BarChart3,
  ArrowDown10,
  ArrowUp10,
  Eye
} from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import {
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from "recharts";

// Type definitions
type DailyAttendance = {
  date: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendanceRate: number;
  totalTrainees: number;
};

type PhaseAttendance = {
  phase: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendanceRate: number;
  totalDays: number;
  totalRecords: number;
};

type TraineeAttendance = {
  traineeId: number;
  traineeName: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendanceRate: number;
};

type BatchAttendanceOverview = {
  totalDays: number;
  completedDays: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendanceRate: number;
  dailyAttendance: DailyAttendance[];
  phaseAttendance: PhaseAttendance[];
  traineeAttendance: TraineeAttendance[];
};

// Color constants for charts
const COLORS = {
  present: '#22c55e', // green-500
  absent: '#ef4444',  // red-500
  late: '#eab308',    // yellow-500
  leave: '#3b82f6',   // blue-500
  background: '#f3f4f6' // gray-100
};

type ChartType = 'bar' | 'pie' | 'line';
type SortOrder = 'asc' | 'desc';
type SortField = 'name' | 'present' | 'absent' | 'late' | 'leave' | 'rate';

// Attendance detail dialog component
function AttendanceDetailDialog({ 
  title, 
  children, 
  trigger,
  description
}: { 
  title: string;
  children: React.ReactNode;
  trigger: React.ReactNode;
  description?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function AttendanceBreakdown({ 
  attendanceData 
}: { 
  attendanceData: BatchAttendanceOverview 
}) {
  const [breakdownTab, setBreakdownTab] = useState("overall");
  
  // Chart type and sorting state
  const [chartType] = useState<ChartType>('bar'); // Always using bar chart
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [sortField, setSortField] = useState<SortField>('rate');
  
  // Selected drill-down item for detailed view
  const [selectedDay, setSelectedDay] = useState<DailyAttendance | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<PhaseAttendance | null>(null);
  const [selectedTrainee, setSelectedTrainee] = useState<TraineeAttendance | null>(null);
  
  // Search filter state
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Prepare data for recharts
  const prepareOverallChartData = () => {
    return [
      { name: 'Present', value: attendanceData.presentCount, color: COLORS.present },
      { name: 'Absent', value: attendanceData.absentCount, color: COLORS.absent },
      { name: 'Late', value: attendanceData.lateCount, color: COLORS.late },
      { name: 'Leave', value: attendanceData.leaveCount, color: COLORS.leave }
    ];
  };
  
  const prepareDailyChartData = () => {
    console.log('Daily attendance data:', attendanceData.dailyAttendance);
    
    // Sort the array by date (oldest first) to ensure proper visualization
    const sortedData = [...attendanceData.dailyAttendance].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    
    return sortedData.map(day => ({
      date: format(new Date(day.date), 'MMM d'),
      present: day.presentCount,
      absent: day.absentCount,
      late: day.lateCount,
      leave: day.leaveCount,
      rate: day.attendanceRate
    }));
  };
  
  const preparePhaseChartData = () => {
    return attendanceData.phaseAttendance.map(phase => ({
      name: phase.phase,
      present: phase.presentCount,
      absent: phase.absentCount,
      late: phase.lateCount,
      leave: phase.leaveCount,
      rate: phase.attendanceRate
    }));
  };
  
  const prepareTraineeChartData = () => {
    // Sort and filter trainee data
    const filteredTrainees = attendanceData.traineeAttendance
      .filter(trainee => 
        searchTerm ? trainee.traineeName.toLowerCase().includes(searchTerm.toLowerCase()) : true
      )
      .sort((a, b) => {
        // Apply selected sort field
        let valueA, valueB;
        
        switch (sortField) {
          case 'name':
            valueA = a.traineeName;
            valueB = b.traineeName;
            return sortOrder === 'asc' 
              ? valueA.localeCompare(valueB)
              : valueB.localeCompare(valueA);
          case 'present':
            valueA = a.presentCount;
            valueB = b.presentCount;
            break;
          case 'absent':
            valueA = a.absentCount;
            valueB = b.absentCount;
            break;
          case 'late':
            valueA = a.lateCount;
            valueB = b.lateCount;
            break;
          case 'leave':
            valueA = a.leaveCount;
            valueB = b.leaveCount;
            break;
          case 'rate':
          default:
            valueA = a.attendanceRate;
            valueB = b.attendanceRate;
            break;
        }
        
        // Sort numerically for non-string values
        if (typeof valueA === 'number' && typeof valueB === 'number') {
          return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
        }
        
        return 0;
      });
      
    // For charts, only return the top 10 for clarity
    return filteredTrainees.slice(0, 10).map(trainee => ({
      name: trainee.traineeName.length > 15 
        ? trainee.traineeName.substring(0, 15) + '...' 
        : trainee.traineeName,
      present: trainee.presentCount,
      absent: trainee.absentCount,
      late: trainee.lateCount,
      leave: trainee.leaveCount,
      rate: trainee.attendanceRate
    }));
  };
  
  // Format attendance detail data into a table-friendly structure
  const formatAttendanceDetails = (
    type: 'day' | 'phase' | 'trainee', 
    data: DailyAttendance | PhaseAttendance | TraineeAttendance
  ) => {
    const commonData = [
      { label: 'Present', value: data.presentCount, color: COLORS.present },
      { label: 'Absent', value: data.absentCount, color: COLORS.absent },
      { label: 'Late', value: data.lateCount, color: COLORS.late },
      { label: 'Leave', value: data.leaveCount, color: COLORS.leave },
      { label: 'Attendance Rate', value: `${data.attendanceRate}%` }
    ];
    
    // Add type-specific data
    if (type === 'day' && 'date' in data) {
      return [
        { label: 'Date', value: format(new Date(data.date), 'MMM d, yyyy') },
        { label: 'Total Trainees', value: data.totalTrainees },
        ...commonData
      ];
    } else if (type === 'phase' && 'phase' in data) {
      return [
        { label: 'Phase', value: data.phase },
        { label: 'Total Days', value: data.totalDays },
        ...commonData
      ];
    } else if (type === 'trainee' && 'traineeName' in data) {
      return [
        { label: 'Trainee', value: data.traineeName },
        { label: 'Trainee ID', value: data.traineeId },
        ...commonData
      ];
    }
    
    return commonData;
  };
  
  // Render the appropriate chart based on type and data
  const renderChart = (data: any[], type: ChartType) => {
    if (data.length === 0) return null;
    
    // Height based on number of items (with a minimum)
    const chartHeight = Math.max(300, data.length * 40);
    
    // Determine if we're dealing with daily/phase data (has 'present', 'absent', etc.)
    // or overall data (has 'name', 'value' properties)
    const hasAttendanceBreakdown = data.length > 0 && 'present' in data[0];
    
    switch (type) {
      case 'pie':
        if (hasAttendanceBreakdown) {
          // For daily attendance, we need to transform the data
          // Convert to pie chart format by taking the most recent day's data
          const latestDay = data[data.length - 1];
          const pieData = [
            { name: 'Present', value: latestDay.present, color: COLORS.present },
            { name: 'Absent', value: latestDay.absent, color: COLORS.absent },
            { name: 'Late', value: latestDay.late, color: COLORS.late },
            { name: 'Leave', value: latestDay.leave, color: COLORS.leave }
          ];
          
          return (
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RechartsPieChart>
            </ResponsiveContainer>
          );
        } else {
          // For overview data with name/value format
          return (
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS.background} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RechartsPieChart>
            </ResponsiveContainer>
          );
        }
        
      case 'line':
        if (hasAttendanceBreakdown) {
          return (
            <ResponsiveContainer width="100%" height={300}>
              <RechartsLineChart
                data={data}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={data[0].date ? 'date' : 'name'} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="present" stroke={COLORS.present} name="Present" />
                <Line type="monotone" dataKey="absent" stroke={COLORS.absent} name="Absent" />
                <Line type="monotone" dataKey="late" stroke={COLORS.late} name="Late" />
                <Line type="monotone" dataKey="leave" stroke={COLORS.leave} name="Leave" />
                <Line type="monotone" dataKey="rate" stroke="#6366f1" name="Attendance Rate" />
              </RechartsLineChart>
            </ResponsiveContainer>
          );
        } else {
          // For overall data
          return (
            <ResponsiveContainer width="100%" height={300}>
              <RechartsLineChart
                data={data}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#8884d8" name="Count" />
              </RechartsLineChart>
            </ResponsiveContainer>
          );
        }
        
      case 'bar':
      default:
        if (hasAttendanceBreakdown) {
          return (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  type="category" 
                  dataKey={data[0].date ? 'date' : 'name'} 
                  width={100}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" fill={COLORS.present} name="Present" />
                <Bar dataKey="absent" fill={COLORS.absent} name="Absent" />
                <Bar dataKey="late" fill={COLORS.late} name="Late" />
                <Bar dataKey="leave" fill={COLORS.leave} name="Leave" />
              </BarChart>
            </ResponsiveContainer>
          );
        } else {
          // For overall data
          return (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" name="Count">
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS.background} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          );
        }
    }
  };
  
  // Chart control panel component - only sorting controls now
  const ChartControls = () => (
    <div className="flex flex-wrap gap-2 mb-4 justify-between items-center">
      <div className="flex gap-2">
        {/* Bar chart is the only option now */}
      </div>
      
      {/* Additional controls specific to trainee tab */}
      {breakdownTab === 'trainee' && (
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? (
              <>
                <SortAsc className="h-4 w-4 mr-2" />
                Ascending
              </>
            ) : (
              <>
                <SortDesc className="h-4 w-4 mr-2" />
                Descending
              </>
            )}
          </Button>
          
          <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="present">Present Count</SelectItem>
              <SelectItem value="absent">Absent Count</SelectItem>
              <SelectItem value="late">Late Count</SelectItem>
              <SelectItem value="leave">Leave Count</SelectItem>
              <SelectItem value="rate">Attendance Rate</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
  
  // Detail table component
  const DetailTable = ({ details }: { details: { label: string; value: any; color?: string }[] }) => (
    <Table>
      <TableBody>
        {details.map((item, index) => (
          <TableRow key={index}>
            <TableCell className="font-medium">{item.label}</TableCell>
            <TableCell 
              className={item.color ? "font-bold" : ""}
              style={{ color: item.color }}
            >
              {item.value}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">Attendance Breakdown</CardTitle>
          <CardDescription>Interactive attendance analytics and drill-down</CardDescription>
        </div>
        
        {/* Legend badges */}
        <div className="flex gap-2 flex-wrap justify-end">
          <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Present</Badge>
          <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Absent</Badge>
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Late</Badge>
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Leave</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overall" value={breakdownTab} onValueChange={setBreakdownTab}>
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="overall" className="flex items-center gap-2">
              <BarChartIcon className="h-4 w-4" />
              <span>Overall</span>
            </TabsTrigger>
            <TabsTrigger value="daily" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Daily</span>
            </TabsTrigger>
            <TabsTrigger value="phase" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Phase</span>
            </TabsTrigger>
            <TabsTrigger value="trainee" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Trainee</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Overall attendance tab */}
          <TabsContent value="overall">
            <div className="space-y-6">
              <p className="text-xs text-slate-500 italic mb-3">
                Showing overall attendance statistics for the entire training period
              </p>
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-base font-medium">Overall Attendance Rate</span>
                  <span className="text-base font-medium">
                    {attendanceData.attendanceRate}%
                  </span>
                </div>
                <Progress 
                  value={attendanceData.attendanceRate} 
                  className="h-2.5 bg-gray-100 mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {attendanceData.completedDays} days completed out of {attendanceData.totalDays} total training days
                </p>
                <p className="text-xs text-slate-500 italic mt-1">
                  Showing cumulative attendance data for the selected batch from batch start date to current date
                </p>
              </div>
              
              {/* Overall attendance cards with drill-down dialogs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border rounded-lg p-4">
                <AttendanceDetailDialog
                  title="Present Attendance Details"
                  description="Analysis of present attendance records"
                  trigger={
                    <div className="text-center cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
                      <div className="h-12 w-12 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      </div>
                      <p className="mt-2 text-lg font-semibold">{attendanceData.presentCount}</p>
                      <p className="text-sm text-muted-foreground">Present</p>
                      <Button variant="ghost" size="sm" className="mt-2">
                        <Eye className="h-3 w-3 mr-1" />
                        Details
                      </Button>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    <DetailTable
                      details={[
                        { label: 'Total Present Records', value: attendanceData.presentCount, color: COLORS.present },
                        { label: 'Total Records', value: attendanceData.presentCount + attendanceData.absentCount + attendanceData.lateCount + attendanceData.leaveCount },
                        { label: 'Present Percentage', value: `${attendanceData.attendanceRate}%`, color: COLORS.present }
                      ]}
                    />
                    
                    <div className="mt-4">
                      <h3 className="text-md font-medium mb-2">Present Attendance Distribution</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartsPieChart>
                          <Pie
                            data={prepareOverallChartData()}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            outerRadius={120}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {prepareOverallChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </AttendanceDetailDialog>
                
                <AttendanceDetailDialog
                  title="Absent Attendance Details"
                  description="Analysis of absent attendance records"
                  trigger={
                    <div className="text-center cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
                      <div className="h-12 w-12 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                        <AlertCircle className="h-6 w-6 text-red-600" />
                      </div>
                      <p className="mt-2 text-lg font-semibold">{attendanceData.absentCount}</p>
                      <p className="text-sm text-muted-foreground">Absent</p>
                      <Button variant="ghost" size="sm" className="mt-2">
                        <Eye className="h-3 w-3 mr-1" />
                        Details
                      </Button>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    <DetailTable
                      details={[
                        { label: 'Total Absent Records', value: attendanceData.absentCount, color: COLORS.absent },
                        { label: 'Total Records', value: attendanceData.presentCount + attendanceData.absentCount + attendanceData.lateCount + attendanceData.leaveCount },
                        { label: 'Absent Percentage', value: `${Math.round((attendanceData.absentCount / (attendanceData.presentCount + attendanceData.absentCount + attendanceData.lateCount + attendanceData.leaveCount)) * 100)}%`, color: COLORS.absent }
                      ]}
                    />
                    
                    <div className="mt-4">
                      <h3 className="text-md font-medium mb-2">Absence Distribution</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartsPieChart>
                          <Pie
                            data={prepareOverallChartData()}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            outerRadius={120}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {prepareOverallChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </AttendanceDetailDialog>
                
                <AttendanceDetailDialog
                  title="Late Attendance Details"
                  description="Analysis of late attendance records"
                  trigger={
                    <div className="text-center cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
                      <div className="h-12 w-12 mx-auto rounded-full bg-yellow-100 flex items-center justify-center">
                        <Clock className="h-6 w-6 text-yellow-600" />
                      </div>
                      <p className="mt-2 text-lg font-semibold">{attendanceData.lateCount}</p>
                      <p className="text-sm text-muted-foreground">Late</p>
                      <Button variant="ghost" size="sm" className="mt-2">
                        <Eye className="h-3 w-3 mr-1" />
                        Details
                      </Button>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    <DetailTable
                      details={[
                        { label: 'Total Late Records', value: attendanceData.lateCount, color: COLORS.late },
                        { label: 'Total Records', value: attendanceData.presentCount + attendanceData.absentCount + attendanceData.lateCount + attendanceData.leaveCount },
                        { label: 'Late Percentage', value: `${Math.round((attendanceData.lateCount / (attendanceData.presentCount + attendanceData.absentCount + attendanceData.lateCount + attendanceData.leaveCount)) * 100)}%`, color: COLORS.late }
                      ]}
                    />
                    
                    <div className="mt-4">
                      <h3 className="text-md font-medium mb-2">Late Attendance Distribution</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartsPieChart>
                          <Pie
                            data={prepareOverallChartData()}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            outerRadius={120}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {prepareOverallChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </AttendanceDetailDialog>
                
                <AttendanceDetailDialog
                  title="Leave Attendance Details"
                  description="Analysis of leave attendance records"
                  trigger={
                    <div className="text-center cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
                      <div className="h-12 w-12 mx-auto rounded-full bg-blue-100 flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-blue-600" />
                      </div>
                      <p className="mt-2 text-lg font-semibold">{attendanceData.leaveCount}</p>
                      <p className="text-sm text-muted-foreground">Leave</p>
                      <Button variant="ghost" size="sm" className="mt-2">
                        <Eye className="h-3 w-3 mr-1" />
                        Details
                      </Button>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    <DetailTable
                      details={[
                        { label: 'Total Leave Records', value: attendanceData.leaveCount, color: COLORS.leave },
                        { label: 'Total Records', value: attendanceData.presentCount + attendanceData.absentCount + attendanceData.lateCount + attendanceData.leaveCount },
                        { label: 'Leave Percentage', value: `${Math.round((attendanceData.leaveCount / (attendanceData.presentCount + attendanceData.absentCount + attendanceData.lateCount + attendanceData.leaveCount)) * 100)}%`, color: COLORS.leave }
                      ]}
                    />
                    
                    <div className="mt-4">
                      <h3 className="text-md font-medium mb-2">Leave Distribution</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartsPieChart>
                          <Pie
                            data={prepareOverallChartData()}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            outerRadius={120}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {prepareOverallChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </AttendanceDetailDialog>
              </div>
                
              <div className="mt-4">
                <ChartControls onChangeChartType={setChartType} />
                <div>
                  {chartType === 'pie' ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={prepareOverallChartData()}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {prepareOverallChartData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : chartType === 'line' ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsLineChart 
                        data={prepareOverallChartData()}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="value" name="Count" stroke="#8884d8" />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  ) : (
                    // Bar Chart (default)
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={prepareOverallChartData()}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" name="Count" fill="#8884d8">
                          {prepareOverallChartData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    Overall attendance statistics for all batch phases
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Daily attendance tab */}
          <TabsContent value="daily">
            {attendanceData.dailyAttendance.length > 0 ? (
              <div className="space-y-6">
                <p className="text-xs text-slate-500 italic mb-3">
                  Showing day-by-day attendance breakdown for the selected batch
                </p>
                <ChartControls onChangeChartType={setChartType} />
                
                {/* Daily attendance chart */}
                {renderChart(prepareDailyChartData(), chartType)}
                
                <div className="border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Present</TableHead>
                        <TableHead>Absent</TableHead>
                        <TableHead>Late</TableHead>
                        <TableHead>Leave</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...attendanceData.dailyAttendance]
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((day) => (
                        <TableRow key={day.date}>
                          <TableCell>{format(new Date(day.date), 'MMM d, yyyy')}</TableCell>
                          <TableCell className="text-green-600">{day.presentCount}</TableCell>
                          <TableCell className="text-red-600">{day.absentCount}</TableCell>
                          <TableCell className="text-yellow-600">{day.lateCount}</TableCell>
                          <TableCell className="text-blue-600">{day.leaveCount}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <span className="mr-2">{day.attendanceRate}%</span>
                              <Progress value={day.attendanceRate} className="h-2 w-16" />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <AttendanceDetailDialog
                              title={`Daily Attendance: ${format(new Date(day.date), 'MMMM d, yyyy')}`}
                              description="Detailed attendance breakdown for this day"
                              trigger={
                                <Button variant="ghost" size="sm" onClick={() => setSelectedDay(day)}>
                                  <Eye className="h-4 w-4 mr-1" />
                                  Details
                                </Button>
                              }
                            >
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <DetailTable details={formatAttendanceDetails('day', day)} />
                                  </div>
                                  <div>
                                    <h3 className="text-md font-medium mb-2">Attendance Distribution</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                      <RechartsPieChart>
                                        <Pie
                                          data={[
                                            { name: 'Present', value: day.presentCount, color: COLORS.present },
                                            { name: 'Absent', value: day.absentCount, color: COLORS.absent },
                                            { name: 'Late', value: day.lateCount, color: COLORS.late },
                                            { name: 'Leave', value: day.leaveCount, color: COLORS.leave }
                                          ]}
                                          cx="50%"
                                          cy="50%"
                                          labelLine={true}
                                          outerRadius={100}
                                          fill="#8884d8"
                                          dataKey="value"
                                          nameKey="name"
                                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        >
                                          {[
                                            { name: 'Present', value: day.presentCount, color: COLORS.present },
                                            { name: 'Absent', value: day.absentCount, color: COLORS.absent },
                                            { name: 'Late', value: day.lateCount, color: COLORS.late },
                                            { name: 'Leave', value: day.leaveCount, color: COLORS.leave }
                                          ].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                          ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                      </RechartsPieChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              </div>
                            </AttendanceDetailDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No daily attendance data available
              </div>
            )}
          </TabsContent>
          
          {/* Phase attendance tab */}
          <TabsContent value="phase">
            {attendanceData.phaseAttendance.length > 0 ? (
              <div className="space-y-6">
                <p className="text-xs text-slate-500 italic mb-3">
                  Showing phase-wise attendance breakdown for the selected batch
                </p>
                <ChartControls onChangeChartType={setChartType} />
                
                {/* Phase attendance chart */}
                {renderChart(preparePhaseChartData(), chartType)}
                
                <div className="border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phase</TableHead>
                        <TableHead>Present</TableHead>
                        <TableHead>Absent</TableHead>
                        <TableHead>Late</TableHead>
                        <TableHead>Leave</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceData.phaseAttendance.map((phase) => (
                        <TableRow key={phase.phase}>
                          <TableCell>{phase.phase}</TableCell>
                          <TableCell className="text-green-600">{phase.presentCount}</TableCell>
                          <TableCell className="text-red-600">{phase.absentCount}</TableCell>
                          <TableCell className="text-yellow-600">{phase.lateCount}</TableCell>
                          <TableCell className="text-blue-600">{phase.leaveCount}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <span className="mr-2">{phase.attendanceRate}%</span>
                              <Progress value={phase.attendanceRate} className="h-2 w-16" />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <AttendanceDetailDialog
                              title={`Phase Attendance: ${phase.phase}`}
                              description="Detailed attendance breakdown for this phase"
                              trigger={
                                <Button variant="ghost" size="sm" onClick={() => setSelectedPhase(phase)}>
                                  <Eye className="h-4 w-4 mr-1" />
                                  Details
                                </Button>
                              }
                            >
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <DetailTable details={formatAttendanceDetails('phase', phase)} />
                                  </div>
                                  <div>
                                    <h3 className="text-md font-medium mb-2">Attendance Distribution</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                      <RechartsPieChart>
                                        <Pie
                                          data={[
                                            { name: 'Present', value: phase.presentCount, color: COLORS.present },
                                            { name: 'Absent', value: phase.absentCount, color: COLORS.absent },
                                            { name: 'Late', value: phase.lateCount, color: COLORS.late },
                                            { name: 'Leave', value: phase.leaveCount, color: COLORS.leave }
                                          ]}
                                          cx="50%"
                                          cy="50%"
                                          labelLine={true}
                                          outerRadius={100}
                                          fill="#8884d8"
                                          dataKey="value"
                                          nameKey="name"
                                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        >
                                          {[
                                            { name: 'Present', value: phase.presentCount, color: COLORS.present },
                                            { name: 'Absent', value: phase.absentCount, color: COLORS.absent },
                                            { name: 'Late', value: phase.lateCount, color: COLORS.late },
                                            { name: 'Leave', value: phase.leaveCount, color: COLORS.leave }
                                          ].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                          ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                      </RechartsPieChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              </div>
                            </AttendanceDetailDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No phase attendance data available
              </div>
            )}
          </TabsContent>
          
          {/* Trainee attendance tab */}
          <TabsContent value="trainee">
            {attendanceData.traineeAttendance.length > 0 ? (
              <div className="space-y-6">
                <p className="text-xs text-slate-500 italic mb-3">
                  Showing trainee-by-trainee attendance breakdown for the selected batch
                </p>
                <div className="flex flex-wrap gap-2 justify-between items-center">
                  <div className="flex gap-2">
                    <div className="relative w-full max-w-sm">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search trainees..."
                        className="pl-8 w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <ChartControls onChangeChartType={setChartType} />
                </div>
                
                {/* Trainee attendance chart - showing top 10 only for clarity */}
                {renderChart(prepareTraineeChartData(), chartType)}
                
                <div className="border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setSortField('name');
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            }}
                            className="flex items-center -ml-3"
                          >
                            Trainee
                            {sortField === 'name' && (
                              sortOrder === 'asc' ? <ArrowUp10 className="ml-1 h-4 w-4" /> : <ArrowDown10 className="ml-1 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setSortField('present');
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            }}
                            className="flex items-center -ml-3"
                          >
                            Present
                            {sortField === 'present' && (
                              sortOrder === 'asc' ? <ArrowUp10 className="ml-1 h-4 w-4" /> : <ArrowDown10 className="ml-1 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setSortField('absent');
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            }}
                            className="flex items-center -ml-3"
                          >
                            Absent
                            {sortField === 'absent' && (
                              sortOrder === 'asc' ? <ArrowUp10 className="ml-1 h-4 w-4" /> : <ArrowDown10 className="ml-1 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setSortField('late');
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            }}
                            className="flex items-center -ml-3"
                          >
                            Late
                            {sortField === 'late' && (
                              sortOrder === 'asc' ? <ArrowUp10 className="ml-1 h-4 w-4" /> : <ArrowDown10 className="ml-1 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setSortField('leave');
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            }}
                            className="flex items-center -ml-3"
                          >
                            Leave
                            {sortField === 'leave' && (
                              sortOrder === 'asc' ? <ArrowUp10 className="ml-1 h-4 w-4" /> : <ArrowDown10 className="ml-1 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setSortField('rate');
                              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            }}
                            className="flex items-center -ml-3"
                          >
                            Rate
                            {sortField === 'rate' && (
                              sortOrder === 'asc' ? <ArrowUp10 className="ml-1 h-4 w-4" /> : <ArrowDown10 className="ml-1 h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceData.traineeAttendance
                        .filter(trainee => 
                          searchTerm ? trainee.traineeName.toLowerCase().includes(searchTerm.toLowerCase()) : true
                        )
                        .sort((a, b) => {
                          // Apply selected sort field
                          let valueA, valueB;
                          
                          switch (sortField) {
                            case 'name':
                              valueA = a.traineeName;
                              valueB = b.traineeName;
                              return sortOrder === 'asc' 
                                ? valueA.localeCompare(valueB)
                                : valueB.localeCompare(valueA);
                            case 'present':
                              valueA = a.presentCount;
                              valueB = b.presentCount;
                              break;
                            case 'absent':
                              valueA = a.absentCount;
                              valueB = b.absentCount;
                              break;
                            case 'late':
                              valueA = a.lateCount;
                              valueB = b.lateCount;
                              break;
                            case 'leave':
                              valueA = a.leaveCount;
                              valueB = b.leaveCount;
                              break;
                            case 'rate':
                            default:
                              valueA = a.attendanceRate;
                              valueB = b.attendanceRate;
                              break;
                          }
                          
                          // Sort numerically for non-string values
                          if (typeof valueA === 'number' && typeof valueB === 'number') {
                            return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
                          }
                          
                          return 0;
                        })
                        .map((trainee) => (
                          <TableRow key={trainee.traineeId}>
                            <TableCell>{trainee.traineeName}</TableCell>
                            <TableCell className="text-green-600">{trainee.presentCount}</TableCell>
                            <TableCell className="text-red-600">{trainee.absentCount}</TableCell>
                            <TableCell className="text-yellow-600">{trainee.lateCount}</TableCell>
                            <TableCell className="text-blue-600">{trainee.leaveCount}</TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <span className="mr-2">{trainee.attendanceRate}%</span>
                                <Progress value={trainee.attendanceRate} className="h-2 w-16" />
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <AttendanceDetailDialog
                                title={`Trainee Attendance: ${trainee.traineeName}`}
                                description="Detailed attendance breakdown for this trainee"
                                trigger={
                                  <Button variant="ghost" size="sm" onClick={() => setSelectedTrainee(trainee)}>
                                    <Eye className="h-4 w-4 mr-1" />
                                    Details
                                  </Button>
                                }
                              >
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <DetailTable details={formatAttendanceDetails('trainee', trainee)} />
                                    </div>
                                    <div>
                                      <h3 className="text-md font-medium mb-2">Attendance Distribution</h3>
                                      <ResponsiveContainer width="100%" height={300}>
                                        <RechartsPieChart>
                                          <Pie
                                            data={[
                                              { name: 'Present', value: trainee.presentCount, color: COLORS.present },
                                              { name: 'Absent', value: trainee.absentCount, color: COLORS.absent },
                                              { name: 'Late', value: trainee.lateCount, color: COLORS.late },
                                              { name: 'Leave', value: trainee.leaveCount, color: COLORS.leave }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={true}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                            nameKey="name"
                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                          >
                                            {[
                                              { name: 'Present', value: trainee.presentCount, color: COLORS.present },
                                              { name: 'Absent', value: trainee.absentCount, color: COLORS.absent },
                                              { name: 'Late', value: trainee.lateCount, color: COLORS.late },
                                              { name: 'Leave', value: trainee.leaveCount, color: COLORS.leave }
                                            ].map((entry, index) => (
                                              <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                          </Pie>
                                          <Tooltip />
                                          <Legend />
                                        </RechartsPieChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>
                                </div>
                              </AttendanceDetailDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No trainee attendance data available
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}