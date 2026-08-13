// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Questionnaire, QuestionnaireItem } from '@medplum/fhirtypes';

export const CLINICBUDDY_FORM_IDENTIFIER = 'https://clinicbuddy.health/fhir/identifier/form';
export type ClinicalFormItemType = QuestionnaireItem['type'];

export interface ClinicalFormItemInput {
  text: string;
  type: ClinicalFormItemType;
  required: boolean;
}

export function buildClinicalForm(input: {
  title: string;
  description?: string;
  items: ClinicalFormItemInput[];
  formId?: string;
}): Questionnaire {
  const title = input.title.trim();
  if (!title) {
    throw new Error('Form title is required.');
  }
  if (input.items.length === 0) {
    throw new Error('Add at least one form field.');
  }
  const items: QuestionnaireItem[] = input.items.map((item, index) => {
    const text = item.text.trim();
    if (!text) {
      throw new Error(`Field ${index + 1} requires a label.`);
    }
    return { linkId: `field-${index + 1}`, text, type: item.type, required: item.required };
  });
  return {
    resourceType: 'Questionnaire',
    status: 'active',
    title,
    description: input.description?.trim() || undefined,
    identifier: [{ system: CLINICBUDDY_FORM_IDENTIFIER, value: input.formId ?? crypto.randomUUID() }],
    subjectType: ['Patient', 'Encounter'],
    item: items,
  };
}
