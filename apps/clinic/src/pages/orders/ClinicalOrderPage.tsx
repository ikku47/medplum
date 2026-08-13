// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Button, Card, Container, Group, Select, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { createReference } from '@medplum/core';
import type { Patient, Practitioner } from '@medplum/fhirtypes';
import { ResourceName, useMedplum, useMedplumProfile, useResource } from '@medplum/react';
import type { JSX } from 'react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { ClinicalOrderInput, ClinicalOrderType } from '../../clinical/orders';
import { buildClinicalOrder } from '../../clinical/orders';
import { showErrorNotification } from '../../utils/notifications';

export function ClinicalOrderPage(): JSX.Element {
  const medplum = useMedplum();
  const profile = useMedplumProfile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientReference = searchParams.get('patient') ?? '';
  const encounterReference = searchParams.get('encounter') ?? undefined;
  const patient = useResource<Patient>(patientReference ? { reference: patientReference } : undefined);
  const [type, setType] = useState<ClinicalOrderType>('imaging');
  const [requestedService, setRequestedService] = useState('');
  const [priority, setPriority] = useState<ClinicalOrderInput['priority']>('routine');
  const [reason, setReason] = useState('');
  const [instructions, setInstructions] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    if (!patient?.id || profile?.resourceType !== 'Practitioner') {
      showErrorNotification('A patient and practitioner are required to create an order.');
      return;
    }
    setSaving(true);
    try {
      await medplum.createResource(
        buildClinicalOrder({
          input: { type, requestedService, priority, reason, instructions, requestedDate },
          patient: createReference(patient),
          requester: createReference(profile as Practitioner & { id: string }),
          encounter: encounterReference,
        })
      );
      await Promise.resolve(navigate(`/Patient/${patient.id}/ServiceRequest`));
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <div>
          <Text tt="uppercase" fw={800} size="xs" c="teal.7" lts="0.14em">
            Clinical order
          </Text>
          <Title order={1}>Request investigation or service</Title>
          {patient && (
            <Text c="dimmed">
              Patient: <ResourceName value={patient} />
            </Text>
          )}
        </div>
        <Card withBorder radius="lg" p="xl">
          <Stack gap="md">
            <Select
              label="Order type"
              required
              value={type}
              onChange={(value) => value && setType(value as ClinicalOrderType)}
              data={[
                { value: 'imaging', label: 'Imaging' },
                { value: 'procedure', label: 'Procedure' },
                { value: 'referral', label: 'Referral' },
                { value: 'other', label: 'Other diagnostic request' },
              ]}
            />
            <TextInput
              label="Requested service"
              placeholder="For example: Chest X-ray PA and lateral"
              required
              value={requestedService}
              onChange={(event) => setRequestedService(event.currentTarget.value)}
            />
            <Select
              label="Priority"
              value={priority}
              onChange={(value) => value && setPriority(value as ClinicalOrderInput['priority'])}
              data={[
                { value: 'routine', label: 'Routine' },
                { value: 'urgent', label: 'Urgent' },
                { value: 'asap', label: 'As soon as possible' },
                { value: 'stat', label: 'Stat' },
              ]}
            />
            <TextInput
              type="date"
              label="Requested date"
              value={requestedDate}
              onChange={(event) => setRequestedDate(event.currentTarget.value)}
            />
            <Textarea
              label="Clinical reason"
              value={reason}
              onChange={(event) => setReason(event.currentTarget.value)}
              autosize
              minRows={2}
            />
            <Textarea
              label="Instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.currentTarget.value)}
              autosize
              minRows={2}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button loading={saving} onClick={() => handleSubmit()}>
                Create order
              </Button>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
