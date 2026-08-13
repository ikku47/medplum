// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable no-nested-ternary */
import { Accordion, Badge, Card, Group, Stack, Text } from '@mantine/core';
import type { DiagnosticReport, Patient } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { PortalPage } from '../components/PortalPage';
import { usePortalSearch } from '../hooks';
import { formatPortalDate, getResultTitle } from '../lib/portal';

export function ResultsPage({ patient }: { patient: Patient & { id: string } }): JSX.Element {
  const results = usePortalSearch<DiagnosticReport>(
    'DiagnosticReport',
    `subject=Patient/${patient.id}&_sort=-date&_count=100`
  );
  return (
    <PortalPage title="Results" description="Finalized laboratory and imaging reports released by your clinic.">
      {results.loading ? (
        <LoadingState />
      ) : results.error ? (
        <ErrorState error={results.error} />
      ) : results.data.length === 0 ? (
        <EmptyState title="No results available" message="Released clinical results will appear here." />
      ) : (
        <Card withBorder radius="lg" padding={0}>
          <Accordion>
            {results.data.map((result) => (
              <Accordion.Item key={result.id} value={result.id ?? getResultTitle(result)}>
                <Accordion.Control>
                  <Group justify="space-between" pr="md">
                    <div>
                      <Text fw={700}>{getResultTitle(result)}</Text>
                      <Text size="sm" c="dimmed">
                        {formatPortalDate(
                          result.issued ??
                            (typeof result.effectiveDateTime === 'string' ? result.effectiveDateTime : undefined),
                          true
                        )}
                      </Text>
                    </div>
                    <Badge color={result.status === 'final' ? 'teal' : 'orange'} variant="light">
                      {result.status}
                    </Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack>
                    <Text>
                      {result.conclusion ??
                        'Your clinician has released this result. Contact the clinic if you need help interpreting it.'}
                    </Text>
                    {result.conclusionCode?.map((concept, index) => (
                      <Text key={index} size="sm">
                        {concept.text ?? concept.coding?.[0]?.display}
                      </Text>
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Card>
      )}
    </PortalPage>
  );
}
