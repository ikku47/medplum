// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Image, Stack, Text, Title } from '@mantine/core';
import { SignInForm } from '@medplum/react';
import type { JSX } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export function SignInPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  return (
    <div className="auth-page">
      <div className="auth-art">
        <div>
          <Text className="eyebrow" tt="uppercase" fw={800}>
            ClinicBuddy patient portal
          </Text>
          <Title className="auth-heading">Care follows you.</Title>
          <Text mt="md" maw={450}>
            Appointments, prescriptions, results, invoices, and your clinic team—all in one secure place.
          </Text>
        </div>
      </div>
      <div className="auth-form">
        <SignInForm
          clientId={import.meta.env.MEDPLUM_CLIENT_ID}
          googleClientId={import.meta.env.GOOGLE_CLIENT_ID}
          projectId={searchParams.get('project') || import.meta.env.MEDPLUM_PROJECT_ID || undefined}
          login={searchParams.get('login') || undefined}
          onSuccess={() => navigate('/')?.catch(console.error)}
          onRegister={
            import.meta.env.MEDPLUM_REGISTER_ENABLED === 'true'
              ? () => navigate('/register')?.catch(console.error)
              : undefined
          }
        >
          <Stack align="center" gap="xs">
            <Image src="/img/clinicbuddy-logo.svg" alt="ClinicBuddy" w={48} />
            <Title order={2}>Welcome back</Title>
            <Text c="dimmed" size="sm">
              Sign in to your patient account
            </Text>
          </Stack>
        </SignInForm>
      </div>
    </div>
  );
}
