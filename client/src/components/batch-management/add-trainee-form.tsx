import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Updated trainee data submission schema
const addTraineeSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  employeeId: z.string().min(1, "Employee ID is required"),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"),
  dateOfJoining: z.date({
    required_error: "Date of joining is required",
  }),
  dateOfBirth: z.date({
    required_error: "Date of birth is required",
  }),
  education: z.string().min(1, "Education details are required"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain uppercase, lowercase, and numbers"),
  role: z.enum(['manager', 'team_lead', 'quality_analyst', 'trainer', 'advisor']).default('advisor'),
});

// Batch interface that's flexible enough to handle different batch format types
interface BatchInterface {
  id: number;
  name: string;
  organizationId: number;
  processId: number | null;
  locationId: number | null;
  lineOfBusinessId: number | null;
  trainerId: number | null;
  capacityLimit?: number;
  enrolledCount?: number;
}

type BatchDetailsType = {
  trainer?: { fullName: string } | null;
  location?: { name: string } | null;
  lineOfBusiness?: { name: string } | null;
  process?: { name: string } | null;
  enrolledCount?: number;
  capacityLimit?: number;
};

type AddTraineeFormProps = {
  batch: BatchInterface;
  onSuccess: () => void;
};

export function AddTraineeForm({ batch, onSuccess }: AddTraineeFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // Fetch the batch details
  const { data: batchDetails = {} as BatchDetailsType } = useQuery({
    queryKey: [`/api/organizations/${batch.organizationId}/batches/${batch.id}`],
    enabled: !!batch.id,
  });

  // Get trainee count and capacity from either batch object or query result
  const traineeCount = batch.enrolledCount ?? batchDetails?.enrolledCount ?? 0;
  const capacityLimit = batch.capacityLimit ?? batchDetails?.capacityLimit ?? 0;
  const remainingCapacity = capacityLimit - traineeCount;

  const form = useForm<z.infer<typeof addTraineeSchema>>({
    resolver: zodResolver(addTraineeSchema),
    defaultValues: {
      role: 'advisor'
    }
  });

  const addTraineeMutation = useMutation({
    mutationFn: async (values: z.infer<typeof addTraineeSchema>) => {
      const traineeData = {
        ...values,
        dateOfJoining: values.dateOfJoining.toISOString().split('T')[0],
        dateOfBirth: values.dateOfBirth.toISOString().split('T')[0],
        processId: batch.processId,
        lineOfBusinessId: batch.lineOfBusinessId,
        locationId: batch.locationId,
        trainerId: batch.trainerId,
        organizationId: batch.organizationId,
        batchId: batch.id,
        category: "trainee", // This sets only the category
        role: values.role, // Keep the selected role unchanged
        managerId: batch.trainerId,
      };

      const response = await fetch(`/api/organizations/${batch.organizationId}/batches/${batch.id}/trainees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(traineeData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add trainee");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Trainee ${form.getValues("fullName")} has been successfully added to batch ${batch.name} with role ${form.getValues("role")}`,
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  async function onSubmit(values: z.infer<typeof addTraineeSchema>) {
    setIsSubmitting(true);
    await addTraineeMutation.mutateAsync(values);
    setIsSubmitting(false);
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx')) {
      toast({
        title: 'Error',
        description: 'Please upload an Excel file (.xlsx)',
        variant: 'destructive',
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('batchId', batch.id.toString());
    formData.append('organizationId', batch.organizationId.toString());

    try {
      setIsSubmitting(true);

      const response = await fetch(
        `/api/organizations/${batch.organizationId}/batches/${batch.id}/trainees/bulk`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to upload trainees');
      }

      // Show success toast with detailed information
      toast({
        title: 'Upload Complete',
        description: (
          <div className="space-y-2">
            <p>Successfully uploaded {data.successCount} of {data.totalRows} trainees.</p>
            {data.failureCount > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-destructive">
                  Failed uploads: {data.failureCount}
                </summary>
                <ul className="mt-2 list-disc list-inside">
                  {data.errors?.map((error: string, index: number) => (
                    <li key={index} className="text-xs text-destructive">{error}</li>
                  ))}
                </ul>
              </details>
            )}
            {data.remainingCapacity !== undefined && (
              <p className="text-sm">Remaining batch capacity: {data.remainingCapacity}</p>
            )}
          </div>
        ),
        duration: data.failureCount > 0 ? 10000 : 5000, // Show longer for errors
      });

      // Only close dialog and refresh if at least one trainee was added successfully
      if (data.successCount > 0) {
        onSuccess();
        setShowBulkUpload(false);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload trainees',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      // Clear the file input
      event.target.value = '';
    }
  };

  return (
    <div className="max-h-[70vh] overflow-y-auto px-4">
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          onClick={() => setShowBulkUpload(true)}
          disabled={remainingCapacity <= 0}
        >
          <Upload className="h-4 w-4 mr-2" />
          Bulk Upload
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Batch Info Section */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-4">
            <div>
              <FormLabel className="text-muted-foreground">Batch</FormLabel>
              <Input value={batch.name} disabled />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel className="text-muted-foreground">Trainer</FormLabel>
                <Input value={batchDetails?.trainer?.fullName || 'Loading...'} disabled />
              </div>
              <div>
                <FormLabel className="text-muted-foreground">Location</FormLabel>
                <Input value={batchDetails?.location?.name || 'Loading...'} disabled />
              </div>
              <div>
                <FormLabel className="text-muted-foreground">Line of Business</FormLabel>
                <Input value={batchDetails?.lineOfBusiness?.name || 'Loading...'} disabled />
              </div>
              <div>
                <FormLabel className="text-muted-foreground">Process</FormLabel>
                <Input value={batchDetails?.process?.name || 'Loading...'} disabled />
              </div>
            </div>
          </div>

          <FormField
            control={form.control}
            name="employeeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employee ID</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="dateOfJoining"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Joining</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Birth</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="education"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Education</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Role Selection */}
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="team_lead">Team Lead</SelectItem>
                    <SelectItem value="quality_analyst">Quality Analyst</SelectItem>
                    <SelectItem value="trainer">Trainer</SelectItem>
                    <SelectItem value="advisor">Advisor</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isSubmitting || remainingCapacity <= 0}
            className="w-full"
          >
            {isSubmitting ? "Adding Trainee..." :
              remainingCapacity <= 0 ? "Batch Full" : "Add Trainee"}
          </Button>
        </form>
      </Form>

      <Dialog open={showBulkUpload} onOpenChange={setShowBulkUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Upload Trainees</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload an Excel file (.xlsx) containing trainee information.
              Download the template below to ensure correct format.
            </p>
            <div className="flex flex-col gap-4">
              <Button variant="outline" asChild>
                <a href="/api/templates/trainee-upload" download="trainee-upload-template.xlsx">
                  Download Template
                </a>
              </Button>
              <Input
                type="file"
                accept=".xlsx"
                onChange={handleFileUpload}
                disabled={isSubmitting}
              />
              {isSubmitting && (
                <p className="text-sm text-muted-foreground">
                  Uploading trainees...
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}