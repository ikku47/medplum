// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { clinicBuddyConfig, SUPPORTED_COUNTRY_CODES } from './clinicbuddy';

describe('ClinicBuddy configuration', () => {
  test('uses the India-first product defaults', () => {
    expect(clinicBuddyConfig.appName).toBe('ClinicBuddy');
    expect(clinicBuddyConfig.country).toBe('IN');
    expect(clinicBuddyConfig.locale).toBe('en-IN');
    expect(clinicBuddyConfig.currency).toBe('INR');
    expect(SUPPORTED_COUNTRY_CODES).toEqual(['IN']);
  });
});
