// =============================================================================
// File        : MakerListPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Maker
// Description : Maker (L1) data entry batch queue.
// Created     : 2026-05-03
// =============================================================================

import { BatchQueueTable } from '../../components/BatchQueueTable';
import { BatchStatus } from '../../types';

export function MakerListPage() {
  return (
    <BatchQueueTable 
      title="Maker Entry Queue"
      statuses={[BatchStatus.MakerPending, BatchStatus.MakerInProgress]}
      actionLabel="Entry"
      actionPath="/maker"
      lockField="makerLockedBy"
      lockNameField="makerLockedByName"
      emptyMessage="No batches pending maker entry for this date."
    />
  );
}
