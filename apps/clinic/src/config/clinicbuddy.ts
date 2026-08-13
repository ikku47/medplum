// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

export const SUPPORTED_COUNTRY_CODES = ['IN'] as const;

export type SupportedCountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];

export interface ClinicBuddyConfig {
  readonly appName: string;
  readonly country: SupportedCountryCode;
  readonly locale: string;
  readonly currency: string;
}

function getCountry(value: string | undefined): SupportedCountryCode {
  const country = value || 'IN';
  if (SUPPORTED_COUNTRY_CODES.includes(country as SupportedCountryCode)) {
    return country as SupportedCountryCode;
  }
  throw new Error(`Unsupported ClinicBuddy country code: ${country}`);
}

export const clinicBuddyConfig: ClinicBuddyConfig = Object.freeze({
  appName: import.meta.env.MEDPLUM_APP_NAME || 'ClinicBuddy',
  country: getCountry(import.meta.env.CLINICBUDDY_COUNTRY),
  locale: import.meta.env.CLINICBUDDY_DEFAULT_LOCALE || 'en-IN',
  currency: import.meta.env.CLINICBUDDY_CURRENCY || 'INR',
});
