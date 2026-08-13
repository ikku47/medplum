// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from 'vitest';
import { buildAppointmentType, buildClinicSubLocation, getAppointmentDuration } from './clinic-configuration';

describe('clinic configuration', () => {
  test('builds departments and rooms under the clinic hierarchy', () => {
    const department = buildClinicSubLocation({
      name: 'Cardiology',
      kind: 'department',
      organization: { reference: 'Organization/o1' },
      parent: { reference: 'Location/f1' },
    });
    const room = buildClinicSubLocation({
      name: 'Consultation 2',
      kind: 'room',
      organization: { reference: 'Organization/o1' },
      parent: { reference: 'Location/d1' },
    });
    expect(department.type?.[0]?.coding?.[0]?.code).toBe('department');
    expect(room.physicalType?.coding?.[0]?.code).toBe('ro');
    expect(room.partOf?.reference).toBe('Location/d1');
  });

  test('requires a parent for a room', () => {
    expect(() =>
      buildClinicSubLocation({ name: 'Room', kind: 'room', organization: { reference: 'Organization/o1' } })
    ).toThrow('parent');
  });

  test('builds an appointment type with bounded duration', () => {
    const service = buildAppointmentType({
      name: 'New patient consultation',
      code: 'NEW-CONSULT',
      durationMinutes: 30,
      organization: { reference: 'Organization/o1' },
    });
    expect(getAppointmentDuration(service)).toBe(30);
    expect(service.type?.[0]?.coding?.[0]?.code).toBe('NEW-CONSULT');
  });
});
