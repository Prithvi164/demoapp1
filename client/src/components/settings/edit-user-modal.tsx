import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { User, OrganizationLocation, OrganizationLineOfBusiness, OrganizationProcess } from "@shared/schema";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";

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
  processes: z.array(z.number()).optional().default([]),
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

export function EditUserModal({
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
  const [anySelectOpen, setAnySelectOpen] = useState(false);
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
    }
  });
  
  // Once the modal is opened, initialize the form with the user data
  useEffect(() => {
    if (isOpen && user) {
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
        processes: [],
      });
      
      // Load user processes
      loadUserProcesses();
    }
  }, [isOpen, user]);
  
  // Load user processes and associated LOBs
  const loadUserProcesses = () => {
    try {
      if (!userProcesses) return;
      
      // Get user processes safely
      const userProcessList = userProcesses[user.id] || [];
      if (!Array.isArray(userProcessList)) return;
      
      // Extract process IDs
      const processIds = userProcessList
        .map((p: any) => p.processId)
        .filter(Boolean);
      
      // Set processes in form
      form.setValue("processes", processIds);
      
      // Extract LOBs from the processes
      const lobIds = userProcessList
        .map((p: any) => {
          const process = processes.find(proc => proc.id === p.processId);
          return process?.lineOfBusinessId;
        })
        .filter(Boolean);
      
      // Filter and convert to number array
      const validLobIds = lobIds.filter((id): id is number => typeof id === 'number');
      setSelectedLOBs(Array.from(new Set(validLobIds)));
      
      console.log('Loaded processes:', processIds);
      console.log('Loaded LOBs:', Array.from(new Set(validLobIds)));
    } catch (error) {
      console.error('Error loading user processes:', error);
    }
  };
  
  // When selected LOBs change, filter processes for selection
  useEffect(() => {
    if (selectedLOBs.length > 0) {
      const filtered = processes.filter(p => selectedLOBs.includes(p.lineOfBusinessId));
      setFilteredProcesses(filtered);
    } else {
      setFilteredProcesses([]);
    }
  }, [selectedLOBs, processes]);
  
  // Close modal if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        // Only close if no select dropdown is open
        if (!anySelectOpen && !openLOB && !openProcess) {
          onClose();
        }
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anySelectOpen, openLOB, openProcess]);
  
  // Close on escape key
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  
  // Use portal to render the modal outside the DOM hierarchy
  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
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
            onClick={onClose}
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
                
                // Clean data for submission
                const locationId = data.locationId === "none" ? null : 
                  typeof data.locationId === 'string' ? parseInt(data.locationId) : data.locationId;
                
                const managerId = data.managerId === "none" ? null : 
                  typeof data.managerId === 'string' ? parseInt(data.managerId) : data.managerId;
                
                const cleanedData = {
                  ...data,
                  locationId,
                  managerId,
                  processes: Array.isArray(data.processes) ? data.processes : [],
                };
                
                await onSave(user.id, cleanedData);
                onClose();
              } catch (error) {
                console.error('Error updating user:', error);
              }
            })} className="space-y-4">
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
                          // Stop any potential events from bubbling and closing the modal
                          setTimeout(() => {
                            field.onChange(value);
                          }, 0);
                        }}
                        value={field.value}
                        onOpenChange={(open) => {
                          setAnySelectOpen(open);
                          if (open) {
                            // When opening, prevent event from propagating up to modal
                            const content = document.querySelector('[role="dialog"]');
                            if (content) {
                              content.addEventListener('click', (e) => e.stopPropagation(), { once: true });
                            }
                          }
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
                          // Stop any potential events from bubbling and closing the modal
                          setTimeout(() => {
                            field.onChange(value);
                          }, 0);
                        }}
                        value={field.value}
                        onOpenChange={(open) => {
                          setAnySelectOpen(open);
                          if (open) {
                            // When opening, prevent event from propagating up to modal
                            const content = document.querySelector('[role="dialog"]');
                            if (content) {
                              content.addEventListener('click', (e) => e.stopPropagation(), { once: true });
                            }
                          }
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
                          // Stop any potential events from bubbling and closing the modal
                          setTimeout(() => {
                            field.onChange(value);
                          }, 0);
                        }}
                        value={field.value}
                        onOpenChange={(open) => {
                          setAnySelectOpen(open);
                          if (open) {
                            // When opening, prevent event from propagating up to modal
                            const content = document.querySelector('[role="dialog"]');
                            if (content) {
                              content.addEventListener('click', (e) => e.stopPropagation(), { once: true });
                            }
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger onClick={(e) => e.stopPropagation()}>
                            <SelectValue placeholder="Select a manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent onClick={(e) => e.stopPropagation()}>
                          <SelectItem value="none">No Manager</SelectItem>
                          {users
                            .filter(u => u.id !== user.id && u.active) // Can't self-assign
                            .map(manager => (
                              <SelectItem key={manager.id} value={manager.id.toString()}>
                                {manager.fullName || manager.username}
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
                          // Stop any potential events from bubbling and closing the modal
                          setTimeout(() => {
                            field.onChange(value);
                          }, 0);
                        }}
                        value={field.value}
                        onOpenChange={(open) => {
                          if (open) {
                            // When opening, prevent event from propagating up to modal
                            const content = document.querySelector('[role="dialog"]');
                            if (content) {
                              content.addEventListener('click', (e) => e.stopPropagation(), { once: true });
                            }
                          }
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
                    <Label className="text-sm font-normal">Line of Business</Label>
                    <Popover open={openLOB} onOpenChange={setOpenLOB}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openLOB}
                          className="w-full justify-between mt-1"
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
                  </div>
                  
                  {/* Process Selection */}
                  <div>
                    <Label className="text-sm font-normal">Processes</Label>
                    <Popover open={openProcess} onOpenChange={setOpenProcess}>
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
                              const currentProcesses = form.getValues("processes") || [];
                              return (
                                <CommandItem
                                  key={process.id}
                                  value={process.name}
                                  onSelect={() => {
                                    const isSelected = currentProcesses.includes(process.id);
                                    if (isSelected) {
                                      form.setValue(
                                        "processes",
                                        currentProcesses.filter(id => id !== process.id)
                                      );
                                    } else {
                                      form.setValue(
                                        "processes",
                                        [...currentProcesses, process.id]
                                      );
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={cn(
                                        "h-4 w-4 border rounded-sm flex items-center justify-center",
                                        currentProcesses.includes(process.id)
                                          ? "bg-primary border-primary text-primary-foreground"
                                          : "border-input"
                                      )}
                                    >
                                      {currentProcesses.includes(process.id) && <Check className="h-3 w-3" />}
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