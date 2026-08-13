// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Alert, Image, Stack, Text, Title } from '@mantine/core';
import { RegisterForm } from '@medplum/react';
import { IconAlertCircle } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project') || import.meta.env.MEDPLUM_PROJECT_ID;
  if (import.meta.env.MEDPLUM_REGISTER_ENABLED !== 'true' || !projectId) {
    return (
      <div className="auth-form standalone">
        <Alert color="orange" icon={<IconAlertCircle size={18} />} title="Registration requires a clinic invitation">
          Ask your clinic for its patient registration link. This ensures your new account joins the correct, securely
          isolated clinic.
        </Alert>
      </div>
    );
  }
  return (
    <div className="auth-page">
      <div className="auth-art">
        <div>
          <Text className="eyebrow" tt="uppercase" fw={800}>
            Join your clinic
          </Text>
          <Title className="auth-heading">Your records. Your access.</Title>
          <Text mt="md" maw={450}>
            Create a secure ClinicBuddy patient account linked only to this clinic.
          </Text>
        </div>
      </div>
      <div className="auth-form">
        <RegisterForm
          type="patient"
          projectId={projectId}
          clientId={import.meta.env.MEDPLUM_CLIENT_ID}
          googleClientId={import.meta.env.GOOGLE_CLIENT_ID}
          recaptchaSiteKey={import.meta.env.RECAPTCHA_SITE_KEY}
          login={searchParams.get('login') || undefined}
          onSuccess={() => {
            window.location.href = '/';
          }}
          onSignIn={() => navigate(`/signin?project=${encodeURIComponent(projectId)}`)?.catch(console.error)}
        >
          <Stack align="center" gap="xs">
            <Image src="/img/clinicbuddy-logo.svg" alt="ClinicBuddy" w={48} />
            <Title order={2}>Create patient account</Title>
          </Stack>
        </RegisterForm>
      </div>
    </div>
  );
}
