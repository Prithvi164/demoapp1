import { db } from '../db';
import { organizationBatches, batchStatusEnum, batchHistory, users, userBatchProcesses } from '@shared/schema';
import { eq, and, or, lt, isNull, not, sql } from 'drizzle-orm';
import { startOfDay } from 'date-fns';

// Function to get the next phase based on current phase
const getNextPhase = (currentPhase: string): typeof batchStatusEnum.enumValues[number] | null => {
  const phases: Array<typeof batchStatusEnum.enumValues[number]> = [
    'planned',
    'induction',
    'training',
    'certification',
    'ojt',
    'ojt_certification',
    'completed'
  ];
  
  const currentIndex = phases.indexOf(currentPhase as typeof batchStatusEnum.enumValues[number]);
  if (currentIndex === -1 || currentIndex === phases.length - 1) return null;
  return phases[currentIndex + 1];
};

// Get the end date field name for a given phase
const getPhaseEndDateField = (phase: string): string => {
  const phaseEndDateMap: Record<string, string> = {
    'induction': 'inductionEndDate',
    'training': 'trainingEndDate',
    'certification': 'certificationEndDate',
    'ojt': 'ojtEndDate',
    'ojt_certification': 'ojtCertificationEndDate'
  };
  return phaseEndDateMap[phase] || '';
};

// Get the start date field name for a given phase
const getPhaseStartDateField = (phase: string): string => {
  const phaseStartDateMap: Record<string, string> = {
    'induction': 'inductionStartDate',
    'training': 'trainingStartDate',
    'certification': 'certificationStartDate',
    'ojt': 'ojtStartDate',
    'ojt_certification': 'ojtCertificationStartDate'
  };
  return phaseStartDateMap[phase] || '';
};

// Get the actual start date field name for a given phase
const getActualPhaseStartDateField = (phase: string): string => {
  const actualPhaseStartDateMap: Record<string, string> = {
    'induction': 'actualInductionStartDate',
    'training': 'actualTrainingStartDate',
    'certification': 'actualCertificationStartDate',
    'ojt': 'actualOjtStartDate',
    'ojt_certification': 'actualOjtCertificationStartDate',
    'completed': 'actualHandoverToOpsDate'
  };
  return actualPhaseStartDateMap[phase] || '';
};

// Get the actual end date field name for a given phase
const getActualPhaseEndDateField = (phase: string): string => {
  const actualPhaseEndDateMap: Record<string, string> = {
    'induction': 'actualInductionEndDate',
    'training': 'actualTrainingEndDate',
    'certification': 'actualCertificationEndDate',
    'ojt': 'actualOjtEndDate',
    'ojt_certification': 'actualOjtCertificationEndDate'
  };
  return actualPhaseEndDateMap[phase] || '';
};

// Add a record to batch history
export const addBatchHistoryRecord = async (
  batchId: number, 
  eventType: 'phase_change' | 'status_update' | 'milestone' | 'note',
  description: string,
  previousValue: string | null,
  newValue: string | null,
  organizationId: number,
  userId?: number // Optional userId parameter to specify which user initiated the action
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
        date: new Date(), // Using Date object directly
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

// Function to fix batches that incorrectly transitioned to any active status without users
export const resetEmptyBatches = async () => {
  try {
    console.log('Starting empty batch reset check...');
    
    // Get all batches that are in an active status (not planned or completed)
    const activeBatches = await db.query.organizationBatches.findMany({
      where: and(
        not(eq(organizationBatches.status, 'planned')),
        not(eq(organizationBatches.status, 'completed'))
      )
    });
    
    console.log(`Found ${activeBatches.length} active batches to check for trainee enrollment`);
    
    for (const batch of activeBatches) {
      // Check if the batch has any enrolled users
      const enrolledUsersCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(userBatchProcesses)
        .where(eq(userBatchProcesses.batchId, batch.id));
      
      const userCount = enrolledUsersCount[0]?.count || 0;
      
      // If no users are enrolled, reset the batch back to planned status
      if (userCount === 0) {
        console.log(`Batch ${batch.id} - ${batch.name} has no enrolled users but is in '${batch.status}' status. Resetting to 'planned'.`);
        
        await db
          .update(organizationBatches)
          .set({ 
            status: 'planned',
            updatedAt: new Date(),
            // Reset all actual dates
            actualInductionStartDate: null,
            actualInductionEndDate: null,
            actualTrainingStartDate: null,
            actualTrainingEndDate: null,
            actualCertificationStartDate: null,
            actualCertificationEndDate: null,
            actualOjtStartDate: null,
            actualOjtEndDate: null,
            actualOjtCertificationStartDate: null,
            actualOjtCertificationEndDate: null,
            actualHandoverToOpsDate: null
          })
          .where(eq(organizationBatches.id, batch.id));
          
        // Add history record
        await addBatchHistoryRecord(
          batch.id,
          'phase_change',
          `Batch reset from ${batch.status} to planned due to having no enrolled users`,
          batch.status,
          'planned',
          batch.organizationId
        );
      }
    }
    
    console.log('Empty batch reset completed');
  } catch (error) {
    console.error('Error resetting empty batches:', error);
  }
};

export const updateBatchStatuses = async () => {
  try {
    console.log('Starting batch status update check...');
    const today = startOfDay(new Date());

    // Get all batches that are not completed AND not in planned status
    // This ensures we only manage transitions for batches that have been manually started
    const activeBatches = await db.query.organizationBatches.findMany({
      where: and(
        not(eq(organizationBatches.status, 'completed')),
        not(eq(organizationBatches.status, 'planned'))
      )
    });

    console.log(`Found ${activeBatches.length} active batches that are not in planned or completed status`);

    for (const batch of activeBatches) {
      console.log(`Checking batch ${batch.id} - ${batch.name}`);
      const currentPhase = batch.status;
      
      // We're skipping the automatic transition from 'planned' to 'induction'
      // This must be done manually by the trainer using the "Start Batch" button
      // This section is intentionally removed and replaced with this comment
      
      // For batches in an active phase, check if it's time to move to the next phase
      const endDateField = getPhaseEndDateField(currentPhase);
      if (!endDateField) continue;

      const phaseEndDate = batch[endDateField as keyof typeof batch] as string | null;
      if (!phaseEndDate) continue;

      const endDate = new Date(phaseEndDate);
      if (today >= endDate) {
        const nextPhase = getNextPhase(currentPhase);
        if (nextPhase) {
          // Check if the batch has any enrolled users
          const enrolledUsersCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(userBatchProcesses)
            .where(eq(userBatchProcesses.batchId, batch.id));
          
          const userCount = enrolledUsersCount[0]?.count || 0;
          
          // Only transition if there are users enrolled in the batch
          if (userCount > 0) {
            // Record the actual end date for the current phase
            const actualEndField = getActualPhaseEndDateField(currentPhase);
            
            // Record the actual start date for the next phase
            const actualStartField = getActualPhaseStartDateField(nextPhase);
            
            console.log(`Updating batch ${batch.id} status from ${currentPhase} to ${nextPhase}`);
            
            const updateData: Record<string, any> = { 
              status: nextPhase,
              updatedAt: new Date()
            };
            
            // Add actual end date for current phase
            if (actualEndField) {
              updateData[actualEndField] = today;
            }
            
            // Add actual start date for next phase
            if (actualStartField) {
              updateData[actualStartField] = today;
            }
            
            await db
              .update(organizationBatches)
              .set(updateData)
              .where(eq(organizationBatches.id, batch.id));
              
            // Add history record with system user (ID 1) for automatic changes
            await addBatchHistoryRecord(
              batch.id,
              'phase_change',
              `Batch phase changed from ${currentPhase} to ${nextPhase}`,
              currentPhase,
              nextPhase,
              batch.organizationId,
              1 // Using system user ID for automatic changes
            );
            
            // Also update trainee statuses for all trainees in this batch who don't have manual status set
            await db
              .update(userBatchProcesses)
              .set({
                traineeStatus: nextPhase,
                updatedAt: new Date()
              })
              .where(
                and(
                  eq(userBatchProcesses.batchId, batch.id),
                  eq(userBatchProcesses.status, 'active'),
                  eq(userBatchProcesses.isManualStatus, false)
                )
              );
                
            console.log(`Updated trainee statuses for batch ${batch.id} to ${nextPhase}`);
          } else {
            console.log(`Batch ${batch.id} - ${batch.name} has no enrolled users. Keeping in '${currentPhase}' status.`);
          }
        }
      }
    }

    // Also check for batches that are already in active phases but don't have their actual start dates recorded
    // This covers batches that were manually moved between phases
    const batchesWithMissingActualDates = await db.query.organizationBatches.findMany({
      where: and(
        eq(organizationBatches.status, 'induction'),
        isNull(organizationBatches.actualInductionStartDate)
      )
    });

    for (const batch of batchesWithMissingActualDates) {
      const currentPhase = batch.status;
      const actualStartField = getActualPhaseStartDateField(currentPhase);
      
      if (actualStartField) {
        console.log(`Recording actual start date for batch ${batch.id} in phase ${currentPhase}`);
        await db
          .update(organizationBatches)
          .set({ 
            [actualStartField]: today,
            updatedAt: new Date()
          })
          .where(eq(organizationBatches.id, batch.id));
      }
    }
    
    // Check for batches in training phase with missing induction end dates
    const batchesWithMissingEndDates = await db.query.organizationBatches.findMany({
      where: and(
        eq(organizationBatches.status, 'training'),
        not(isNull(organizationBatches.actualTrainingStartDate)),
        isNull(organizationBatches.actualInductionEndDate)
      )
    });
    
    for (const batch of batchesWithMissingEndDates) {
      console.log(`Recording missing actual end date for batch ${batch.id} for previous phase induction`);
      // Set the actual end date for the induction phase to match the actual start date of training
      await db
        .update(organizationBatches)
        .set({ 
          actualInductionEndDate: batch.actualTrainingStartDate,
          updatedAt: new Date()
        })
        .where(eq(organizationBatches.id, batch.id));
    }
    
    // Similar checks for other phase transitions
    const batchesWithMissingCertEndDates = await db.query.organizationBatches.findMany({
      where: and(
        eq(organizationBatches.status, 'certification'),
        not(isNull(organizationBatches.actualCertificationStartDate)),
        isNull(organizationBatches.actualTrainingEndDate)
      )
    });
    
    for (const batch of batchesWithMissingCertEndDates) {
      console.log(`Recording missing actual end date for batch ${batch.id} for previous phase training`);
      await db
        .update(organizationBatches)
        .set({ 
          actualTrainingEndDate: batch.actualCertificationStartDate,
          updatedAt: new Date()
        })
        .where(eq(organizationBatches.id, batch.id));
    }
    
    // OJT phase check
    const batchesWithMissingOjtEndDates = await db.query.organizationBatches.findMany({
      where: and(
        eq(organizationBatches.status, 'ojt'),
        not(isNull(organizationBatches.actualOjtStartDate)),
        isNull(organizationBatches.actualCertificationEndDate)
      )
    });
    
    for (const batch of batchesWithMissingOjtEndDates) {
      console.log(`Recording missing actual end date for batch ${batch.id} for previous phase certification`);
      await db
        .update(organizationBatches)
        .set({ 
          actualCertificationEndDate: batch.actualOjtStartDate,
          updatedAt: new Date()
        })
        .where(eq(organizationBatches.id, batch.id));
    }
    
    // OJT certification phase check
    const batchesWithMissingOjtCertEndDates = await db.query.organizationBatches.findMany({
      where: and(
        eq(organizationBatches.status, 'ojt_certification'),
        not(isNull(organizationBatches.actualOjtCertificationStartDate)),
        isNull(organizationBatches.actualOjtEndDate)
      )
    });
    
    for (const batch of batchesWithMissingOjtCertEndDates) {
      console.log(`Recording missing actual end date for batch ${batch.id} for previous phase ojt`);
      await db
        .update(organizationBatches)
        .set({ 
          actualOjtEndDate: batch.actualOjtCertificationStartDate,
          updatedAt: new Date()
        })
        .where(eq(organizationBatches.id, batch.id));
    }
    
    // Completed phase check
    const batchesWithMissingCompletedDates = await db.query.organizationBatches.findMany({
      where: and(
        eq(organizationBatches.status, 'completed'),
        not(isNull(organizationBatches.actualHandoverToOpsDate)),
        isNull(organizationBatches.actualOjtCertificationEndDate)
      )
    });
    
    for (const batch of batchesWithMissingCompletedDates) {
      console.log(`Recording missing actual end date for batch ${batch.id} for previous phase ojt_certification`);
      await db
        .update(organizationBatches)
        .set({ 
          actualOjtCertificationEndDate: batch.actualHandoverToOpsDate,
          updatedAt: new Date()
        })
        .where(eq(organizationBatches.id, batch.id));
    }
    
    console.log('Batch status update check completed');
  } catch (error) {
    console.error('Error updating batch statuses:', error);
  }
};
