// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Container, Group, Stack, Text, Title } from '@mantine/core';
import type { JSX, ReactNode } from 'react';

export function PortalPage(props: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <Container size="lg" py={{ base: 'lg', sm: 36 }}>
      <Stack gap="xl">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <div>
            <Title order={1}>{props.title}</Title>
            {props.description && (
              <Text c="dimmed" mt={4}>
                {props.description}
              </Text>
            )}
          </div>
          {props.action}
        </Group>
        {props.children}
      </Stack>
    </Container>
  );
}
