// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Questionnaire } from '@medplum/fhirtypes';

export const indiaPatientIntakeQuestionnaire: Questionnaire = {
  resourceType: 'Questionnaire',
  status: 'active',
  title: 'Register patient',
  url: 'https://clinicbuddy.health/fhir/Questionnaire/india-patient-registration',
  name: 'clinicbuddy-india-patient-registration',
  item: [
    {
      linkId: 'patient-demographics',
      text: 'Patient details',
      type: 'group',
      item: [
        { linkId: 'first-name', text: 'First name', type: 'string', required: true },
        { linkId: 'middle-name', text: 'Middle name', type: 'string' },
        { linkId: 'last-name', text: 'Last name', type: 'string', required: true },
        { linkId: 'dob', text: 'Date of birth', type: 'date', required: true },
        {
          linkId: 'gender',
          text: 'Gender',
          type: 'choice',
          required: true,
          answerOption: [
            { valueCoding: { system: 'http://hl7.org/fhir/administrative-gender', code: 'female', display: 'Female' } },
            { valueCoding: { system: 'http://hl7.org/fhir/administrative-gender', code: 'male', display: 'Male' } },
            { valueCoding: { system: 'http://hl7.org/fhir/administrative-gender', code: 'other', display: 'Other' } },
            {
              valueCoding: {
                system: 'http://hl7.org/fhir/administrative-gender',
                code: 'unknown',
                display: 'Prefer not to say',
              },
            },
          ],
        },
        { linkId: 'phone', text: 'Mobile number', type: 'string', required: true },
        { linkId: 'email', text: 'Email', type: 'string' },
        {
          linkId: 'preferred-language',
          text: 'Preferred language',
          type: 'choice',
          answerOption: [
            { valueCoding: { system: 'urn:ietf:bcp:47', code: 'en-IN', display: 'English' } },
            { valueCoding: { system: 'urn:ietf:bcp:47', code: 'hi-IN', display: 'Hindi' } },
            { valueCoding: { system: 'urn:ietf:bcp:47', code: 'kn-IN', display: 'Kannada' } },
            { valueCoding: { system: 'urn:ietf:bcp:47', code: 'ta-IN', display: 'Tamil' } },
            { valueCoding: { system: 'urn:ietf:bcp:47', code: 'te-IN', display: 'Telugu' } },
            { valueCoding: { system: 'urn:ietf:bcp:47', code: 'ml-IN', display: 'Malayalam' } },
            { valueCoding: { system: 'urn:ietf:bcp:47', code: 'mr-IN', display: 'Marathi' } },
            { valueCoding: { system: 'urn:ietf:bcp:47', code: 'bn-IN', display: 'Bengali' } },
          ],
        },
      ],
    },
    {
      linkId: 'patient-address',
      text: 'Address',
      type: 'group',
      item: [
        { linkId: 'street', text: 'Address line', type: 'string' },
        { linkId: 'city', text: 'City or district', type: 'string' },
        { linkId: 'state', text: 'State or union territory', type: 'string' },
        { linkId: 'zip', text: 'PIN code', type: 'string' },
      ],
    },
    {
      linkId: 'abha-details',
      text: 'ABHA (optional)',
      type: 'group',
      item: [
        {
          linkId: 'abha-number',
          text: '14-digit ABHA number',
          type: 'string',
        },
        {
          linkId: 'abha-consent',
          text: 'The patient has agreed to store this ABHA number in the clinic record. This does not authorize health-information exchange.',
          type: 'boolean',
        },
      ],
    },
    {
      linkId: 'emergency-contact',
      text: 'Emergency contact',
      type: 'group',
      repeats: true,
      item: [
        { linkId: 'emergency-contact-first-name', text: 'First name', type: 'string' },
        { linkId: 'emergency-contact-last-name', text: 'Last name', type: 'string' },
        { linkId: 'emergency-contact-phone', text: 'Mobile number', type: 'string' },
      ],
    },
    {
      linkId: 'registration-consent',
      text: 'Registration consent',
      type: 'group',
      item: [
        {
          linkId: 'consent-for-treatment-signature',
          text: 'The patient or authorized representative consents to registration and care by this clinic.',
          type: 'boolean',
          required: true,
        },
        { linkId: 'consent-for-treatment-date', text: 'Consent date', type: 'date', required: true },
      ],
    },
  ],
};
