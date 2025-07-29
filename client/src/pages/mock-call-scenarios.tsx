import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { InsertMockCallScenario } from "@shared/schema";

const formSchema = z.object({
  processId: z.number().min(1, "Process is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  difficulty: z.enum(["basic", "intermediate", "advanced"]),
  customerProfile: z.object({
    name: z.string().min(1, "Customer name is required"),
    background: z.string().min(1, "Background information is required"),
    personality: z.string().min(1, "Personality traits are required"),
    concerns: z.array(z.string()).min(1, "At least one concern is required"),
  }),
  expectedDialogue: z.object({
    greeting: z.string().min(1, "Greeting script is required"),
    keyPoints: z.array(z.string()).min(1, "At least one key point is required"),
    resolutions: z.array(z.string()).min(1, "At least one resolution is required"),
    closingStatements: z.array(z.string()).min(1, "At least one closing statement is required"),
  }),
  evaluationRubric: z.object({
    greetingScore: z.number().min(0).max(100),
    problemIdentificationScore: z.number().min(0).max(100),
    solutionScore: z.number().min(0).max(100),
    communicationScore: z.number().min(0).max(100),
    closingScore: z.number().min(0).max(100),
  }),
});

export default function MockCallScenariosPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState<any>(null);
  const [isCallActive, setIsCallActive] = useState(false);

  // Fetch available processes
  const { data: processes = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/processes`],
    enabled: !!user?.organizationId,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      processId: processes[0]?.id || 0,
      difficulty: "basic",
      customerProfile: {
        name: "",
        background: "",
        personality: "",
        concerns: [],
      },
      expectedDialogue: {
        greeting: "",
        keyPoints: [],
        resolutions: [],
        closingStatements: [],
      },
      evaluationRubric: {
        greetingScore: 20,
        problemIdentificationScore: 20,
        solutionScore: 20,
        communicationScore: 20,
        closingScore: 20,
      },
    },
  });

  const { data: scenarios = [], isLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/mock-call-scenarios`],
    enabled: !!user?.organizationId,
  });

  const createScenarioMutation = useMutation({
    mutationFn: async (data: InsertMockCallScenario) => {
      console.log("Submitting data:", data);
      const response = await fetch("/api/mock-call-scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create scenario");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/organizations/${user?.organizationId}/mock-call-scenarios`],
      });
      toast({
        title: "Success",
        description: "Mock call scenario created successfully",
      });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      console.error("Error creating scenario:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const startCallMutation = useMutation({
    mutationFn: async (scenarioId: number) => {
      try {
        const response = await fetch(`/api/mock-call-scenarios/${scenarioId}/attempts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarioId,
            evaluatorId: user?.id,
            organizationId: user?.organizationId,
            startedAt: new Date().toISOString(),
            status: 'pending'
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to start mock call");
        }
        return response.json();
      } catch (error: any) {
        console.error("Error in startCallMutation:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Mock Call Started",
        description: "Your mock call session has begun. Good luck!",
      });
      setIsCallActive(true);
    },
    onError: (error: Error) => {
      console.error("Error starting mock call:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleStartCall = (scenario: any) => {
    setActiveScenario(scenario);
    startCallMutation.mutate(scenario.id);
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!user?.organizationId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Organization ID is required",
      });
      return;
    }

    console.log("Form values:", values);
    createScenarioMutation.mutate({
      ...values,
      organizationId: user.organizationId,
      createdBy: user.id,
    });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "basic":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "intermediate":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "advanced":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      default:
        return "";
    }
  };

  // Add timer state
  const [callDuration, setCallDuration] = useState(0);

  // Timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCallActive) {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isCallActive]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ... (keep existing mutations and handlers)

  const handleEndCall = () => {
    setIsCallActive(false);
    setCallDuration(0);
    // Add any cleanup or submission logic here
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Mock Call Scenarios</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create New Scenario</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Create New Mock Call Scenario</DialogTitle>
              <DialogDescription>
                Define a new scenario for call center training and certification.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="processId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Process</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          defaultValue={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select process" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {processes.map((process: any) => (
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
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter scenario title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Describe the scenario"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="difficulty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulty Level</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select difficulty" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="intermediate">
                              Intermediate
                            </SelectItem>
                            <SelectItem value="advanced">Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Customer Profile Fields */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Customer Profile</h3>
                    <FormField
                      control={form.control}
                      name="customerProfile.name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter customer name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customerProfile.background"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Background Information</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Enter customer background"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customerProfile.personality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Personality Traits</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter personality traits" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customerProfile.concerns"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Concerns</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter concerns (comma-separated)"
                              onChange={(e) =>
                                field.onChange(e.target.value.split(",").map((s) => s.trim()))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Expected Dialogue Fields */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Expected Dialogue</h3>
                    <FormField
                      control={form.control}
                      name="expectedDialogue.greeting"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Greeting Script</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Enter expected greeting"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="expectedDialogue.keyPoints"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Key Points</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter key points (comma-separated)"
                              onChange={(e) =>
                                field.onChange(e.target.value.split(",").map((s) => s.trim()))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="expectedDialogue.resolutions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expected Resolutions</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter resolutions (comma-separated)"
                              onChange={(e) =>
                                field.onChange(e.target.value.split(",").map((s) => s.trim()))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="expectedDialogue.closingStatements"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Closing Statements</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter closing statements (comma-separated)"
                              onChange={(e) =>
                                field.onChange(e.target.value.split(",").map((s) => s.trim()))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Evaluation Rubric Fields */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Evaluation Rubric</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="evaluationRubric.greetingScore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Greeting Score (max 100)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value))
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="evaluationRubric.problemIdentificationScore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Problem ID Score (max 100)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value))
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="evaluationRubric.solutionScore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Solution Score (max 100)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value))
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="evaluationRubric.communicationScore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Communication Score (max 100)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value))
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="evaluationRubric.closingScore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Closing Score (max 100)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value))
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </form>
              </Form>
            </div>
            <div className="flex justify-end pt-4 border-t mt-4">
              <Button
                type="submit"
                onClick={form.handleSubmit(onSubmit)}
                disabled={createScenarioMutation.isPending}
              >
                {createScenarioMutation.isPending ? "Creating..." : "Create Scenario"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <p>Loading scenarios...</p>
        ) : scenarios.length === 0 ? (
          <p>No scenarios available. Create your first scenario to get started.</p>
        ) : (
          scenarios.map((scenario: any) => (
            <Card key={scenario.id}>
              <CardHeader>
                <CardTitle>{scenario.title}</CardTitle>
                <CardDescription>{scenario.description}</CardDescription>
                <Badge
                  className={`${getDifficultyColor(
                    scenario.difficulty
                  )} capitalize mt-2`}
                >
                  {scenario.difficulty}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <strong>Customer Profile:</strong>
                    <p className="text-sm text-muted-foreground">
                      {scenario.customerProfile.name}
                    </p>
                  </div>
                  <div>
                    <strong>Key Points:</strong>
                    <ul className="list-disc list-inside text-sm text-muted-foreground">
                      {scenario.expectedDialogue.keyPoints.map(
                        (point: string, index: number) => (
                          <li key={index}>{point}</li>
                        )
                      )}
                    </ul>
                  </div>
                  <Button
                    className="w-full mt-4"
                    onClick={() => handleStartCall(scenario)}
                    disabled={isCallActive || startCallMutation.isPending}
                  >
                    {startCallMutation.isPending && scenario.id === activeScenario?.id
                      ? "Starting..."
                      : "Start Mock Call"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {isCallActive && activeScenario && (
        <Dialog open={isCallActive} onOpenChange={handleEndCall}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex justify-between items-center">
                <span>Mock Call Session</span>
                <Badge variant="outline">{formatTime(callDuration)}</Badge>
              </DialogTitle>
              <DialogDescription>
                Customer Profile: {activeScenario.customerProfile.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-medium mb-2">Call Guidelines</h3>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li>Maintain a professional and friendly tone</li>
                  <li>Listen actively to customer concerns</li>
                  <li>Follow the script guidelines</li>
                  <li>Take notes during the call</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium mb-2">Scenario Background</h3>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                  {activeScenario.customerProfile.background}
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">Expected Key Points</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {activeScenario.expectedDialogue.keyPoints.map(
                    (point: string, index: number) => (
                      <li key={index}>{point}</li>
                    )
                  )}
                </ul>
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleEndCall}
                  >
                    End Call
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleEndCall}
                  >
                    End & Submit
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}