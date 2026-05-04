// =============================================================================
// File        : QCListPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : QC
// Description : Quality Control mismatch resolution batch queue.
// Created     : 2026-05-03
// =============================================================================

import { BatchQueueTable } from '../../components/BatchQueueTable';
import { BatchStatus } from '../../types';

export function QCListPage() {
  return (
    <BatchQueueTable 
      title="Quality Control Queue"
      statuses={[BatchStatus.QCPending, BatchStatus.QCInProgress]}
      actionLabel="Review"
      actionPath="/qc"
      lockField="qcLockedBy"
      lockNameField="qcLockedByName"
      emptyMessage="No batches pending quality control review for this date."
    />
  );
}
