import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Check, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { User, OrganizationLocation, OrganizationLineOfBusiness, OrganizationProcess } from "@shared/schema";
import { z } from "zod";
import { insertUserSchema, requiresLineOfBusiness } from "@shared/schema";

// Extended schema for the edit form
const editUserSchema = insertUserSchema.extend({
  // Handle string IDs for select fields
  locationId: z.union([z.literal("none"), z.string()]).optional()
    .transform(val => val === "none" ? null : val),
  managerId: z.union([z.literal("none"), z.string()]).optional()
    .transform(val => val === "none" ? null : val),
  // String fields with proper handling for empty values
  dateOfJoining: z.string().optional()
    .transform(val => val === "" ? null : val),
  dateOfBirth: z.string().optional()
    .transform(val => val === "" ? null : val),
  education: z.string().optional()
    .transform(val => val === "" ? null : val),
  // Required fields
  category: z.string().default("active"),
  // Process selection
  processes: z.array(z.number()).default([]),
  // Other fields with defaults
  fullName: z.string().optional(),
  phoneNumber: z.string().optional(),
  employeeId: z.string().optional(),
}).omit({ certified: true }).partial();

type UserFormData = z.infer<typeof editUserSchema>;

interface EditUserModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: number, data: any) => Promise<void>;
  locations: OrganizationLocation[];
  users: User[];
  lineOfBusinesses: OrganizationLineOfBusiness[];
  processes: OrganizationProcess[];
  userProcesses: Record<number, any[]>;
}

export function FixedEditUserModal({
  user,
  isOpen,
  onClose,
  onSave,
  locations,
  users,
  lineOfBusinesses,
  processes,
  userProcesses
}: EditUserModalProps) {
  const [selectedLOBs, setSelectedLOBs] = useState<number[]>([]);
  const [openLOB, setOpenLOB] = useState(false);
  const [openProcess, setOpenProcess] = useState(false);
  const [filteredProcesses, setFilteredProcesses] = useState<OrganizationProcess[]>([]);
  const [anyDropdownOpen, setAnyDropdownOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Safe string conversion to prevent null/undefined values
  const safeString = (value: any): string => {
    if (value === null || value === undefined) return "";
    return String(value);
  };
  
  // Create form with minimal defaults first
  const form = useForm<UserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      username: "",
      email: "",
      role: "advisor",
      processes: [],
      managerId: "none",
      locationId: "none",
      category: "active"
    }
  });
  
  // Once the modal is opened, initialize the form with the user data
  useEffect(() => {
    if (isOpen && user) {
      // First get the user processes to initialize the processes field correctly
      let processIds: number[] = [];
      
      if (userProcesses && Array.isArray(userProcesses[user.id])) {
        processIds = userProcesses[user.id]
          .map((p: any) => p.processId)
          .filter(Boolean);
          
        // Also set the selected LOBs based on these processes
        const lobIds = userProcesses[user.id]
          .map((p: any) => {
            const process = processes.find(proc => proc.id === p.processId);
            return process?.lineOfBusinessId;
          })
          .filter(Boolean);
          
        // Filter and set unique LOB IDs
        const validLobIds = lobIds.filter((id): id is number => typeof id === 'number');
        setSelectedLOBs(Array.from(new Set(validLobIds)));
      }
      
      console.log('Initializing form with processes:', processIds);
      
      // Now reset the form with all data including processes
      form.reset({
        username: safeString(user.username),
        fullName: safeString(user.fullName),
        email: safeString(user.email),
        employeeId: safeString(user.employeeId),
        role: user.role,
        phoneNumber: safeString(user.phoneNumber),
        locationId: user.locationId ? String(user.locationId) : "none",
        managerId: user.managerId ? String(user.managerId) : "none",
        dateOfJoining: safeString(user.dateOfJoining),
        dateOfBirth: safeString(user.dateOfBirth),
        education: safeString(user.education),
        category: user.category || "active",
        processes: processIds,
      });
    }
  }, [isOpen, user, userProcesses, processes]);
  
  // This function is now unused since we're initializing directly in useEffect
  const loadUserProcesses = () => {
    console.log('Note: This function is now unused since we initialize in useEffect');
  };
  
  // When selected LOBs change, filter processes for selection
  useEffect(() => {
    if (selectedLOBs.length > 0) {
      // Filter processes to only show those in the selected LOBs
      const filtered = processes.filter(p => selectedLOBs.includes(p.lineOfBusinessId));
      setFilteredProcesses(filtered);
      
      // Important: We DO NOT want to modify the selected processes here
      // Only filter what's visible, but keep the existing selections
      
      // This was incorrectly filtering out the user's existing process assignments:
      // const currentProcessIds = form.getValues("processes") || [];
      // const validProcessIds = currentProcessIds.filter(id => 
      //   filtered.some(p => p.id === id)
      // );
      // form.setValue("processes", validProcessIds);
      
      // Instead, we'll log what processes should be displayed
      const currentSelections = form.getValues("processes") || [];
      console.log('Current process selections:', currentSelections);
      console.log('Available processes in selected LOBs:', filtered.map(p => p.id));
      
      // Clear form validation error if LOB is now selected and was previously required
      if (requiresLineOfBusiness(form.watch('role'))) {
        form.clearErrors('root');
      }
    } else {
      setFilteredProcesses([]);
      // We should NOT clear process selections when no LOB is selected
      // The user might be in the middle of making their selections
    }
  }, [selectedLOBs, processes, form]);
  
  // Watch for role changes to enforce Line of Business requirements
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // Only react to role changes
      if (name === 'role') {
        const role = value.role as string;
        // If the new role requires LOB but none is selected, show validation error
        if (requiresLineOfBusiness(role) && selectedLOBs.length === 0) {
          form.setError("root", { 
            type: "manual", 
            message: "Line of Business is required for this role"
          });
        } else {
          form.clearErrors('root');
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, selectedLOBs]);
  
  // Monitor dropdown states
  useEffect(() => {
    const dropdownsOpen = openLOB || openProcess;
    setAnyDropdownOpen(dropdownsOpen);
  }, [openLOB, openProcess]);
  
  // Close modal if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only close the modal if:
      // 1. Click is outside the modal
      // 2. No dropdowns are open
      if (
        modalRef.current && 
        !modalRef.current.contains(event.target as Node) && 
        !anyDropdownOpen
      ) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anyDropdownOpen]);
  
  // Close on escape key
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !anyDropdownOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose, anyDropdownOpen]);

  if (!isOpen) return null;
  
  // Use portal to render the modal outside the DOM hierarchy
  return createPortal(
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        // Only close if click is on backdrop and no dropdowns are open
        if (!anyDropdownOpen && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Edit User</h2>
            <p className="text-sm text-muted-foreground">Update information for {user.username}</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(async (formData) => {
              try {
                // Safely cast form data
                const data = formData as any;
                
                // Check if Line of Business is required but not selected
                if (requiresLineOfBusiness(data.role) && selectedLOBs.length === 0) {
                  // Show validation error and prevent submission
                  form.setError("root", { 
                    type: "manual", 
                    message: "Line of Business is required for this role"
                  });
                  return; // Prevent form submission
                }
                
                // Clean data for submission
                const locationId = data.locationId === "none" ? null : 
                  typeof data.locationId === 'string' ? parseInt(data.locationId) : data.locationId;
                
                const managerId = data.managerId === "none" ? null : 
                  typeof data.managerId === 'string' ? parseInt(data.managerId) : data.managerId;
                
                const processesArray = Array.isArray(data.processes) ? data.processes : [];
                console.log('Form submission - processes data:', processesArray);
                
                const cleanedData = {
                  ...data,
                  locationId,
                  managerId,
                  processes: processesArray,
                };
                
                console.log('Final data being sent to server:', cleanedData);
                
                await onSave(user.id, cleanedData);
                onClose();
              } catch (error) {
                console.error('Error updating user:', error);
              }
            })} className="space-y-4">
              {/* Display form-level errors */}
              {form.formState.errors.root && (
                <div className="bg-destructive/15 border border-destructive text-destructive p-3 rounded-md mb-4">
                  {form.formState.errors.root.message}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                {/* Username */}
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Full Name */}
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          value={field.value || ''}
                          disabled={user.role === "owner"}
                          className={user.role === "owner" ? "bg-muted cursor-not-allowed" : ""}
                        />
                      </FormControl>
                      {user.role === "owner" && (
                        <p className="text-sm text-muted-foreground">
                          Email cannot be changed for owner accounts
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Phone Number */}
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Employee ID */}
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee ID</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Role */}
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        disabled={user.role === "owner"}
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        value={field.value}
                        onOpenChange={(open) => {
                          // Track the open state in our parent component
                          setAnyDropdownOpen(open);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger onClick={(e) => e.stopPropagation()}>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent onClick={(e) => e.stopPropagation()}>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="team_lead">Team Lead</SelectItem>
                          <SelectItem value="quality_analyst">Quality Analyst</SelectItem>
                          <SelectItem value="trainer">Trainer</SelectItem>
                          <SelectItem value="advisor">Advisor</SelectItem>
                          <SelectItem value="trainee">Trainee</SelectItem>
                        </SelectContent>
                      </Select>
                      {user.role === "owner" && (
                        <p className="text-sm text-muted-foreground">
                          Role cannot be changed for owner accounts
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Location */}
                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        value={field.value}
                        onOpenChange={(open) => {
                          // Track the open state in our parent component
                          setAnyDropdownOpen(open);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger onClick={(e) => e.stopPropagation()}>
                            <SelectValue placeholder="Select a location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent onClick={(e) => e.stopPropagation()}>
                          <SelectItem value="none">No Location</SelectItem>
                          {locations?.map((location) => (
                            <SelectItem key={location.id} value={location.id.toString()}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Manager */}
                <FormField
                  control={form.control}
                  name="managerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manager</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        value={field.value}
                        onOpenChange={(open) => {
                          setAnyDropdownOpen(open);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger onClick={(e) => e.stopPropagation()}>
                            <SelectValue placeholder="Select a manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]" onClick={(e) => e.stopPropagation()}>
                          <SelectItem value="none">No Manager</SelectItem>
                          {users
                            .filter(u => u.id !== user.id && u.active)
                            .map(manager => (
                              <SelectItem 
                                key={manager.id} 
                                value={manager.id.toString()}
                              >
                                {manager.fullName || manager.username} ({manager.role})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Date of Joining */}
                <FormField
                  control={form.control}
                  name="dateOfJoining"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Joining</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Date of Birth */}
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Education */}
                <FormField
                  control={form.control}
                  name="education"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Education</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Category */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        value={field.value}
                        onOpenChange={(open) => {
                          // Track the open state in our parent component
                          setAnyDropdownOpen(open);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger onClick={(e) => e.stopPropagation()}>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent onClick={(e) => e.stopPropagation()}>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="trainee">Trainee</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Process Selection */}
              <div className="space-y-2">
                <Label>Processes</Label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Line of Business Selection */}
                  <div>
                    <Label className="text-sm font-normal">
                      Line of Business
                      {requiresLineOfBusiness(form.watch('role')) && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                    <Popover 
                      open={openLOB} 
                      onOpenChange={(open) => {
                        setOpenLOB(open);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openLOB}
                          className={cn(
                            "w-full justify-between mt-1",
                            requiresLineOfBusiness(form.watch('role')) && selectedLOBs.length === 0 && "border-destructive"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {selectedLOBs.length > 0
                            ? `${selectedLOBs.length} selected`
                            : "Select line of business..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-96 p-0" onClick={(e) => e.stopPropagation()}>
                        <Command>
                          <CommandInput placeholder="Search line of business..." />
                          <CommandEmpty>No line of business found.</CommandEmpty>
                          <CommandGroup className="max-h-60 overflow-y-auto">
                            {lineOfBusinesses.map((lob) => (
                              <CommandItem
                                key={lob.id}
                                value={lob.name}
                                onSelect={() => {
                                  const isSelected = selectedLOBs.includes(lob.id);
                                  if (isSelected) {
                                    setSelectedLOBs(selectedLOBs.filter(id => id !== lob.id));
                                  } else {
                                    setSelectedLOBs([...selectedLOBs, lob.id]);
                                  }
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className={cn(
                                      "h-4 w-4 border rounded-sm flex items-center justify-center",
                                      selectedLOBs.includes(lob.id)
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "border-input"
                                    )}
                                  >
                                    {selectedLOBs.includes(lob.id) && <Check className="h-3 w-3" />}
                                  </div>
                                  {lob.name}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {requiresLineOfBusiness(form.watch('role')) && selectedLOBs.length === 0 && (
                      <p className="text-sm font-medium text-destructive mt-1">Line of Business is required for this role</p>
                    )}
                  </div>
                  
                  {/* Process Selection */}
                  <div>
                    <Label className="text-sm font-normal">Processes</Label>
                    <Popover 
                      open={openProcess} 
                      onOpenChange={(open) => {
                        setOpenProcess(open);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openProcess}
                          className="w-full justify-between mt-1"
                          disabled={selectedLOBs.length === 0}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {form.watch("processes")?.length
                            ? `${form.watch("processes")?.length} selected`
                            : "Select processes..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-96 p-0" onClick={(e) => e.stopPropagation()}>
                        <Command>
                          <CommandInput placeholder="Search processes..." />
                          <CommandEmpty>No processes found.</CommandEmpty>
                          <CommandGroup className="max-h-60 overflow-y-auto">
                            {filteredProcesses.map((process) => {
                              // Important: Use form.getValues() here to ensure we have the latest values
                              // This was causing processes to not show as selected in the UI
                              const currentProcesses = form.getValues("processes") || [];
                              const isSelected = currentProcesses.includes(process.id);
                              
                              console.log(`Process ${process.id} (${process.name}) selected:`, isSelected);
                              
                              return (
                                <CommandItem
                                  key={process.id}
                                  value={process.name}
                                  onSelect={() => {
                                    const currentProcesses = form.getValues("processes") || [];
                                    const isSelected = currentProcesses.includes(process.id);
                                    
                                    // Update the processes in the form
                                    if (isSelected) {
                                      const updatedProcesses = currentProcesses.filter(id => id !== process.id);
                                      form.setValue("processes", updatedProcesses, { shouldDirty: true });
                                      console.log('Process removed:', process.id, 'Updated processes list:', updatedProcesses);
                                    } else {
                                      const updatedProcesses = [...currentProcesses, process.id];
                                      form.setValue("processes", updatedProcesses, { shouldDirty: true });
                                      console.log('Process added:', process.id, 'Updated processes list:', updatedProcesses);
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={cn(
                                        "h-4 w-4 border rounded-sm flex items-center justify-center",
                                        isSelected
                                          ? "bg-primary border-primary text-primary-foreground"
                                          : "border-input"
                                      )}
                                    >
                                      {isSelected && <Check className="h-3 w-3" />}
                                    </div>
                                    {process.name}
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>,
    document.body
  );
}