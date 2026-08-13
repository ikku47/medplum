// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  MultiSelect,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import type { WithId } from '@medplum/core';
import { formatDateTime, getReferenceString, isResourceWithId } from '@medplum/core';
import type { Consent } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconFileCertificate, IconPlus } from '@tabler/icons-react';
import type { FormEvent, JSX } from 'react';
import { useEffect, useState } from 'react';
import type { AbdmConsentPurpose } from '../../countries/india/consent';
import {
  ABDM_CONSENT_PROFILE,
  abdmConsentPurposes,
  buildAbdmConsent,
  isValidAbdmConsent,
  revokeAbdmConsent,
} from '../../countries/india/consent';
import { usePatient } from '../../hooks/usePatient';
import { showErrorNotification, showSuccessNotification } from '../../utils/notifications';

function dateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function PatientConsentsPage(): JSX.Element {
  const medplum = useMedplum();
  const patient = usePatient();
  const patientWithId = patient && isResourceWithId(patient) ? patient : undefined;
  const [consents, setConsents] = useState<WithId<Consent>[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [purposes, setPurposes] = useState<string[]>(['health-information-exchange']);
  const [start, setStart] = useState(dateInputValue(new Date()));
  const [end, setEnd] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return dateInputValue(date);
  });
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!patientWithId) {
      return () => {};
    }
    let active = true;
    medplum
      .searchResources('Consent', { patient: getReferenceString(patientWithId), _sort: '-date', _count: '100' })
      .then(
        (resources) => {
          if (active) {
            setConsents(resources.filter((consent) => consent.meta?.profile?.includes(ABDM_CONSENT_PROFILE)));
          }
        },
        showErrorNotification
      )
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [medplum, patientWithId]);

  const createConsent = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!patientWithId) {
      return;
    }
    setSaving(true);
    try {
      const saved = await medplum.createResource(
        buildAbdmConsent({
          patient: patientWithId,
          purposes: purposes as AbdmConsentPurpose[],
          start,
          end,
          note,
        })
      );
      setConsents((current) => [saved, ...current]);
      setOpened(false);
      setNote('');
      showSuccessNotification({ title: 'Consent recorded', message: 'The ABDM consent is active and auditable.' });
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (consent: WithId<Consent>): Promise<void> => {
    try {
      const saved = await medplum.updateResource(revokeAbdmConsent(consent));
      setConsents((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      showSuccessNotification({ title: 'Consent revoked', message: 'Future ABDM exchange is blocked.' });
    } catch (error) {
      showErrorNotification(error);
    }
  };

  if (!patientWithId || loading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  return (
    <Stack p="lg" gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Consent</Title>
          <Text c="dimmed">Patient-controlled consent for ABDM health information exchange.</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>
          Record consent
        </Button>
      </Group>
      <Alert icon={<IconFileCertificate size={18} />} color="blue" variant="light">
        ClinicBuddy blocks ABDM exchange unless an active, verified and unexpired consent explicitly permits health
        information exchange. Revocation takes effect immediately.
      </Alert>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {consents.map((consent) => {
          const valid = isValidAbdmConsent(consent, patientWithId);
          const purposeCodes = consent.provision?.purpose?.map((purpose) => purpose.code).filter(Boolean).join(', ');
          return (
            <Card key={consent.id} withBorder>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={700}>ABDM information exchange</Text>
                  <Badge color={valid ? 'teal' : 'gray'}>{valid ? 'active' : consent.status}</Badge>
                </Group>
                <Text size="sm">Purposes: {purposeCodes || 'Not specified'}</Text>
                <Text size="sm" c="dimmed">
                  Valid {formatDateTime(consent.provision?.period?.start)} to{' '}
                  {formatDateTime(consent.provision?.period?.end)}
                </Text>
                <Text size="xs" c="dimmed">
                  Recorded {formatDateTime(consent.dateTime)} · verified{' '}
                  {consent.verification?.some((verification) => verification.verified) ? 'yes' : 'no'}
                </Text>
                {consent.status === 'active' && (
                  <Button color="red" variant="subtle" size="xs" onClick={() => revoke(consent)}>
                    Revoke consent
                  </Button>
                )}
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
      {consents.length === 0 && (
        <Text c="dimmed" ta="center" py="xl">
          No ABDM consent has been recorded for this patient.
        </Text>
      )}
      <Modal opened={opened} onClose={() => setOpened(false)} title="Record ABDM consent" size="lg">
        <form onSubmit={createConsent}>
          <Stack>
            <MultiSelect
              required
              label="Permitted purposes"
              data={abdmConsentPurposes}
              value={purposes}
              onChange={setPurposes}
            />
            <Group grow align="flex-start">
              <TextInput
                required
                type="date"
                label="Valid from"
                value={start}
                onChange={(event) => setStart(event.currentTarget.value)}
              />
              <TextInput
                required
                type="date"
                label="Valid until"
                value={end}
                onChange={(event) => setEnd(event.currentTarget.value)}
              />
            </Group>
            <Textarea
              label="Consent record note"
              description="Optional note describing how consent was captured."
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
            />
            <Text size="xs" c="dimmed">
              By recording this consent, staff confirm that the patient or authorized representative reviewed and
              approved the selected purposes and validity period.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Record verified consent
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
