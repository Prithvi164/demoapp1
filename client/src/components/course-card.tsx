import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import type { Course } from "@shared/schema";

interface CourseCardProps {
  course: Course;
  progress?: number;
}

export function CourseCard({ course, progress }: CourseCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="relative p-0">
        {course.imageUrl && (
          <div className="w-full h-48 relative rounded-t-lg overflow-hidden">
            <img 
              src={course.imageUrl} 
              alt={course.title}
              className="object-cover w-full h-full"
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg">{course.title}</h3>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {course.duration}m
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {course.description}
        </p>
        {progress !== undefined && (
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full" 
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}