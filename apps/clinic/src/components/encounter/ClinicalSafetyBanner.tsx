// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Alert, Badge, Group, Stack, Text } from '@mantine/core';
import type { AllergyIntolerance, Patient } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getAllergyDisplay, getAllergySeverity, isActiveConfirmedAllergy } from '../../clinical/safety';
import { showErrorNotification } from '../../utils/notifications';

export function ClinicalSafetyBanner({ patient }: { patient: Patient & { id: string } }): JSX.Element {
  const medplum = useMedplum();
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);

  useEffect(() => {
    const loadAllergies = async (): Promise<void> => {
      const result = await medplum.searchResources('AllergyIntolerance', {
        patient: `Patient/${patient.id}`,
        _count: '100',
      });
      setAllergies(result);
    };
    loadAllergies().catch(showErrorNotification);
  }, [medplum, patient.id]);

  const activeAllergies = useMemo(() => allergies.filter(isActiveConfirmedAllergy), [allergies]);
  const hasSevereAllergy = activeAllergies.some((allergy) => getAllergySeverity(allergy) === 'severe');

  return (
    <Alert
      color={activeAllergies.length > 0 ? 'red' : 'teal'}
      variant="light"
      icon={<IconAlertTriangle size={20} />}
      title={activeAllergies.length > 0 ? 'Clinical safety alert' : 'Allergy status'}
    >
      {activeAllergies.length === 0 ? (
        <Text size="sm">No active confirmed allergies recorded. Verify this with the patient.</Text>
      ) : (
        <Stack gap="xs">
          <Text size="sm" fw={hasSevereAllergy ? 800 : 600}>
            Review allergies before prescribing or administering medication.
          </Text>
          <Group gap="xs">
            {activeAllergies.map((allergy, index) => {
              const severity = getAllergySeverity(allergy);
              return (
                <Badge key={allergy.id ?? index} color={severity === 'severe' ? 'red' : 'orange'} variant="filled">
                  {getAllergyDisplay(allergy)}
                  {severity ? ` · ${severity}` : ''}
                </Badge>
              );
            })}
          </Group>
        </Stack>
      )}
    </Alert>
  );
}
