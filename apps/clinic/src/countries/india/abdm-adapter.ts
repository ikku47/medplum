// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Bundle, Consent, Patient } from '@medplum/fhirtypes';

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

function disabledError(): Error {
  return new Error('ABDM exchange is disabled. Configure tenant credentials and verified patient consent first.');
}
