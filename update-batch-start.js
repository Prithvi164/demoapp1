// First update: around line 2313
// Record batch history first
await addBatchHistoryRecord(
  batchId,
  'phase_change',
  `Batch phase changed from planned to induction (batch started)`,
  'planned',
  'induction',
  batch.organizationId
);

// Should be replaced with:
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

// Second update: around line 6146
// Record batch history first
await addBatchHistoryRecord(
  batchId,
  'phase_change',
  `Batch phase changed from planned to induction (batch started)`,
  'planned',
  'induction',
  batch.organizationId
);

// Should be replaced with:
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

// Third update: around line 6521
// Record batch history first
await addBatchHistoryRecord(
  batchId,
  'phase_change',
  `Batch phase changed from planned to induction (batch started)`,
  'planned',
  'induction',
  batch.organizationId
);

// Should be replaced with:
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

// Fourth update: around line 6896
// Record batch history first
await addBatchHistoryRecord(
  batchId,
  'phase_change',
  `Batch phase changed from planned to induction (batch started)`,
  'planned',
  'induction',
  batch.organizationId
);

// Should be replaced with:
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