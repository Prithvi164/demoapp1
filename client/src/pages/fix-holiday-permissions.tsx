import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function FixHolidayPermissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [responseData, setResponseData] = useState<any>(null);
  
  // Mutation to fix holiday permissions
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/permissions/fix-holiday-permissions', 'POST');
    },
    onSuccess: (data) => {
      setResponseData(data);
      toast({
        title: "Success!",
        description: "Holiday permissions have been fixed for all roles.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fix permissions",
        variant: "destructive",
      });
    },
  });

  if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Permission Denied</CardTitle>
            <CardDescription>
              Only owners and admins can use this utility.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Fix Holiday Permissions Utility</CardTitle>
          <CardDescription>
            This utility will add the following permissions to all roles:
            <ul className="list-disc list-inside mt-2">
              <li>Admin and Manager roles: <code>manage_organization_settings</code>, <code>manage_holidaylist</code>, <code>view_organization</code></li>
              <li>Other roles: <code>manage_holidaylist</code>, <code>view_organization</code></li>
            </ul>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Click the button below to fix all holiday-related permissions for your organization.
            This will ensure that users with the appropriate roles can access the holiday list
            management features.
          </p>
          <Button 
            onClick={() => mutate()} 
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fixing Permissions...
              </>
            ) : (
              "Fix Holiday Permissions"
            )}
          </Button>
        </CardContent>
        
        {responseData && (
          <CardFooter className="flex flex-col items-start border-t p-4">
            <h3 className="font-semibold mb-2">Response:</h3>
            <pre className="bg-muted p-2 rounded text-xs overflow-auto w-full">
              {JSON.stringify(responseData, null, 2)}
            </pre>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}