// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Alert, Center, Loader, Stack, Text } from '@mantine/core';
import { normalizeErrorString } from '@medplum/core';
import { IconAlertCircle, IconInbox } from '@tabler/icons-react';
import type { JSX, ReactNode } from 'react';

export function LoadingState(): JSX.Element {
  return (
    <Center py={64}>
      <Loader aria-label="Loading" />
    </Center>
  );
}

export function ErrorState({ error }: { error: unknown }): JSX.Element {
  return (
    <Alert color="red" icon={<IconAlertCircle size={18} />} title="We could not load this information">
      {normalizeErrorString(error)}
    </Alert>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <Center py={56}>
      <Stack align="center" gap="xs" ta="center" maw={420}>
        <IconInbox size={36} color="var(--mantine-color-teal-7)" stroke={1.5} />
        <Text fw={700}>{title}</Text>
        <Text c="dimmed" size="sm">
          {message}
        </Text>
        {action}
      </Stack>
    </Center>
  );
}
