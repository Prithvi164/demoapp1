import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart3, ChevronDown, ChevronRight, FileAudio, Filter, Info, PieChart, RefreshCw, Calendar, ClipboardList, BarChart2 } from 'lucide-react';
import { format, isSameDay, isThisWeek, isThisMonth, parseISO } from 'date-fns';
import { BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Bar, PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

// Define types for the components
type EvaluationParameter = {
  id: number;
  name: string;
  description: string;
  weightage: number;
  pillarId: number;
}

type EvaluationPillar = {
  id: number;
  name: string;
  description: string;
  weightage: number;
}

type EvaluationScore = {
  id: number;
  evaluationId: number;
  parameterId: number;
  score: number;
  comment?: string;
  noReason?: string;
}

type Evaluation = {
  id: number;
  templateId: number;
  evaluationType: 'standard' | 'audio';
  traineeId: number | null;
  evaluatorId: number;
  finalScore: number;
  status: 'completed';
  createdAt: string;
  organizationId: number;
}

type AudioFileAllocation = {
  id: number;
  allocationDate: string;
  dueDate: string | null;
  status: 'allocated' | 'evaluated' | 'archived';
  allocatedBy: number;
  allocatedByName: string;
  qualityAnalystId: number;
  qualityAnalystName: string;
  audioFileId: number;
  audioFileName: string;
  createdAt: string;
  organizationId: number;
  isCurrentUser?: boolean; // Flag to indicate if allocation belongs to current user
  audioFile?: {
    status: 'allocated' | 'evaluated' | 'archived';
    id: number;
    filename: string;
    evaluationId?: number;
  };
  evaluation?: Evaluation;
  evaluationScore?: number;
  parameterScores?: Record<number, { 
    score: number;
    parameterName: string;
    pillarName: string;
  }>;
};

// For parameter-wise visualization
type ParameterScoreData = {
  name: string;
  score: number;
  pillar: string;
  count: number;
};

type PillarScoreData = {
  name: string;
  score: number;
  count: number;
};

type QualityAnalystScoreData = {
  name: string;
  averageScore: number;
  evaluationCount: number;
  parameters: Record<string, number>; // parameter name -> average score
};

// Status color mapping
const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'allocated': return 'bg-blue-100 text-blue-800';
    case 'evaluated': return 'bg-green-100 text-green-800';
    case 'archived': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

// Status background colors for cards
const getStatusBgColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-50';
    case 'allocated': return 'bg-blue-50';
    case 'evaluated': return 'bg-green-50';
    case 'archived': return 'bg-gray-50';
    default: return 'bg-gray-50';
  }
};

// Format date to readable format
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString(undefined, { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

// Component to display parameter scores with bar chart
const ParameterScoreVisualization = ({
  evaluatedAssignments,
  selectedAnalyst
}: {
  evaluatedAssignments: AudioFileAllocation[];
  selectedAnalyst: string;
}) => {
  const [visualizationType, setVisualizationType] = useState<'parameters' | 'pillars' | 'analysts'>('parameters');
  
  // Process data for visualization
  const parameterData: ParameterScoreData[] = useMemo(() => {
    const paramScores: Record<string, { total: number; count: number; pillar: string }> = {};
    
    evaluatedAssignments.forEach(allocation => {
      if (
        allocation.status === 'evaluated' && 
        allocation.parameterScores && 
        (selectedAnalyst === 'all' || allocation.qualityAnalystId.toString() === selectedAnalyst)
      ) {
        Object.values(allocation.parameterScores).forEach(param => {
          const key = param.parameterName;
          if (!paramScores[key]) {
            paramScores[key] = { total: 0, count: 0, pillar: param.pillarName };
          }
          paramScores[key].total += param.score;
          paramScores[key].count += 1;
        });
      }
    });
    
    return Object.entries(paramScores).map(([name, data]) => ({
      name,
      score: Math.round((data.total / data.count) * 10) / 10, // Round to 1 decimal
      pillar: data.pillar,
      count: data.count
    }));
  }, [evaluatedAssignments, selectedAnalyst]);

  // Process pillar data for visualization
  const pillarData: PillarScoreData[] = useMemo(() => {
    const pillarScores: Record<string, { total: number; count: number }> = {};
    
    evaluatedAssignments.forEach(allocation => {
      if (
        allocation.status === 'evaluated' && 
        allocation.parameterScores && 
        (selectedAnalyst === 'all' || allocation.qualityAnalystId.toString() === selectedAnalyst)
      ) {
        Object.values(allocation.parameterScores).forEach(param => {
          const key = param.pillarName;
          if (!pillarScores[key]) {
            pillarScores[key] = { total: 0, count: 0 };
          }
          pillarScores[key].total += param.score;
          pillarScores[key].count += 1;
        });
      }
    });
    
    return Object.entries(pillarScores).map(([name, data]) => ({
      name,
      score: Math.round((data.total / data.count) * 10) / 10, // Round to 1 decimal
      count: data.count
    }));
  }, [evaluatedAssignments, selectedAnalyst]);

  // Process analyst data
  const analystData: QualityAnalystScoreData[] = useMemo(() => {
    const analystScores: Record<string, {
      id: number;
      name: string;
      totalScore: number;
      count: number;
      parameters: Record<string, { total: number; count: number }>
    }> = {};
    
    evaluatedAssignments.forEach(allocation => {
      if (allocation.status === 'evaluated' && allocation.parameterScores) {
        const analystId = allocation.qualityAnalystId.toString();
        if (selectedAnalyst !== 'all' && analystId !== selectedAnalyst) {
          return;
        }
        
        if (!analystScores[analystId]) {
          analystScores[analystId] = {
            id: allocation.qualityAnalystId,
            name: allocation.qualityAnalystName,
            totalScore: 0,
            count: 0,
            parameters: {}
          };
        }
        
        if (allocation.evaluationScore) {
          analystScores[analystId].totalScore += allocation.evaluationScore;
          analystScores[analystId].count += 1;
        }
        
        Object.values(allocation.parameterScores).forEach(param => {
          if (!analystScores[analystId].parameters[param.parameterName]) {
            analystScores[analystId].parameters[param.parameterName] = {
              total: 0,
              count: 0
            };
          }
          
          analystScores[analystId].parameters[param.parameterName].total += param.score;
          analystScores[analystId].parameters[param.parameterName].count += 1;
        });
      }
    });
    
    return Object.values(analystScores).map(data => ({
      name: data.name,
      averageScore: data.count ? Math.round((data.totalScore / data.count) * 10) / 10 : 0,
      evaluationCount: data.count,
      parameters: Object.fromEntries(
        Object.entries(data.parameters).map(([param, scores]) => [
          param,
          scores.count ? Math.round((scores.total / scores.count) * 10) / 10 : 0
        ])
      )
    }));
  }, [evaluatedAssignments, selectedAnalyst]);

  // Generate colors for charts
  const getColorForScore = (score: number) => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  // Charts based on selected visualization type
  const renderCharts = () => {
    if (visualizationType === 'parameters') {
      // If no data, show a message
      if (parameterData.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center h-64">
            <FileAudio className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No parameter data available</p>
            <p className="text-sm text-muted-foreground">
              Try selecting a different filter
            </p>
          </div>
        );
      }

      // Sort by score
      const sortedData = [...parameterData].sort((a, b) => b.score - a.score);
      
      return (
        <div className="space-y-6">
          <div className="border rounded-md p-4">
            <h3 className="text-lg font-semibold mb-4">Parameter Score Overview</h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sortedData} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => [
                      `${value}%`, 'Score'
                    ]}
                    labelFormatter={(name) => `Parameter: ${name}`}
                  />
                  <Legend />
                  <Bar dataKey="score" name="Score (%)">
                    {sortedData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getColorForScore(entry.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="border rounded-md p-4">
            <h3 className="text-lg font-semibold mb-4">Parameter Scores Table</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parameter</TableHead>
                  <TableHead>Pillar</TableHead>
                  <TableHead className="text-right">Score (%)</TableHead>
                  <TableHead className="text-right">Evaluations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((param, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{param.name}</TableCell>
                    <TableCell>{param.pillar}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={`
                        ${param.score >= 80 ? 'bg-green-100 text-green-800' : 
                          param.score >= 60 ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'}
                      `}>
                        {param.score}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{param.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      );
    } else if (visualizationType === 'pillars') {
      if (pillarData.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center h-64">
            <FileAudio className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No pillar data available</p>
            <p className="text-sm text-muted-foreground">
              Try selecting a different filter
            </p>
          </div>
        );
      }

      // Sort by score
      const sortedData = [...pillarData].sort((a, b) => b.score - a.score);
      
      return (
        <div className="space-y-6">
          <div className="border rounded-md p-4">
            <h3 className="text-lg font-semibold mb-4">Pillar Score Overview</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sortedData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value: number) => [`${value}%`, 'Score']} />
                    <Legend />
                    <Bar dataKey="score" name="Score (%)">
                      {sortedData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getColorForScore(entry.score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={sortedData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {sortedData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 60%)`} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} evaluations`, 'Count']} />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <div className="border rounded-md p-4">
            <h3 className="text-lg font-semibold mb-4">Pillar Scores Table</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pillar</TableHead>
                  <TableHead className="text-right">Score (%)</TableHead>
                  <TableHead className="text-right">Evaluation Parameters</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((pillar, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{pillar.name}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={`
                        ${pillar.score >= 80 ? 'bg-green-100 text-green-800' : 
                          pillar.score >= 60 ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'}
                      `}>
                        {pillar.score}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{pillar.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      );
    } else {
      // Analysts view
      if (analystData.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center h-64">
            <FileAudio className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No analyst data available</p>
            <p className="text-sm text-muted-foreground">
              Try selecting a different filter
            </p>
          </div>
        );
      }

      // Sort by score
      const sortedData = [...analystData].sort((a, b) => b.averageScore - a.averageScore);
      
      // Get all parameter names across all analysts
      const allParameters = new Set<string>();
      sortedData.forEach(analyst => {
        Object.keys(analyst.parameters).forEach(param => allParameters.add(param));
      });
      
      // Prepare data for parameter comparison chart
      const parameterComparisonData = Array.from(allParameters).map(param => {
        const data: any = { parameter: param };
        sortedData.forEach(analyst => {
          data[analyst.name] = analyst.parameters[param] || 0;
        });
        return data;
      });
      
      return (
        <div className="space-y-6">
          <div className="border rounded-md p-4">
            <h3 className="text-lg font-semibold mb-4">Quality Analyst Performance</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sortedData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip 
                    formatter={(value: number) => [`${value}%`, 'Average Score']}
                    labelFormatter={(name) => `Analyst: ${name}`}
                  />
                  <Legend />
                  <Bar dataKey="averageScore" name="Avg. Score (%)">
                    {sortedData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getColorForScore(entry.averageScore)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {sortedData.length > 1 && parameterComparisonData.length > 0 && (
            <div className="border rounded-md p-4">
              <h3 className="text-lg font-semibold mb-4">Parameter Comparison</h3>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={parameterComparisonData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="parameter" angle={-45} textAnchor="end" height={80} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value: number) => [`${value}%`, 'Score']} />
                    <Legend />
                    {sortedData.map((analyst, index) => (
                      <Bar 
                        key={analyst.name}
                        dataKey={analyst.name} 
                        fill={`hsl(${index * 45}, 70%, 60%)`} 
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          
          <div className="border rounded-md p-4">
            <h3 className="text-lg font-semibold mb-4">Analyst Performance Details</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Analyst</TableHead>
                  <TableHead className="text-right">Average Score (%)</TableHead>
                  <TableHead className="text-right">Evaluations Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((analyst, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{analyst.name}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={`
                        ${analyst.averageScore >= 80 ? 'bg-green-100 text-green-800' : 
                          analyst.averageScore >= 60 ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'}
                      `}>
                        {analyst.averageScore}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{analyst.evaluationCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-start mb-4">
        <Tabs value={visualizationType} onValueChange={(v) => setVisualizationType(v as any)}>
          <TabsList>
            <TabsTrigger value="parameters">
              <BarChart2 className="h-4 w-4 mr-1" />
              Parameters
            </TabsTrigger>
            <TabsTrigger value="pillars">
              <PieChart className="h-4 w-4 mr-1" />
              Pillars
            </TabsTrigger>
            <TabsTrigger value="analysts">
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                Analysts
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {renderCharts()}
    </div>
  );
};

const AudioAssignmentDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('today');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [analyticFilter, setAnalyticFilter] = useState('all');
  const [assignedToFilter, setAssignedToFilter] = useState('all'); // 'all', 'me', 'team'
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<AudioFileAllocation | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list');
  
  // Query to fetch quality analysts
  const { data: qualityAnalysts = [] } = useQuery({
    queryKey: ['/api/organizations/' + user?.organizationId + '/quality-analysts'],
    enabled: !!user?.organizationId,
  });
  
  // Query to fetch evaluation scores when viewing details
  const { data: evaluationDetails, isLoading: loadingEvaluationDetails } = useQuery({
    queryKey: [`/api/audio-files/${selectedAllocation?.audioFileId}/evaluation-scores`],
    enabled: !!selectedAllocation?.audioFileId && selectedAllocation.status === 'evaluated',
    onSuccess: (data) => {
      console.log("Evaluation Details:", data);
      if (data && selectedAllocation) {
        setSelectedAllocation({
          ...selectedAllocation,
          evaluation: data.evaluation,
          evaluationScore: data.evaluation.finalScore,
          parameterScores: data.parametersDetails.reduce((acc: Record<number, any>, param) => {
            const score = data.scores.find((s: any) => s.parameterId === param.parameter.id);
            if (score) {
              acc[param.parameter.id] = {
                score: score.score,
                parameterName: param.parameter.name,
                pillarName: param.pillar.name
              };
            }
            return acc;
          }, {})
        });
      }
    }
  });

  // Query for fetching allocations assigned to the current user or to their subordinates
  const { data: allocations = [], isLoading: loadingAllocations, refetch: refetchAllocations } = useQuery<AudioFileAllocation[]>({
    queryKey: ['/api/organizations/' + user?.organizationId + '/audio-file-allocations/assigned-to-me', user?.id, dateFilter, statusFilter, analyticFilter, assignedToFilter],
    enabled: !!user?.organizationId && !!user?.id,
    onSuccess: (data) => {
      console.log("Raw allocation data:", data);
      console.log("Status breakdown:", data.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>));
    }
  });

  // Filter allocations based on active tab and filters
  const getFilteredAllocations = () => {
    if (!allocations.length) return [];
    
    return allocations.filter((allocation: AudioFileAllocation) => {
      const allocationDate = parseISO(allocation.allocationDate);
      
      // Filter by tab selection (date period)
      if (activeTab === 'today' && !isSameDay(allocationDate, new Date())) {
        return false;
      } else if (activeTab === 'thisWeek' && !isThisWeek(allocationDate)) {
        return false;
      } else if (activeTab === 'thisMonth' && !isThisMonth(allocationDate)) {
        return false;
      }
      
      // Apply date range filter
      if (dateFilter === 'today' && !isSameDay(allocationDate, new Date())) {
        return false;
      } else if (dateFilter === 'thisWeek' && !isThisWeek(allocationDate)) {
        return false;
      } else if (dateFilter === 'thisMonth' && !isThisMonth(allocationDate)) {
        return false;
      } else if (dateFilter === 'lastMonth') {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        if (!isSameDay(allocationDate, lastMonth) && !isThisMonth(allocationDate)) {
          return false;
        }
      }
      
      // Apply status filter
      if (statusFilter !== 'all' && allocation.status !== statusFilter) {
        return false;
      }
      
      // Apply analyst filter
      if (analyticFilter !== 'all' && allocation.qualityAnalystId.toString() !== analyticFilter) {
        return false;
      }
      
      // Apply assigned to filter
      if (assignedToFilter === 'me' && !allocation.isCurrentUser) {
        return false;
      } else if (assignedToFilter === 'team' && allocation.isCurrentUser) {
        return false;
      }
      
      return true;
    });
  };

  const filteredAllocations = getFilteredAllocations();

  // Group allocations by date
  const groupedAllocations = filteredAllocations.reduce((groups: Record<string, AudioFileAllocation[]>, allocation: AudioFileAllocation) => {
    const date = new Date(allocation.allocationDate).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(allocation);
    return groups;
  }, {} as Record<string, AudioFileAllocation[]>);

  // Sort dates in descending order (newest first)
  const sortedDates = Object.keys(groupedAllocations).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  // Calculate overall statistics
  const totalAssignments = filteredAllocations.length;
  const statusCounts = filteredAllocations.reduce((counts: Record<string, number>, allocation) => {
    // Use the allocation status to increment the appropriate counter
    counts[allocation.status] = (counts[allocation.status] || 0) + 1;
    return counts;
  }, {
    'allocated': 0,
    'evaluated': 0,
    'archived': 0
  });

  // Toggle expanded date view
  const toggleDateExpansion = (date: string) => {
    if (expandedDate === date) {
      setExpandedDate(null);
    } else {
      setExpandedDate(date);
    }
  };

  // Generate status count UI for a specific date
  const generateStatusCountsForDate = (allocations: AudioFileAllocation[]) => {
    const statusCounts = allocations.reduce((counts: Record<string, number>, allocation) => {
      counts[allocation.status] = (counts[allocation.status] || 0) + 1;
      return counts;
    }, {
      'allocated': 0,
      'evaluated': 0,
      'archived': 0
    });

    return (
      <div className="flex space-x-2 mt-1">
        {Object.entries(statusCounts).map(([status, count]) => (
          <Badge key={status} className={getStatusColor(status)}>
            {status.charAt(0).toUpperCase() + status.slice(1)}: {count}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Audio Assignment Dashboard</h1>
        
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => refetchAllocations()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-1" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>
                  Filter audio assignments by various criteria
                </SheetDescription>
              </SheetHeader>
              
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="filter-assigned-to">Assigned To</Label>
                  <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by assignment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assignments</SelectItem>
                      <SelectItem value="me">My Assignments</SelectItem>
                      {user?.role !== 'quality_analyst' && (
                        <SelectItem value="team">My Team's Assignments</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-status">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="allocated">Allocated</SelectItem>
                      <SelectItem value="evaluated">Evaluated</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="filter-date">Date Range</Label>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="thisWeek">This Week</SelectItem>
                      <SelectItem value="thisMonth">This Month</SelectItem>
                      <SelectItem value="lastMonth">Last Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="filter-analyst">Quality Analyst</Label>
                  <Select value={analyticFilter} onValueChange={setAnalyticFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by quality analyst" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Analysts</SelectItem>
                      {qualityAnalysts && qualityAnalysts.map((analyst: any) => (
                        <SelectItem key={analyst.id} value={analyst.id.toString()}>
                          {analyst.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <SheetFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setStatusFilter('all');
                    setDateFilter('all');
                    setAnalyticFilter('all');
                    setAssignedToFilter('all');
                  }}
                >
                  Reset Filters
                </Button>
                <Button onClick={() => setFilterSheetOpen(false)}>Apply Filters</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
      {/* Tabs for date range selection */}
      <Tabs defaultValue="today" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="thisWeek">This Week</TabsTrigger>
          <TabsTrigger value="thisMonth">This Month</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Overall Statistics Summary */}
      {!loadingAllocations && filteredAllocations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <ClipboardList className="h-8 w-8 text-primary mb-2" />
              <p className="text-2xl font-bold">{totalAssignments}</p>
              <p className="text-sm text-muted-foreground">Total Assignments</p>
            </CardContent>
          </Card>
          
          <Card className={getStatusBgColor('allocated')}>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <Badge className={getStatusColor('allocated')}>Allocated</Badge>
              <p className="text-2xl font-bold mt-2">{statusCounts['allocated'] || 0}</p>
              <p className="text-sm text-muted-foreground">Allocated Assignments</p>
            </CardContent>
          </Card>
          
          <Card className={getStatusBgColor('evaluated')}>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <Badge className={getStatusColor('evaluated')}>Evaluated</Badge>
              <p className="text-2xl font-bold mt-2">{statusCounts['evaluated'] || 0}</p>
              <p className="text-sm text-muted-foreground">Evaluated Assignments</p>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* View Mode Toggle */}
      {!loadingAllocations && filteredAllocations.length > 0 && (
        <div className="flex justify-end mb-4">
          <div className="bg-muted inline-flex rounded-md p-1">
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => setViewMode('list')}
              className="flex items-center gap-1"
            >
              <FileAudio className="h-4 w-4" />
              List View
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'analytics' ? 'default' : 'ghost'}
              onClick={() => setViewMode('analytics')}
              className="flex items-center gap-1"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Button>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      {loadingAllocations ? (
        <div className="flex justify-center items-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : filteredAllocations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileAudio className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No audio assignments found</p>
            <p className="text-sm text-muted-foreground">
              {activeTab === 'today' ? 'No assignments for today.' : 
               activeTab === 'thisWeek' ? 'No assignments for this week.' :
               activeTab === 'thisMonth' ? 'No assignments for this month.' : 
               'No assignments available.'}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'analytics' ? (
        <div className="space-y-4">
          <ParameterScoreVisualization 
            evaluatedAssignments={filteredAllocations} 
            selectedAnalyst={analyticFilter} 
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Date-wise summary cards */}
          {sortedDates.map(date => (
            <Card key={date} className="mb-4">
              <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleDateExpansion(date)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{formatDate(date)}</CardTitle>
                      <div className="flex items-center">
                        <CardDescription className="mt-1">
                          {groupedAllocations[date].length} audio assignment{groupedAllocations[date].length > 1 ? 's' : ''}
                        </CardDescription>
                        {generateStatusCountsForDate(groupedAllocations[date])}
                      </div>
                    </div>
                  </div>
                  {expandedDate === date ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
              </CardHeader>
              
              {/* Expanded view with details */}
              {expandedDate === date && (
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Audio File</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Allocation Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedAllocations[date].map((allocation: AudioFileAllocation) => (
                        <TableRow 
                          key={allocation.id}
                          className={allocation.isCurrentUser === false ? "bg-blue-50" : ""}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">ID: {allocation.audioFileId}</p>
                              {allocation.audioFileName && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">{allocation.audioFileName}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{allocation.qualityAnalystName}</p>
                              {allocation.isCurrentUser === false && (
                                <Badge variant="outline" className="text-xs bg-blue-50 border-blue-300 text-blue-800">Team Member</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(allocation.status)}>
                              {allocation.status.charAt(0).toUpperCase() + allocation.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(allocation.allocationDate), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => {
                                  setSelectedAllocation(allocation);
                                  setViewDetailsOpen(true);
                                }}
                              >
                                <Info className="h-4 w-4 mr-1" />
                                View Details
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
      
      {/* Details Dialog */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Audio Assignment Details</DialogTitle>
            <DialogDescription>
              Complete information for the selected audio assignment
            </DialogDescription>
          </DialogHeader>
          
          {selectedAllocation && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div>
                  <h3 className="font-semibold">Audio File Information</h3>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="text-sm text-muted-foreground">Filename:</div>
                    <div className="text-sm font-medium">{selectedAllocation.audioFileName}</div>
                    
                    <div className="text-sm text-muted-foreground">ID:</div>
                    <div className="text-sm font-medium">{selectedAllocation.audioFileId}</div>
                    
                    <div className="text-sm text-muted-foreground">Status:</div>
                    <div className="text-sm font-medium">
                      <Badge className={getStatusColor(selectedAllocation.status)}>
                        {selectedAllocation.status.charAt(0).toUpperCase() + selectedAllocation.status.slice(1)}
                      </Badge>
                    </div>
                    
                    {selectedAllocation.status === 'evaluated' && selectedAllocation.evaluationScore !== undefined && (
                      <>
                        <div className="text-sm text-muted-foreground">Final Score:</div>
                        <div className="text-sm font-bold text-primary">
                          {selectedAllocation.evaluationScore}%
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold">Assignment Information</h3>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="text-sm text-muted-foreground">Assigned To:</div>
                    <div className="text-sm font-medium">{selectedAllocation.qualityAnalystName}</div>
                    
                    <div className="text-sm text-muted-foreground">Assigned By:</div>
                    <div className="text-sm font-medium">{selectedAllocation.allocatedByName}</div>
                    
                    <div className="text-sm text-muted-foreground">Allocation Date:</div>
                    <div className="text-sm font-medium">
                      {format(new Date(selectedAllocation.allocationDate), 'MMM dd, yyyy HH:mm')}
                    </div>
                    
                    {selectedAllocation.dueDate && (
                      <>
                        <div className="text-sm text-muted-foreground">Due Date:</div>
                        <div className="text-sm font-medium">
                          {format(new Date(selectedAllocation.dueDate), 'MMM dd, yyyy')}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Parameter-wise Scores Section */}
              {selectedAllocation.status === 'evaluated' && selectedAllocation.parameterScores && Object.keys(selectedAllocation.parameterScores).length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Parameter Scores</h3>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pillar</TableHead>
                          <TableHead>Parameter</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.values(selectedAllocation.parameterScores).map((param, index) => (
                          <TableRow key={index}>
                            <TableCell>{param.pillarName}</TableCell>
                            <TableCell>{param.parameterName}</TableCell>
                            <TableCell className="text-right">
                              <Badge className={
                                param.score >= 80 ? 'bg-green-100 text-green-800' :
                                param.score >= 60 ? 'bg-yellow-100 text-yellow-800' : 
                                'bg-red-100 text-red-800'
                              }>
                                {param.score}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {loadingEvaluationDetails && (
            <div className="flex justify-center py-4">
              <Spinner className="h-6 w-6" />
              <span className="ml-2 text-sm">Loading evaluation details...</span>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AudioAssignmentDashboard;