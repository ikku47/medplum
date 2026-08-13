// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from 'vitest';
import { buildClinicalForm } from './forms';

describe('clinical forms', () => {
  test('builds an active patient and encounter questionnaire', () => {
    const form = buildClinicalForm({
      title: 'Diabetes follow-up',
      items: [
        { text: 'Current symptoms', type: 'text', required: true },
        { text: 'Fasting glucose', type: 'decimal', required: false },
      ],
      formId: 'diabetes-follow-up',
    });
    expect(form.status).toBe('active');
    expect(form.subjectType).toEqual(['Patient', 'Encounter']);
    expect(form.item?.[0]).toMatchObject({ linkId: 'field-1', type: 'text', required: true });
  });

  test('requires a title and field', () => {
    expect(() => buildClinicalForm({ title: '', items: [] })).toThrow('title');
    expect(() => buildClinicalForm({ title: 'Empty', items: [] })).toThrow('field');
  });
});
