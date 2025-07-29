import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, isSunday, isWithinInterval, isSameDay } from "date-fns";
import { getAllSubordinates, getReportingChainUsers, isSubordinate } from "@/lib/hierarchy-utils";
import { calculatePhaseDates, calculateWorkingDays, Holiday, isNonWorkingDay } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2 } from "lucide-react";
import { insertOrganizationBatchSchema, type InsertOrganizationBatch, insertBatchTemplateSchema, type InsertBatchTemplate, type BatchTemplate, type OrganizationBatch, type OrganizationHoliday } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { TrainerInsights } from "./trainer-insights";


// Interface for date range
interface DateRange {
  start: Date;
  end: Date;
  label: string;
  status: 'induction' | 'training' | 'certification' | 'ojt' | 'ojt-certification';
}

// Define a comprehensive BatchInterface to handle all batch-related components
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
  status?: string;
  startDate?: string;
  endDate?: string;
  inductionStartDate?: string;
  inductionEndDate?: string;
  trainingStartDate?: string;
  trainingEndDate?: string;
  certificationStartDate?: string;
  certificationEndDate?: string;
  ojtStartDate?: string;
  ojtEndDate?: string;
  ojtCertificationStartDate?: string;
  ojtCertificationEndDate?: string;
  handoverToOpsDate?: string;
  // Actual dates
  actualInductionStartDate?: string | null;
  actualInductionEndDate?: string | null;
  actualTrainingStartDate?: string | null;
  actualTrainingEndDate?: string | null;
  actualCertificationStartDate?: string | null;
  actualCertificationEndDate?: string | null;
  actualOjtStartDate?: string | null;
  actualOjtEndDate?: string | null;
  actualOjtCertificationStartDate?: string | null;
  actualOjtCertificationEndDate?: string | null;
  actualHandoverToOpsDate?: string | null;
  // Additional fields
  batchCategory?: 'new_training' | 'upskill';
  weeklyOffDays?: string[];
  considerHolidays?: boolean | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Update CreateBatchFormProps interface
interface CreateBatchFormProps {
  editMode?: boolean;
  batchData?: OrganizationBatch | BatchInterface;
  onSuccess?: () => void;
}

// Function to determine batch status based on current date and phase dates
const determineBatchStatus = (batch: InsertOrganizationBatch): string => {
  const today = new Date();

  // Convert string dates to Date objects
  const dates = {
    inductionStart: new Date(batch.inductionStartDate),
    inductionEnd: batch.inductionEndDate ? new Date(batch.inductionEndDate) : null,
    trainingStart: batch.trainingStartDate ? new Date(batch.trainingStartDate) : null,
    trainingEnd: batch.trainingEndDate ? new Date(batch.trainingEndDate) : null,
    certificationStart: batch.certificationStartDate ? new Date(batch.certificationStartDate) : null,
    certificationEnd: batch.certificationEndDate ? new Date(batch.certificationEndDate) : null,
    ojtStart: batch.ojtStartDate ? new Date(batch.ojtStartDate) : null,
    ojtEnd: batch.ojtEndDate ? new Date(batch.ojtEndDate) : null,
    ojtCertificationStart: batch.ojtCertificationStartDate ? new Date(batch.ojtCertificationStartDate) : null,
    ojtCertificationEnd: batch.ojtCertificationEndDate ? new Date(batch.ojtCertificationEndDate) : null,
    handoverToOps: batch.handoverToOpsDate ? new Date(batch.handoverToOpsDate) : null
  };

  // Check which phase we're in based on current date
  if (today < dates.inductionStart) {
    return 'planned';
  } else if (dates.inductionEnd && isWithinInterval(today, { start: dates.inductionStart, end: dates.inductionEnd })) {
    return 'induction';
  } else if (dates.trainingEnd && isWithinInterval(today, { start: dates.trainingStart!, end: dates.trainingEnd })) {
    return 'training';
  } else if (dates.certificationEnd && isWithinInterval(today, { start: dates.certificationStart!, end: dates.certificationEnd })) {
    return 'certification';
  } else if (dates.ojtEnd && isWithinInterval(today, { start: dates.ojtStart!, end: dates.ojtEnd })) {
    return 'ojt';
  } else if (dates.ojtCertificationEnd && isWithinInterval(today, { start: dates.ojtCertificationStart!, end: dates.ojtCertificationEnd })) {
    return 'ojt_certification';
  } else if (dates.handoverToOps && today >= dates.handoverToOps) {
    return 'completed';
  }

  return 'planned'; // Default status
};

// Add this near the top where other fields are defined
const batchCategories = [
  { value: 'new_training', label: 'New Training' },
  { value: 'upskill', label: 'Upskill' }
] as const;

export function CreateBatchForm({ editMode = false, batchData, onSuccess }: CreateBatchFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedLob, setSelectedLob] = useState<number | null>(null);
  const [dateRanges, setDateRanges] = useState<DateRange[]>([]);
  const [progress, setProgress] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [holidaysList, setHolidaysList] = useState<Holiday[]>([]);

  const form = useForm<InsertOrganizationBatch>({
    resolver: zodResolver(insertOrganizationBatchSchema),
    defaultValues: editMode && batchData ? {
      ...batchData as any, // Cast to any to handle flexible batch properties
      startDate: batchData.startDate ? format(new Date(batchData.startDate), 'yyyy-MM-dd') : '',
      endDate: batchData.endDate ? format(new Date(batchData.endDate), 'yyyy-MM-dd') : '',
      inductionStartDate: batchData.inductionStartDate ? format(new Date(batchData.inductionStartDate), 'yyyy-MM-dd') : '',
      inductionEndDate: batchData.inductionEndDate ? format(new Date(batchData.inductionEndDate), 'yyyy-MM-dd') : '',
      trainingStartDate: batchData.trainingStartDate ? format(new Date(batchData.trainingStartDate), 'yyyy-MM-dd') : '',
      trainingEndDate: batchData.trainingEndDate ? format(new Date(batchData.trainingEndDate), 'yyyy-MM-dd') : '',
      certificationStartDate: batchData.certificationStartDate ? format(new Date(batchData.certificationStartDate), 'yyyy-MM-dd') : '',
      certificationEndDate: batchData.certificationEndDate ? format(new Date(batchData.certificationEndDate), 'yyyy-MM-dd') : '',
      ojtStartDate: batchData.ojtStartDate ? format(new Date(batchData.ojtStartDate), 'yyyy-MM-dd') : '',
      ojtEndDate: batchData.ojtEndDate ? format(new Date(batchData.ojtEndDate), 'yyyy-MM-dd') : '',
      ojtCertificationStartDate: batchData.ojtCertificationStartDate ? format(new Date(batchData.ojtCertificationStartDate), 'yyyy-MM-dd') : '',
      ojtCertificationEndDate: batchData.ojtCertificationEndDate ? format(new Date(batchData.ojtCertificationEndDate), 'yyyy-MM-dd') : '',
      handoverToOpsDate: batchData.handoverToOpsDate ? format(new Date(batchData.handoverToOpsDate), 'yyyy-MM-dd') : '',
      organizationId: user?.organizationId || undefined,
      locationId: batchData.locationId || undefined,
      lineOfBusinessId: batchData.lineOfBusinessId || undefined,
      processId: batchData.processId || undefined,
      trainerId: batchData.trainerId || undefined,
      capacityLimit: batchData.capacityLimit,
      batchCategory: (batchData.batchCategory as 'new_training' | 'upskill') || 'new_training',
      weeklyOffDays: batchData.weeklyOffDays || ['Saturday', 'Sunday'],
      considerHolidays: batchData.considerHolidays !== null ? batchData.considerHolidays : true,
      status: batchData.status as 'planned' | 'induction' | 'training' | 'certification' | 'ojt' | 'ojt_certification' | 'completed'
    } : {
      status: 'planned',
      organizationId: user?.organizationId || undefined,
      startDate: '',
      endDate: '',
      inductionStartDate: '',
      capacityLimit: 1,
      name: '',
      inductionEndDate: '',
      trainingStartDate: '',
      trainingEndDate: '',
      certificationStartDate: '',
      certificationEndDate: '',
      ojtStartDate: '',
      ojtEndDate: '',
      ojtCertificationStartDate: '',
      ojtCertificationEndDate: '',
      handoverToOpsDate: '',
      batchCategory: 'new_training',
      weeklyOffDays: ['Saturday', 'Sunday'],
      considerHolidays: true
    },
  });

  // Templates functionality has been removed

  const {
    data: locations = [],
    isLoading: isLoadingLocations
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/locations`],
    enabled: !!user?.organizationId
  });

  const {
    data: lobs = [],
    isLoading: isLoadingLobs
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/locations/${selectedLocation}/line-of-businesses`],
    enabled: !!selectedLocation && !!user?.organizationId
  });

  // Get all processes for the org
  const {
    data: allProcesses = [],
    isLoading: isLoadingAllProcesses
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/processes`],
    enabled: !!user?.organizationId
  });
  
  const {
    data: allUsers = [],
    isLoading: isLoadingAllUsers
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/users`],
    enabled: !!user?.organizationId
  });
  
  // Get trainer's processes
  const {
    data: trainerProcesses = [],
    isLoading: isLoadingTrainerProcesses
  } = useQuery({
    queryKey: [`/api/users/${form.getValues('trainerId')}/processes`],
    enabled: !!form.getValues('trainerId') && !!user?.organizationId,
  });
  
  // Filter processes to show only those assigned to the selected trainer
  const processes = useMemo(() => {
    const trainerId = form.getValues('trainerId');
    
    if (!trainerId) {
      return [];
    }
    
    // Get process details by joining trainer processes with all processes
    const trainerProcessIds = trainerProcesses.map(p => p.processId);
    console.log('Trainer process IDs:', trainerProcessIds);
    console.log('All processes:', allProcesses);
    
    const trainerProcessesWithDetails = allProcesses.filter(process => 
      trainerProcessIds.includes(process.id)
    );
    
    console.log('Trainer processes with details:', trainerProcessesWithDetails);
    return trainerProcessesWithDetails;
    
  }, [allProcesses, trainerProcesses, form.getValues('trainerId')]);

  // Get the selected trainer's location
  const selectedTrainerLocation = useMemo(() => {
    const trainerId = form.getValues('trainerId');
    if (!trainerId || !allUsers.length) return null;
    
    const trainer = allUsers.find(user => user.id === trainerId);
    if (trainer && trainer.locationId) {
      return locations.find(loc => loc.id === trainer.locationId) || null;
    }
    return null;
  }, [form.getValues('trainerId'), allUsers, locations]);

  // Get the selected process's line of business
  const selectedProcessLineOfBusiness = useMemo(() => {
    const processId = form.getValues('processId');
    if (!processId || !allProcesses.length) return null;
    
    const process = allProcesses.find(p => p.id === processId);
    if (process && process.lineOfBusinessId) {
      return lobs.find(lob => lob.id === process.lineOfBusinessId) || null;
    }
    return null;
  }, [form.getValues('processId'), allProcesses, lobs]);
  
  const isLoadingProcesses = isLoadingAllProcesses || isLoadingTrainerProcesses;
  
  // Compute trainers from the reporting hierarchy
  const trainers = useMemo(() => {
    if (!allUsers.length || !user) return [];
    
    // DEBUG: Log all users with their location info
    console.log('All users location info:', allUsers.map(u => ({
      id: u.id, 
      name: u.fullName, 
      role: u.role,
      locationId: u.locationId,
      managerId: u.managerId, // Add managerId for debugging
    })));
    
    // Handle special roles (admin and owner) - they can see all trainers
    if (user.role === 'owner' || user.role === 'admin') {
      // FIXED: Always show all trainers regardless of location when selecting a trainer
      return allUsers.filter(u => u.role === 'trainer');
    }
    
    // For other roles like managers, strictly ensure hierarchical relationships
    
    // Collect all users in the current user's reporting chain
    const strictSubordinates = getAllSubordinates(user.id, allUsers);
    
    console.log('STRICT HIERARCHY CHECK - Current user:', {
      id: user.id,
      name: user.fullName,
      role: user.role
    });
    
    // Extra validation step: double-check each trainer to ensure they are actual subordinates
    const validatedSubordinates = allUsers.filter(potentialTrainer => {
      if (potentialTrainer.role !== 'trainer') return false;
      
      // Verify this trainer is a subordinate by checking the reporting chain
      const isValidSubordinate = isSubordinate(user.id, potentialTrainer.id, allUsers);
      
      console.log(`Hierarchy validation for trainer ${potentialTrainer.fullName} (ID: ${potentialTrainer.id}):`, {
        isSubordinate: isValidSubordinate,
        managerId: potentialTrainer.managerId
      });
      
      return isValidSubordinate;
    });
    
    // Include the current user in the list if they are a trainer
    const eligibleUsers = user.role === 'trainer' ? [user] : [];
    
    // Add all validated subordinates with trainer role
    const trainersInHierarchy = [
      ...eligibleUsers,
      ...validatedSubordinates
    ];
    
    // Log trainer info for debugging
    console.log('STRICT HIERARCHY - Validated subordinates:', validatedSubordinates.map(u => ({ 
      id: u.id, 
      name: u.fullName, 
      role: u.role,
      locationId: u.locationId,
      managerId: u.managerId
    })));
    
    // FIXED: Always show all trainers in hierarchy regardless of location when selecting a trainer
    console.log('Final trainers list:', trainersInHierarchy
      .map(u => ({ id: u.id, name: u.fullName, location: u.locationId }))
    );
    
    return trainersInHierarchy;
  }, [allUsers, user]);
  
  const isLoadingTrainers = isLoadingAllUsers;

  // Template functionality has been removed

  // Update the date calculation functions with new logic for phase transitions
  const addWorkingDays = (startDate: Date, days: number, isEndDate: boolean = false): Date => {
    try {
      // For 0 days, return the start date as is
      if (days === 0) {
        console.log(`Zero days calculation for ${format(startDate, 'yyyy-MM-dd')}`);
        return startDate;
      }

      let currentDate = startDate;
      // For end date calculation when days > 0, subtract 1 from days
      let daysToAdd = isEndDate ? days - 1 : days;
      let remainingDays = daysToAdd;

      console.log(`Adding ${daysToAdd} working days to ${format(startDate, 'yyyy-MM-dd')}`);

      while (remainingDays > 0) {
        currentDate = addDays(currentDate, 1);
        // Skip Sundays when counting working days
        if (!isSunday(currentDate)) {
          remainingDays--;
        }
      }

      console.log(`Result date: ${format(currentDate, 'yyyy-MM-dd')}`);
      return currentDate;
    } catch (error) {
      console.error('Error in addWorkingDays:', error);
      throw error;
    }
  };

  const createBatchMutation = useMutation({
    mutationFn: async (values: InsertOrganizationBatch) => {
      if (!user?.organizationId) {
        throw new Error('Organization ID is required');
      }

      try {
        setIsCreating(true);
        const response = await fetch(`/api/organizations/${user.organizationId}/batches`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(values),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create batch');
        }

        return await response.json();
      } catch (error) {
        console.error('API Error:', error);
        throw error;
      } finally {
        setTimeout(() => {
          setIsCreating(false);
        }, 500);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/batches`] });
      toast({
        title: "Success",
        description: "Batch created successfully",
      });
      form.reset();
      setSelectedLocation(null);
      setSelectedLob(null);
      setDateRanges([]);
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      console.error('Error creating batch:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create batch. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateBatchMutation = useMutation({
    mutationFn: async (values: InsertOrganizationBatch) => {
      if (!user?.organizationId || !batchData?.id) {
        throw new Error('Organization ID and Batch ID are required for update');
      }

      try {
        setIsCreating(true);
        const response = await fetch(`/api/organizations/${user.organizationId}/batches/${batchData.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(values),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update batch');
        }

        return await response.json();
      } catch (error) {
        console.error('API Error:', error);
        throw error;
      } finally {
        setTimeout(() => {
          setIsCreating(false);
        }, 500);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/batches`] });
      toast({
        title: "Success",
        description: "Batch updated successfully",
      });
      form.reset();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      console.error('Error updating batch:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update batch. Please try again.",
        variant: "destructive",
      });
    }
  });


  async function onSubmit(values: InsertOrganizationBatch) {
    try {
      if (!values.name) throw new Error('Batch name is required');
      if (!values.startDate) throw new Error('Batch start date is required');
      if (values.locationId === undefined) throw new Error('Location is required');
      if (values.lineOfBusinessId === undefined) throw new Error('Line of Business is required');
      if (values.processId === undefined) throw new Error('Process is required');
      if (values.trainerId === undefined) throw new Error('Trainer is required');
      if (values.capacityLimit === undefined) throw new Error('Capacity limit is required');
      if (values.batchCategory === undefined) throw new Error('Batch Category is required');


      const currentStatus = determineBatchStatus(values);
      const formattedValues = {
        ...values,
        status: currentStatus as 'planned' | 'induction' | 'training' | 'certification' | 'ojt' | 'ojt_certification' | 'completed'
      };

      if (editMode) {
        await updateBatchMutation.mutateAsync(formattedValues);
      } else {
        await createBatchMutation.mutateAsync(formattedValues);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        title: "Validation Error",
        description: error instanceof Error ? error.message : "Please fill all required fields",
        variant: "destructive",
      });
    }
  }

  // Update the date ranges visualization
  const getDateRangeClassName = (date: Date): string => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const ranges = dateRanges.filter(r =>
      dateStr >= format(r.start, 'yyyy-MM-dd') &&
      dateStr <= format(r.end, 'yyyy-MM-dd')
    );

    if (ranges.length === 0) return '';

    // Multiple phases on same day - use gradient
    if (ranges.length > 1) {
      return cn(
        'bg-gradient-to-r',
        'from-blue-200 via-green-200 to-yellow-200',
        'border-2 border-dashed border-gray-400',
        'rounded-sm',
        'bg-opacity-50'
      );
    }

    const range = ranges[0];
    return cn(
      'bg-opacity-50',
      'rounded-sm',
      {
        'bg-blue-200': range.status === 'induction',
        'bg-green-200': range.status === 'training',
        'bg-yellow-200': range.status === 'certification',
        'bg-purple-200': range.status === 'ojt',
        'bg-pink-200': range.status === 'ojt-certification',
      },
      // Special styling for zero-day phases to make them more visible
      {
        'border-2 border-dashed border-gray-400': isSameDay(range.start, range.end)
      }
    );
  };

  // Initialize state based on batchData if in edit mode
  useEffect(() => {
    if (editMode && batchData) {
      setSelectedLocation(batchData.locationId);
      setSelectedLob(batchData.lineOfBusinessId);
    }
  }, [editMode, batchData]);
  
  // Auto-select location based on trainer selection
  useEffect(() => {
    const trainerId = form.getValues('trainerId');
    if (trainerId && allUsers.length) {
      const trainer = allUsers.find(user => user.id === trainerId);
      if (trainer && trainer.locationId) {
        console.log('Auto-selecting location based on trainer:', trainer.fullName, 'Location ID:', trainer.locationId);
        setSelectedLocation(trainer.locationId);
        form.setValue('locationId', trainer.locationId);
      }
    }
  }, [form.getValues('trainerId'), allUsers]);
  
  // Auto-select line of business based on process selection
  useEffect(() => {
    const processId = form.getValues('processId');
    if (processId && allProcesses.length) {
      const process = allProcesses.find(p => p.id === processId);
      if (process && process.lineOfBusinessId) {
        console.log('Auto-selecting line of business based on process:', process.name, 'LOB ID:', process.lineOfBusinessId);
        setSelectedLob(process.lineOfBusinessId);
        form.setValue('lineOfBusinessId', process.lineOfBusinessId);
      }
    }
  }, [form.getValues('processId'), allProcesses]);

  // Get organization holidays
  const { data: organizationHolidays = [] } = useQuery<Holiday[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/holidays`],
    enabled: !!user?.organizationId,
    onSuccess: (data) => {
      console.log('Holidays loaded:', JSON.stringify(data, null, 2));
      // Ensure holiday dates are converted from string to Date correctly
      if (data && data.length > 0) {
        // We set this to see if the data format matches what's expected by isNonWorkingDay
        setHolidaysList(data);
        
        // Check if there's a holiday on March 31st
        const march31st = new Date(2025, 2, 31); // Month is 0-indexed in JS
        const march31stStr = format(march31st, 'yyyy-MM-dd');
        console.log('Checking if March 31st is a holiday:', march31stStr);
        
        data.forEach(holiday => {
          const holidayDate = new Date(holiday.date);
          const holidayDateStr = format(holidayDate, 'yyyy-MM-dd');
          console.log(`Holiday: ${holiday.name}, Date: ${holidayDateStr}, isRecurring: ${holiday.isRecurring}`);
          
          if (holiday.isRecurring) {
            const sameMonth = holidayDate.getMonth() === march31st.getMonth();
            const sameDay = holidayDate.getDate() === march31st.getDate();
            console.log(`Comparing recurring: ${holiday.name}, Same month: ${sameMonth}, Same day: ${sameDay}`);
          } else {
            console.log(`Comparing non-recurring: ${holiday.name}, Matches March 31st: ${holidayDateStr === march31stStr}`);
          }
        });
      }
    },
    onError: (error) => {
      console.error('Error loading holidays:', error);
      toast({
        title: "Error",
        description: "Failed to load holiday information.",
        variant: "destructive",
      });
    }
  });

  // Update the useEffect for date calculations with proper error handling
  useEffect(() => {
    const process = processes.find(p => p.id === form.getValues('processId'));
    const startDateStr = form.getValues('startDate');
    const weeklyOffDays = form.getValues('weeklyOffDays') || ['Saturday', 'Sunday'];
    const considerHolidays = form.getValues('considerHolidays') !== undefined 
      ? form.getValues('considerHolidays') 
      : true;

    if (!process || !startDateStr) {
      console.log('No process or start date selected yet');
      return;
    }

    try {
      console.log('Starting date calculations with process:', {
        processId: process.id,
        startDate: startDateStr,
        weeklyOffDays,
        considerHolidays,
        phases: {
          induction: process.inductionDays,
          training: process.trainingDays,
          certification: process.certificationDays,
          ojt: process.ojtDays,
          ojtCertification: process.ojtCertificationDays
        }
      });

      const startDate = new Date(startDateStr);
      
      // Check specifically for March 31st, 2025 to debug holiday detection issue
      const march31st = new Date('2025-03-31');
      const isNonWorkingDayResult = isNonWorkingDay(march31st, weeklyOffDays, considerHolidays, holidaysList || []);
      console.log('March 31st 2025 isNonWorkingDay check:', isNonWorkingDayResult);
      
      // Check specifically for April 2nd, 2025 to debug weekly off day detection issue
      const april2nd = new Date('2025-04-02');
      const april2ndDayName = april2nd.toLocaleDateString('en-US', { weekday: 'long' });
      console.log(`April 2nd 2025 is a ${april2ndDayName}, weeklyOffDays=${JSON.stringify(weeklyOffDays)}`);
      const isApril2ndOffDay = isNonWorkingDay(april2nd, weeklyOffDays, considerHolidays, holidaysList || []);
      console.log('April 2nd 2025 isNonWorkingDay check:', isApril2ndOffDay);

      // Calculate all phase dates at once using the date-utils function
      console.log('Calculating phase dates with holidays:', { 
        startDate, 
        weeklyOffDays, 
        considerHolidays, 
        holidaysCount: holidaysList?.length || 0
      });
      
      // Log actual holiday data structure to debug format issues
      if (holidaysList && holidaysList.length > 0) {
        console.log('Holiday data sample:', holidaysList[0]);
        
        // Verify each holiday date format
        console.log('All holidays:');
        holidaysList.forEach((holiday, index) => {
          const holidayDate = new Date(holiday.date);
          console.log(`${index}: ${holiday.name}, ${holiday.date}, parsed as: ${format(holidayDate, 'yyyy-MM-dd')}, isRecurring: ${holiday.isRecurring}`);
        });
      }
      
      const phaseDates = calculatePhaseDates({
        startDate,
        phaseDurations: {
          induction: process.inductionDays,
          training: process.trainingDays,
          certification: process.certificationDays,
          ojt: process.ojtDays,
          ojtCertification: process.ojtCertificationDays
        },
        weeklyOffDays,
        considerHolidays,
        holidays: holidaysList || []
      });
      
      // Set all phase dates in the form
      form.setValue('inductionStartDate', format(phaseDates.inductionStart, 'yyyy-MM-dd'));
      form.setValue('inductionEndDate', format(phaseDates.inductionEnd, 'yyyy-MM-dd'));
      
      form.setValue('trainingStartDate', format(phaseDates.trainingStart, 'yyyy-MM-dd'));
      form.setValue('trainingEndDate', format(phaseDates.trainingEnd, 'yyyy-MM-dd'));
      
      form.setValue('certificationStartDate', format(phaseDates.certificationStart, 'yyyy-MM-dd'));
      form.setValue('certificationEndDate', format(phaseDates.certificationEnd, 'yyyy-MM-dd'));
      
      form.setValue('ojtStartDate', format(phaseDates.ojtStart, 'yyyy-MM-dd'));
      form.setValue('ojtEndDate', format(phaseDates.ojtEnd, 'yyyy-MM-dd'));
      
      form.setValue('ojtCertificationStartDate', format(phaseDates.ojtCertificationStart, 'yyyy-MM-dd'));
      form.setValue('ojtCertificationEndDate', format(phaseDates.ojtCertificationEnd, 'yyyy-MM-dd'));

      // Handover and Batch End Date
      form.setValue('handoverToOpsDate', format(phaseDates.handoverToOps, 'yyyy-MM-dd'));
      form.setValue('endDate', format(phaseDates.handoverToOps, 'yyyy-MM-dd'));

      // Log final calculated dates
      console.log('Final calculated dates:', {
        induction: { start: phaseDates.inductionStart, end: phaseDates.inductionEnd, days: process.inductionDays },
        training: { start: phaseDates.trainingStart, end: phaseDates.trainingEnd, days: process.trainingDays },
        certification: { start: phaseDates.certificationStart, end: phaseDates.certificationEnd, days: process.certificationDays },
        ojt: { start: phaseDates.ojtStart, end: phaseDates.ojtEnd, days: process.ojtDays },
        ojtCertification: { start: phaseDates.ojtCertificationStart, end: phaseDates.ojtCertificationEnd, days: process.ojtCertificationDays },
        handover: phaseDates.handoverToOps
      });

      // Update date ranges for calendar visualization
      setDateRanges([
        {
          start: phaseDates.inductionStart,
          end: phaseDates.inductionEnd,
          label: 'Induction',
          status: 'induction'
        },
        {
          start: phaseDates.trainingStart,
          end: phaseDates.trainingEnd,
          label: 'Training',
          status: 'training'
        },
        {
          start: phaseDates.certificationStart,
          end: phaseDates.certificationEnd,
          label: 'Certification',
          status: 'certification'
        },
        {
          start: phaseDates.ojtStart,
          end: phaseDates.ojtEnd,
          label: 'OJT',
          status: 'ojt'
        },
        {
          start: phaseDates.ojtCertificationStart,
          end: phaseDates.ojtCertificationEnd,
          label: 'OJT Certification',
          status: 'ojt-certification'
        }
      ]);

    } catch (error) {
      console.error('Error calculating dates:', error);
      toast({
        title: "Error",
        description: "Failed to calculate batch dates. Please try again.",
        variant: "destructive",
      });
    }
  }, [form.watch('startDate'), form.watch('processId'), form.watch('weeklyOffDays'), form.watch('considerHolidays'), processes, holidaysList]);

  useEffect(() => {
    if (isCreating) {
      const timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(timer);
            return 100;
          }
          return prev + 10;
        });
      }, 100);

      return () => clearInterval(timer);
    } else {
      setProgress(0);
    }
  }, [isCreating]);

  // Update the date range preview section with correct formatting
  const DateRangePreview = () => (
    <div className="mt-4">
      <h3 className="text-lg font-semibold mb-2">Date Range Preview</h3>
      <div className="space-y-2">
        {dateRanges.map((range, index) => {
          const process = processes.find(p => p.id === form.getValues('processId'));
          const isZeroDayPhase = process && (
            (range.status === 'induction' && process.inductionDays === 0) ||
            (range.status === 'training' && process.trainingDays === 0) ||
            (range.status === 'certification' && process.certificationDays === 0) ||
            (range.status === 'ojt' && process.ojtDays === 0) ||
            (range.status === 'ojt-certification' && process.ojtCertificationDays === 0)
          );

          return (
            <div
              key={index}
              className={cn(
                "p-3 rounded-lg",
                "border-2 border-dashed border-gray-400",
                getDateRangeClassName(range.start),
                "flex items-center justify-between"
              )}
            >
              <div className="flex items-center">
                <span className="font-medium">{range.label}</span>
                {isZeroDayPhase && (
                  <span className="ml-2 text-sm text-gray-500 italic">
                    (Zero-day phase)
                  </span>
                )}
              </div>
              <div className="text-sm">
                {format(range.start, 'MMM d, yyyy')}
                {' - '}
                {format(range.end, 'MMM d, yyyy')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-h-[calc(100vh-100px)] overflow-y-auto pr-4">
        {isCreating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Creating batch...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">

          <FormField
            control={form.control}
            name="batchCategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batch Category</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {batchCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="col-span-2 bg-muted/20 p-4 rounded-lg border border-border">
            <h3 className="text-lg font-medium mb-3">Working Days Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="weeklyOffDays"
                render={({ field }) => (
                  <FormItem className="bg-background rounded-md p-3">
                    <FormLabel className="text-base">Weekly Off Days</FormLabel>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                        <div key={day} className="flex items-center space-x-2">
                          <Checkbox
                            id={`day-${day}`}
                            checked={field.value.includes(day)}
                            className={field.value.includes(day) ? "bg-primary border-primary" : ""}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...field.value, day]);
                              } else {
                                field.onChange(field.value.filter((d: string) => d !== day));
                              }
                            }}
                          />
                          <label
                            htmlFor={`day-${day}`}
                            className={`text-sm font-medium cursor-pointer ${field.value.includes(day) ? "text-primary" : ""}`}
                          >
                            {day.substring(0, 3)}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormDescription className="mt-2">
                      Select the days that will be considered as weekly off days.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="considerHolidays"
                render={({ field }) => (
                  <FormItem className="bg-background flex flex-col h-full justify-between rounded-md p-3">
                    <div>
                      <FormLabel className="text-base">Consider Holidays</FormLabel>
                      <FormDescription className="mt-2">
                        When enabled, public holidays will be excluded from working days calculation.
                      </FormDescription>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-sm text-muted-foreground">{field.value ? "Enabled" : "Disabled"}</span>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="data-[state=checked]:bg-primary"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batch Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter batch name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="trainerId"
            render={({ field }) => {
              // Reset search term when component re-renders to ensure a fresh dropdown
              const [searchTerm, setSearchTerm] = useState("");
              
              // Reset the search term whenever the field value changes or when trainers list updates
              useEffect(() => {
                setSearchTerm("");
              }, [field.value, trainers]);
              
              const filteredTrainers = trainers.filter(trainer => 
                trainer.fullName.toLowerCase().includes(searchTerm.toLowerCase())
              );
              
              return (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <FormLabel>Trainer</FormLabel>
                    {field.value && <TrainerInsights trainerId={field.value} />}
                  </div>
                  <Select
                    onValueChange={(trainerId) => {
                      const id = parseInt(trainerId);
                      if (!isNaN(id)) {
                        field.onChange(id);
                        
                        // Reset the process selection to force the user to select a process from this trainer
                        form.setValue('processId', undefined);
                        
                        // Reset search term after selection
                        setSearchTerm("");
                        
                        // If there's only one process available for this trainer, auto-select it
                        setTimeout(() => {
                          const availableProcesses = processes;
                          if (availableProcesses.length === 1) {
                            console.log('Auto-selecting the only available process:', availableProcesses[0]);
                            form.setValue('processId', availableProcesses[0].id);
                          }
                        }, 100);
                      }
                    }}
                    value={field.value?.toString()}
                    disabled={isLoadingTrainers}
                    // Force dropdown to properly re-render by using a key that changes
                    key={`trainer-select-${field.value || 'initial'}`}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select trainer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent 
                      className="max-h-[300px]"
                      onEscapeKeyDown={(e) => {
                        // Prevent unwanted propagation
                        e.stopPropagation();
                      }}
                      onPointerDownOutside={(e) => {
                        // Only close if click is outside the dropdown completely
                        if (e.target && 
                            !(e.target as HTMLElement).closest('.search-area') && 
                            !(e.target as HTMLElement).closest('.trainer-items')) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <div className="px-2 py-2 sticky top-0 bg-background z-10 search-area">
                        <Input 
                          placeholder="Search trainers..." 
                          value={searchTerm}
                          onChange={(e) => {
                            try {
                              // Safely update search term
                              setSearchTerm(e.target.value);
                            } catch (error) {
                              console.error("Error updating search term:", error);
                            }
                          }}
                          onClick={(e) => {
                            // Prevent event propagation to avoid focus issues
                            e.stopPropagation();
                          }}
                          onKeyDown={(e) => {
                            // Prevent dropdown from closing on key events in search
                            e.stopPropagation();
                          }}
                          className="mb-1"
                        />
                      </div>
                      <div className="max-h-[250px] overflow-y-auto trainer-items">
                        {filteredTrainers.length > 0 ? (
                          filteredTrainers.map((trainer) => (
                            <SelectItem 
                              key={trainer.id} 
                              value={trainer.id.toString()}
                              className="trainer-item"
                            >
                              {trainer.fullName}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-4 text-center text-muted-foreground">
                            No trainers found
                          </div>
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="processId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Process</FormLabel>
                <Select
                  onValueChange={(value) => {
                    const processId = parseInt(value);
                    field.onChange(processId);
                    
                    // After process selection, we could auto-select location and LOB based on trainer's info
                    // This would need to be implemented based on your data structure
                  }}
                  value={field.value?.toString()}
                  disabled={!form.getValues('trainerId') || isLoadingProcesses}
                  // Force dropdown to properly re-render by using a key that changes
                  key={`process-select-${form.getValues('trainerId') || 'initial'}-${field.value || 'none'}`}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={form.getValues('trainerId') ? "Select process" : "Select Trainer first"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {processes.map((process) => (
                      <SelectItem key={process.id} value={process.id.toString()}>
                        {process.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="locationId"
            render={({ field }) => {
              // Find the selected location name
              const locationName = selectedTrainerLocation ? 
                selectedTrainerLocation.name : 
                locations.find(loc => loc.id === field.value)?.name || '';
              
              return (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  {selectedTrainerLocation ? (
                    // Show as read-only when auto-selected from trainer
                    <div className="flex items-center space-x-2">
                      <FormControl>
                        <Input 
                          value={locationName}
                          readOnly 
                          className="bg-muted cursor-not-allowed"
                        />
                      </FormControl>
                      <Badge variant="outline" className="bg-muted-foreground/20">
                        Auto-selected
                      </Badge>
                    </div>
                  ) : (
                    // Show as dropdown when not auto-selected
                    <Select
                      onValueChange={(value) => {
                        const locationId = parseInt(value);
                        field.onChange(locationId);
                        setSelectedLocation(locationId);
                        setSelectedLob(null);
                        
                        // We'd no longer reset Process and Trainer since they're selected first
                        form.setValue('lineOfBusinessId', undefined);
                      }}
                      value={field.value?.toString()}
                      disabled={isLoadingLocations || !form.getValues('processId')}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={form.getValues('processId') ? "Auto-selected location" : "Select Process first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id.toString()}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="lineOfBusinessId"
            render={({ field }) => {
              // Find the selected LOB's name if it exists
              const lobName = selectedProcessLineOfBusiness ? 
                selectedProcessLineOfBusiness.name : 
                lobs.find(lob => lob.id === field.value)?.name || '';
              
              return (
                <FormItem>
                  <FormLabel>Line of Business</FormLabel>
                  {selectedProcessLineOfBusiness ? (
                    // Show as read-only when auto-selected from process
                    <div className="flex items-center space-x-2">
                      <FormControl>
                        <Input 
                          value={lobName}
                          readOnly 
                          className="bg-muted cursor-not-allowed"
                        />
                      </FormControl>
                      <Badge variant="outline" className="bg-muted-foreground/20">
                        Auto-selected
                      </Badge>
                    </div>
                  ) : (
                    // Show as dropdown when not auto-selected
                    <Select
                      onValueChange={(value) => {
                        const lobId = parseInt(value);
                        field.onChange(lobId);
                        setSelectedLob(lobId);
                      }}
                      value={field.value?.toString()}
                      disabled={!selectedLocation || isLoadingLobs || !form.getValues('processId')}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={form.getValues('processId') ? "Auto-selected LOB" : "Select Process first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {lobs.map((lob) => (
                          <SelectItem key={lob.id} value={lob.id.toString()}>
                            {lob.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="capacityLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacity</FormLabel>
                <Input
                  type="number"
                  min={1}
                  {...field}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    field.onChange(isNaN(value) ? 1 : Math.max(1, value));
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />

        </div>

        <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Start Date</FormLabel>
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
                          format(new Date(field.value), "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) => {
                        field.onChange(date ? format(date, 'yyyy-MM-dd') : '');
                      }}
                      disabled={(date) => {
                        // Only check if the date is a non-working day (weekly off or holiday)
                        // We're now allowing past dates to be selected
                        return isNonWorkingDay(
                          date,
                          form.getValues('weeklyOffDays') || ['Saturday', 'Sunday'],
                          form.getValues('considerHolidays') !== undefined ? form.getValues('considerHolidays') : true,
                          holidaysList || [] // Use our state variable that's guaranteed to be an array
                        );
                      }}
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
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batch End Date</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={field.value ? format(new Date(field.value), "PPP") : ''}
                    disabled
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DateRangePreview />
        

        <div className="mt-8 flex justify-end"> {/* Adjusted to right-align the button */}
          <Button
            type="submit"
            disabled={
              createBatchMutation.isPending ||
              updateBatchMutation.isPending ||
              isCreating ||
              isLoadingLocations ||
              isLoadingLobs ||
              isLoadingProcesses ||
              isLoadingTrainers
            }
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {editMode ? "Updating..." : "Creating..."}
              </>
            ) : (
              editMode ? "Update Batch" : "Create Batch"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}