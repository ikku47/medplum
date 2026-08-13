// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable no-nested-ternary */
import { Button, Card, Group, SimpleGrid, Text, ThemeIcon } from '@mantine/core';
import type { DocumentReference, Patient } from '@medplum/fhirtypes';
import { AttachmentDisplay } from '@medplum/react';
import { IconDownload, IconFileDescription } from '@tabler/icons-react';
import type { JSX } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { PortalPage } from '../components/PortalPage';
import { usePortalSearch } from '../hooks';
import { formatPortalDate } from '../lib/portal';

export function DocumentsPage({ patient }: { patient: Patient & { id: string } }): JSX.Element {
  const documents = usePortalSearch<DocumentReference>(
    'DocumentReference',
    `subject=Patient/${patient.id}&status=current&_sort=-date&_count=100`
  );
  return (
    <PortalPage title="Documents" description="Reports, visit files, and documents securely shared by your clinic.">
      {documents.loading ? (
        <LoadingState />
      ) : documents.error ? (
        <ErrorState error={documents.error} />
      ) : documents.data.length === 0 ? (
        <EmptyState title="No documents" message="Documents shared with you will appear here." />
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {documents.data.map((document) => {
            const attachment = document.content?.[0]?.attachment;
            return (
              <Card key={document.id} withBorder radius="lg" padding="lg">
                <Group justify="space-between" align="flex-start">
                  <ThemeIcon color="teal" variant="light" radius="xl">
                    <IconFileDescription size={19} />
                  </ThemeIcon>
                  {attachment?.url && (
                    <Button
                      component="a"
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      variant="subtle"
                      size="xs"
                      leftSection={<IconDownload size={16} />}
                    >
                      Open
                    </Button>
                  )}
                </Group>
                <Text fw={750} mt="lg">
                  {document.description ?? document.type?.text ?? attachment?.title ?? 'Clinical document'}
                </Text>
                <Text size="sm" c="dimmed" mt={4}>
                  {formatPortalDate(document.date ?? document.context?.period?.start)}
                </Text>
                {attachment && attachment.contentType?.startsWith('image/') && (
                  <AttachmentDisplay value={attachment} maxWidth={420} />
                )}
              </Card>
            );
          })}
        </SimpleGrid>
      )}
    </PortalPage>
  );
}
