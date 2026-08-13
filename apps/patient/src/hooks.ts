// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Resource, ResourceType } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { useCallback, useEffect, useState } from 'react';

export interface PortalSearchState<T extends Resource> {
  data: T[];
  loading: boolean;
  error: unknown;
  reload: () => void;
}

export function usePortalSearch<T extends Resource>(resourceType: ResourceType, query: string): PortalSearchState<T> {
  const medplum = useMedplum();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    // A new query/revision begins a new visible request lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(undefined);
    medplum
      .searchResources(resourceType, query, { cache: 'no-cache' })
      .then((resources) => {
        if (active) {
          setData(resources as unknown as T[]);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [medplum, resourceType, query, revision]);

  return { data, loading, error, reload };
}
