// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import { MedplumClient } from '@medplum/core';
import { MedplumProvider } from '@medplum/react';
import '@medplum/react/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { App } from './App';
import './index.css';

const medplum = new MedplumClient({
  onUnauthenticated: () => {
    window.location.href = '/signin';
  },
  baseUrl: sessionStorage.getItem('medplum_base_url') || import.meta.env.MEDPLUM_BASE_URL || undefined,
  cacheTime: 60000,
  autoBatchTime: 100,
});
const theme = createTheme({
  primaryColor: 'clinicbuddy',
  colors: {
    clinicbuddy: [
      '#e7faf6',
      '#cef2ea',
      '#9ce4d6',
      '#65d2c0',
      '#3bbda8',
      '#20aa95',
      '#128678',
      '#0b6b66',
      '#075450',
      '#053f3c',
    ],
  },
  primaryShade: 7,
  defaultRadius: 'md',
  fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif',
  headings: { fontFamily: '"Avenir Next", "Trebuchet MS", sans-serif' },
});
const router = createBrowserRouter([{ path: '*', element: <App /> }]);
const root = createRoot(document.getElementById('root') as HTMLDivElement);
root.render(
  <StrictMode>
    <MedplumProvider medplum={medplum} navigate={(path) => router.navigate(path)}>
      <MantineProvider theme={theme}>
        <Notifications position="bottom-right" />
        <RouterProvider router={router} />
      </MantineProvider>
    </MedplumProvider>
  </StrictMode>
);
