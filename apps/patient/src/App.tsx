// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Alert, Button, Center, Loader, Stack, Text, Title } from '@mantine/core';
import type { Patient } from '@medplum/fhirtypes';
import { useMedplum, useMedplumProfile } from '@medplum/react';
import { IconShieldLock } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { PortalShell } from './components/PortalShell';
import { requirePatientProfile } from './lib/portal';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { BillingPage } from './pages/BillingPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { HealthRecordPage } from './pages/HealthRecordPage';
import { HomePage } from './pages/HomePage';
import { MedicationsPage } from './pages/MedicationsPage';
import { MessagesPage } from './pages/MessagesPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { ResultsPage } from './pages/ResultsPage';
import { SignInPage } from './pages/SignInPage';

export function App(): JSX.Element | null {
  const medplum = useMedplum();
  const profile = useMedplumProfile();
  const [updatedPatient, setUpdatedPatient] = useState<Patient & { id: string }>();
  if (medplum.isLoading()) {
    return (
      <Center h="100vh">
        <Loader aria-label="Loading ClinicBuddy" />
      </Center>
    );
  }
  if (!profile) {
    return (
      <Routes>
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    );
  }

  let patient: Patient & { id: string };
  try {
    patient = updatedPatient ?? requirePatientProfile(profile);
  } catch {
    return (
      <Center h="100vh" p="xl">
        <Alert color="red" icon={<IconShieldLock size={20} />} title="Patient access only" maw={520}>
          <Stack>
            <Text>
              This application only accepts ClinicBuddy Patient profiles. Staff should use the Clinic application.
            </Text>
            <Button
              onClick={() =>
                medplum.signOut().then(() => {
                  window.location.href = '/signin';
                })
              }
            >
              Sign out
            </Button>
          </Stack>
        </Alert>
      </Center>
    );
  }

  return (
    <PortalShell patient={patient}>
      <Routes>
        <Route path="/" element={<HomePage patient={patient} />} />
        <Route path="/appointments" element={<AppointmentsPage patient={patient} />} />
        <Route path="/health-record" element={<HealthRecordPage patient={patient} />} />
        <Route path="/medications" element={<MedicationsPage patient={patient} />} />
        <Route path="/results" element={<ResultsPage patient={patient} />} />
        <Route path="/documents" element={<DocumentsPage patient={patient} />} />
        <Route path="/billing" element={<BillingPage patient={patient} />} />
        <Route path="/messages" element={<MessagesPage patient={patient} />} />
        <Route path="/profile" element={<ProfilePage patient={patient} onUpdated={setUpdatedPatient} />} />
        <Route path="/signin" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </PortalShell>
  );
}

function NotFound(): JSX.Element {
  return (
    <Center mih="70vh">
      <Stack align="center">
        <Title order={2}>Page not found</Title>
        <Text c="dimmed">The patient portal page you requested does not exist.</Text>
        <Button component="a" href="/">
          Return home
        </Button>
      </Stack>
    </Center>
  );
}
