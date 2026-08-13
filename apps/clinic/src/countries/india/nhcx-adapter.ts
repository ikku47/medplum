// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Claim, ClaimResponse, Coverage, Patient } from '@medplum/fhirtypes';

export interface NhcxClaimContext {
  tenantId: string;
  patient: Patient & { id: string };
  coverage: Coverage & { id: string };
}

export interface IndiaNhcxAdapter {
  readonly enabled: boolean;
  checkEligibility(context: NhcxClaimContext): Promise<ClaimResponse>;
  submitClaim(context: NhcxClaimContext, claim: Claim): Promise<{ transactionId: string }>;
  getClaimStatus(transactionId: string): Promise<ClaimResponse>;
}

export class DisabledIndiaNhcxAdapter implements IndiaNhcxAdapter {
  readonly enabled = false;

  async checkEligibility(_context: NhcxClaimContext): Promise<ClaimResponse> {
    throw disabledError();
  }

  async submitClaim(_context: NhcxClaimContext, _claim: Claim): Promise<{ transactionId: string }> {
    throw disabledError();
  }

  async getClaimStatus(_transactionId: string): Promise<ClaimResponse> {
    throw disabledError();
  }
}

function disabledError(): Error {
  return new Error('NHCX exchange is disabled. Configure tenant payer credentials before transmitting insurance data.');
}
