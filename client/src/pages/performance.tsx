import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { UserProgress, Course } from "@shared/schema";

interface PerformanceData {
  courseId: number;
  courseName: string;
  score: number;
  completedModules: number;
  totalModules: number;
}

export default function Performance() {
  const {
    data: courses = [],
    isLoading: coursesLoading
  } = useQuery<Course[]>({
    queryKey: ["/api/courses"]
  });

  const {
    data: progress = [],
    isLoading: progressLoading
  } = useQuery<UserProgress[]>({
    queryKey: ["/api/progress"]
  });

  const loading = coursesLoading || progressLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Combine progress with course data
  const performanceData: PerformanceData[] = progress.map(userProgress => {
    const course = courses.find(c => c.id === userProgress.courseId);
    if (!course) return null;

    return {
      courseId: course.id,
      courseName: course.title,
      score: userProgress.score || 0,
      completedModules: userProgress.completed ? course.modules.length : 0,
      totalModules: course.modules.length
    };
  }).filter((item): item is PerformanceData => item !== null);

  const averageScore = performanceData.reduce(
    (acc, curr) => acc + curr.score,
    0
  ) / performanceData.length || 0;

  const completionRate = performanceData.reduce(
    (acc, curr) => acc + (curr.completedModules / curr.totalModules) * 100,
    0
  ) / performanceData.length || 0;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Performance Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">
              {averageScore.toFixed(1)}%
            </div>
            <Progress value={averageScore} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Course Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">
              {completionRate.toFixed(1)}%
            </div>
            <Progress value={completionRate} className="h-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="scores" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scores">Course Scores</TabsTrigger>
          <TabsTrigger value="progress">Module Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="scores" className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="courseName" 
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar 
                dataKey="score" 
                fill="hsl(var(--primary))"
                name="Score (%)" 
              />
            </BarChart>
          </ResponsiveContainer>
        </TabsContent>

        <TabsContent value="progress" className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="courseName"
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip />
              <Bar 
                dataKey="completedModules" 
                fill="hsl(var(--primary))"
                name="Completed Modules"
                radius={[4, 4, 0, 0]}
                barSize={30}
              />
              <Bar 
                dataKey="totalModules" 
                fill="hsl(var(--muted))"
                name="Total Modules"
                radius={[4, 4, 0, 0]}
                barSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        </TabsContent>
      </Tabs>
    </div>
  );
}