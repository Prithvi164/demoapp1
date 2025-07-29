# Batch History User Tracking Fixes

## Problem
Currently, the history table for batch phase changes always shows "Perumalla Praveen" (admin user) instead of showing the actual user who triggered the batch phase change.

## Solution
We need to update the `addBatchHistoryRecord` function to accept a userId parameter and update all places where batch phase changes are recorded to pass the actual user ID.

## Changes

### 1. Modified `addBatchHistoryRecord` in server/services/batch-status-service.ts:
```typescript
export const addBatchHistoryRecord = async (
  batchId: number, 
  eventType: 'phase_change' | 'status_update' | 'milestone' | 'note',
  description: string,
  previousValue: string | null,
  newValue: string | null,
  organizationId: number,
  userId?: number // Added this parameter
) => {
  try {
    let finalUserId = userId;
    
    // If no userId provided, find an appropriate user from the organization
    if (!finalUserId) {
      // First find an admin user for this organization
      const adminUser = await db.query.users.findFirst({
        where: and(
          eq(users.organizationId, organizationId),
          eq(users.role, 'admin')
        )
      });
      
      // If no admin user found, try to find any user
      if (adminUser) {
        finalUserId = adminUser.id;
      } else {
        const anyUser = await db.query.users.findFirst({
          where: eq(users.organizationId, organizationId)
        });
        finalUserId = anyUser?.id;
      }
    }
    
    // Only proceed if we found a valid user
    if (finalUserId) {
      await db.insert(batchHistory).values({
        batchId,
        eventType,
        description,
        previousValue: previousValue || undefined,
        newValue: newValue || undefined,
        date: new Date(),
        userId: finalUserId,
        organizationId
      });
    } else {
      console.log('Skipping batch history record - no valid user found for organization', organizationId);
    }
  } catch (error) {
    console.error('Error adding batch history record:', error);
  }
};
```

### 2. Updated each location where batch phase changes are recorded:

#### 2.1 Phase change request approval (line 3749):
```typescript
// If approved, update the batch phase
if (status === 'approved') {
  // First record the batch history for phase change
  await addBatchHistoryRecord(
    request.batchId,
    'phase_change',
    `Batch phase changed from ${request.currentPhase} to ${request.requestedPhase} (via phase change request)`,
    request.currentPhase,
    request.requestedPhase,
    request.organizationId,
    req.user.id // Pass the actual user ID who approved the request
  );
  
  // Then update the batch status
  await storage.updateBatch(request.batchId, {
    status: request.requestedPhase,
  });
}
```

#### 2.2 Manual batch start (line 2313):
```typescript
// Record batch history first with the actual user who started the batch
await addBatchHistoryRecord(
  batchId,
  'phase_change',
  `Batch phase changed from planned to induction (batch started)`,
  'planned',
  'induction',
  batch.organizationId,
  req.user.id // Pass the actual user ID who started the batch
);
```

#### 2.3 Auto phase changes from cron job in updateBatchStatuses function (line 266):
The auto phase changes happen in the batch-status-service.ts updateBatchStatuses function. Since these are automatic transitions, we can leave these to continue using admin users.

## Specific Lines to Update in server/routes.ts:

1. Line ~2313 (batch start) - Need to add req.user.id
2. Line ~3749 (phase change request approval) - We already added req.user.id
3. Lines ~6142, ~6517, ~6892 (other batch start locations) - Need to add req.user.id