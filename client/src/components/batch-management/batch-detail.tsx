import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProcessDetail } from "./process-detail";
import { LocationDetail } from "./location-detail";
import { LobDetail } from "./lob-detail";
import { BatchesTab } from "./batches-tab";
import { CreateBatchForm } from "./create-batch-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BatchDetailProps {
  onCreateBatch?: () => void;
}

export function BatchDetail({ onCreateBatch }: BatchDetailProps) {
  // Always default to "batches" tab when component mounts
  const [activeTab, setActiveTab] = useState("batches");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Save the active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("batchManagementActiveTab", activeTab);
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Batch Management Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="batches">Batches</TabsTrigger>
              <TabsTrigger value="lob">Line of Business</TabsTrigger>
              <TabsTrigger value="process">Process</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
            </TabsList>
            <TabsContent value="batches" className="mt-6">
              <BatchesTab onCreate={() => {
                setIsCreateDialogOpen(true);
                onCreateBatch?.();
              }} />
            </TabsContent>
            <TabsContent value="lob" className="mt-6">
              <LobDetail />
            </TabsContent>
            <TabsContent value="process" className="mt-6">
              <ProcessDetail />
            </TabsContent>
            <TabsContent value="location" className="mt-6">
              <LocationDetail />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
          </DialogHeader>
          <CreateBatchForm onSuccess={() => setIsCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}