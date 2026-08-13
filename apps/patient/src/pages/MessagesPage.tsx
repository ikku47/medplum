// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable no-nested-ternary */
import { Button, Card, Group, Select, Stack, Text, Textarea } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import type { Communication, Patient, Practitioner } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconSend } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { PortalPage } from '../components/PortalPage';
import { usePortalSearch } from '../hooks';
import { buildPatientMessage, formatPortalDate, getMessageText, getReferenceLabel } from '../lib/portal';

export function MessagesPage({ patient }: { patient: Patient & { id: string } }): JSX.Element {
  const medplum = useMedplum();
  const patientRef = `Patient/${patient.id}`;
  const messages = usePortalSearch<Communication>('Communication', `_compartment=${patientRef}&_sort=-sent&_count=100`);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [recipient, setRecipient] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => {
    medplum
      .searchResources('Practitioner', '_count=100')
      .then(setPractitioners)
      .catch((error: unknown) =>
        showNotification({
          color: 'red',
          message: error instanceof Error ? error.message : 'Could not load clinic team.',
        })
      );
  }, [medplum]);
  const options = useMemo(
    () =>
      practitioners
        .filter((item) => item.id)
        .map((item) => ({
          value: `Practitioner/${item.id}`,
          label:
            item.name?.[0]?.text ??
            [item.name?.[0]?.given?.join(' '), item.name?.[0]?.family].filter(Boolean).join(' ') ??
            'Clinic clinician',
        })),
    [practitioners]
  );
  const send = async (): Promise<void> => {
    if (!recipient) {
      showNotification({ color: 'red', message: 'Choose a clinic recipient.' });
      return;
    }
    setSending(true);
    try {
      await medplum.createResource(
        buildPatientMessage(
          patient,
          { reference: recipient, display: options.find((item) => item.value === recipient)?.label },
          body
        )
      );
      setBody('');
      messages.reload();
      showNotification({ color: 'teal', message: 'Secure message sent.' });
    } catch (error) {
      showNotification({ color: 'red', message: error instanceof Error ? error.message : 'Message failed.' });
    } finally {
      setSending(false);
    }
  };
  return (
    <PortalPage title="Secure messages" description="Contact your clinic team about non-urgent care questions.">
      <Card withBorder radius="lg" padding="lg">
        <Stack>
          <Text fw={750}>New message</Text>
          <Select
            label="To"
            placeholder="Choose clinic team member"
            data={options}
            value={recipient}
            onChange={setRecipient}
            searchable
          />
          <Textarea
            label="Message"
            description="Do not use messaging for emergencies."
            minRows={4}
            maxLength={2000}
            value={body}
            onChange={(event) => setBody(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button
              leftSection={<IconSend size={17} />}
              loading={sending}
              disabled={!body.trim() || !recipient}
              onClick={send}
            >
              Send securely
            </Button>
          </Group>
        </Stack>
      </Card>
      {messages.loading ? (
        <LoadingState />
      ) : messages.error ? (
        <ErrorState error={messages.error} />
      ) : messages.data.length === 0 ? (
        <EmptyState title="No messages" message="Secure messages between you and your clinic will appear here." />
      ) : (
        <Stack>
          {messages.data.map((message) => {
            const sentByPatient = message.sender?.reference === patientRef;
            return (
              <Card key={message.id} withBorder radius="lg" className={sentByPatient ? 'message-sent' : undefined}>
                <Group justify="space-between">
                  <Text fw={700}>
                    {sentByPatient
                      ? `To ${getReferenceLabel(message.recipient?.find((item) => item.reference !== patientRef))}`
                      : `From ${getReferenceLabel(message.sender)}`}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatPortalDate(message.sent ?? message.received, true)}
                  </Text>
                </Group>
                <Text mt="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {getMessageText(message)}
                </Text>
              </Card>
            );
          })}
        </Stack>
      )}
    </PortalPage>
  );
}
