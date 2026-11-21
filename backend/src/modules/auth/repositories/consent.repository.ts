import type { DataConsent } from '@nova/db';

import type { Db } from '../../../lib/db.js';

/** Acceso a `data_consents` (data-model.md `DataConsent`). */
export const consentRepository = {
  create(
    db: Db,
    data: { userId: string; policyVersion: string; acceptedAt: Date },
  ): Promise<DataConsent> {
    return db.dataConsent.create({ data });
  },
};
