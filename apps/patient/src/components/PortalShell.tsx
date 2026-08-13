// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { ActionIcon, AppShell, Avatar, Burger, Button, Group, Image, NavLink, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { Patient } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import {
  IconCalendarEvent,
  IconCreditCard,
  IconFileDescription,
  IconHeartbeat,
  IconHome2,
  IconLogout,
  IconMail,
  IconPill,
  IconReportMedical,
  IconUserCircle,
} from '@tabler/icons-react';
import type { JSX, ReactNode } from 'react';
import { NavLink as RouterNavLink, useLocation } from 'react-router';
import { getPatientName } from '../lib/portal';

const links = [
  { label: 'Home', href: '/', icon: IconHome2 },
  { label: 'Appointments', href: '/appointments', icon: IconCalendarEvent },
  { label: 'Health record', href: '/health-record', icon: IconHeartbeat },
  { label: 'Medications', href: '/medications', icon: IconPill },
  { label: 'Results', href: '/results', icon: IconReportMedical },
  { label: 'Documents', href: '/documents', icon: IconFileDescription },
  { label: 'Billing', href: '/billing', icon: IconCreditCard },
  { label: 'Messages', href: '/messages', icon: IconMail },
  { label: 'Profile', href: '/profile', icon: IconUserCircle },
];

export function PortalShell({ patient, children }: { patient: Patient; children: ReactNode }): JSX.Element {
  const [opened, { toggle, close }] = useDisclosure(false);
  const location = useLocation();
  const medplum = useMedplum();
  const patientName = getPatientName(patient);

  const signOut = async (): Promise<void> => {
    await medplum.signOut();
    window.location.href = '/signin';
  };

  return (
    <AppShell
      header={{ height: 68 }}
      navbar={{ width: 260, breakpoint: 'md', collapsed: { mobile: !opened } }}
      padding={0}
    >
      <AppShell.Header className="portal-header">
        <Group h="100%" px={{ base: 'md', sm: 'xl' }} justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="md" size="sm" aria-label="Toggle navigation" />
            <Image src="/img/clinicbuddy-logo.svg" alt="" w={34} h={34} />
            <div>
              <Text fw={800} lh={1.1} className="brand-name">
                ClinicBuddy
              </Text>
              <Text size="xs" c="dimmed">
                Patient portal
              </Text>
            </div>
          </Group>
          <Group gap="sm">
            <Avatar color="teal" radius="xl">
              {patientName.charAt(0).toUpperCase()}
            </Avatar>
            <Text visibleFrom="sm" fw={600} size="sm" maw={200} truncate>
              {patientName}
            </Text>
            <ActionIcon variant="subtle" color="gray" onClick={signOut} aria-label="Sign out">
              <IconLogout size={19} />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md" className="portal-navbar">
        <AppShell.Section grow>
          <Stack gap={3}>
            {links.map((link) => (
              <NavLink
                key={link.href}
                component={RouterNavLink}
                to={link.href}
                label={link.label}
                leftSection={<link.icon size={19} stroke={1.7} />}
                active={link.href === '/' ? location.pathname === '/' : location.pathname.startsWith(link.href)}
                onClick={close}
                className="portal-nav-link"
              />
            ))}
          </Stack>
        </AppShell.Section>
        <AppShell.Section>
          <Button
            variant="subtle"
            color="gray"
            fullWidth
            justify="flex-start"
            leftSection={<IconLogout size={18} />}
            onClick={signOut}
          >
            Sign out
          </Button>
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main className="portal-main">{children}</AppShell.Main>
    </AppShell>
  );
}
