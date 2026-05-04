// =============================================================================
// File        : CheckerListPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Checker
// Description : Checker (L2) verification batch queue.
// Created     : 2026-05-03
// =============================================================================

import { BatchQueueTable } from '../../components/BatchQueueTable';
import { BatchStatus } from '../../types';

export function CheckerListPage() {
  return (
    <BatchQueueTable 
      title="Checker Verification Queue"
      statuses={[BatchStatus.CheckerPending, BatchStatus.CheckerInProgress]}
      actionLabel="Verify"
      actionPath="/checker"
      lockField="checkerLockedBy"
      lockNameField="checkerLockedByName"
      emptyMessage="No batches pending checker verification for this date."
    />
  );
}
