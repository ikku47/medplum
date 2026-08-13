// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import type { Appointment } from '@medplum/fhirtypes';
import { MockClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { QueuePage } from './QueuePage';

describe('QueuePage', () => {
  let medplum: MockClient;
  let appointment: Appointment & { id: string };

  beforeEach(() => {
    medplum = new MockClient();
    appointment = {
      resourceType: 'Appointment',
      id: 'appointment-1',
      status: 'booked',
      start: new Date().toISOString(),
      participant: [
        { actor: { reference: 'Patient/patient-1', display: 'Asha Sharma' }, status: 'accepted' },
        { actor: { reference: 'Practitioner/doctor-1', display: 'Dr Rao' }, status: 'accepted' },
      ],
    };
    medplum.getProject = vi.fn().mockReturnValue({ resourceType: 'Project', id: 'clinic-1', features: [] });
    medplum.searchResources = vi.fn().mockImplementation(async (resourceType) => {
      if (resourceType === 'Location') {
        return [
          {
            resourceType: 'Location',
            id: 'room-1',
            status: 'active',
            name: 'Consultation Room 1',
            type: [
              {
                coding: [
                  {
                    system: 'https://clinicbuddy.health/fhir/CodeSystem/location-kind',
                    code: 'room',
                  },
                ],
              },
            ],
          },
        ];
      }
      return [appointment];
    });
    medplum.updateResource = vi.fn().mockImplementation(async (resource) => resource);
  });

  async function setup(): Promise<void> {
    await act(async () => {
      render(
        <MemoryRouter>
          <MedplumProvider medplum={medplum}>
            <MantineProvider>
              <Notifications />
              <QueuePage />
            </MantineProvider>
          </MedplumProvider>
        </MemoryRouter>
      );
    });
  }

  test('shows today appointments and advances the reception state', async () => {
    await setup();

    expect(await screen.findByText('Asha Sharma')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Arrived' }));

    await waitFor(() =>
      expect(medplum.updateResource).toHaveBeenCalledWith(
        expect.objectContaining({ resourceType: 'Appointment', id: 'appointment-1', status: 'arrived' })
      )
    );
    expect(await screen.findByText('Arrived')).toBeInTheDocument();
  });

  test('assigns a configured consultation room from the flow board', async () => {
    const user = userEvent.setup();
    await setup();
    await screen.findByText('Asha Sharma');
    await user.click(screen.getByLabelText('Room for Asha Sharma'));
    await user.click(await screen.findByText('Consultation Room 1'));
    await waitFor(() =>
      expect(medplum.updateResource).toHaveBeenCalledWith(
        expect.objectContaining({
          participant: expect.arrayContaining([
            expect.objectContaining({
              actor: { reference: 'Location/room-1', display: 'Consultation Room 1' },
              status: 'accepted',
            }),
          ]),
        })
      )
    );
  });
});
