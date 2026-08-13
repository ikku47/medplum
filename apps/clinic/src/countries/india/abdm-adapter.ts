// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Bundle, Consent, Patient } from '@medplum/fhirtypes';
import { isValidAbdmConsent } from './consent';

export interface AbdmExchangeContext {
  tenantId: string;
  patient: Patient & { id: string };
  consent: Consent & { id: string };
}

export interface IndiaAbdmAdapter {
  readonly enabled: boolean;
  lookupAbha(abhaAddress: string): Promise<Patient | undefined>;
  pushHealthInformation(context: AbdmExchangeContext, bundle: Bundle): Promise<{ transactionId: string }>;
}

export class DisabledIndiaAbdmAdapter implements IndiaAbdmAdapter {
  readonly enabled = false;

  async lookupAbha(_abhaAddress: string): Promise<Patient | undefined> {
    throw disabledError();
  }

  async pushHealthInformation(_context: AbdmExchangeContext, _bundle: Bundle): Promise<{ transactionId: string }> {
    throw disabledError();
  }
}

export function requireValidAbdmExchangeContext(context: AbdmExchangeContext, at: Date = new Date()): void {
  if (!context.tenantId.trim()) {
    throw new Error('ABDM exchange requires an active tenant context.');
  }
  if (!isValidAbdmConsent(context.consent, context.patient, at)) {
    throw new Error('ABDM exchange requires active, verified patient consent for health information exchange.');
  }
}

function disabledError(): Error {
  return new Error('ABDM exchange is disabled. Configure tenant credentials and verified patient consent first.');
}
