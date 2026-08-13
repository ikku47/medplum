// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Menu,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import type { WithId } from '@medplum/core';
import { getReferenceString } from '@medplum/core';
import type { DiagnosticReport } from '@medplum/fhirtypes';
import { ResourceName, useMedplum, useMedplumProfile } from '@medplum/react';
import { IconDotsVertical } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { ResultClinicalFlag, ResultWorkflow } from '../../clinical/results';
import { getResultWorkflow, updateResultWorkflow } from '../../clinical/results';
import { showErrorNotification } from '../../utils/notifications';

type InboxFilter = 'new' | 'reviewed' | 'all';

export function ResultsInboxPage(): JSX.Element {
  const medplum = useMedplum();
  const profile = useMedplumProfile();
  const [reports, setReports] = useState<WithId<DiagnosticReport>[]>([]);
  const [filter, setFilter] = useState<InboxFilter>('new');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>();

  const loadReports = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setReports(
        await medplum.searchResources('DiagnosticReport', [
          ['status', 'preliminary,final,amended,corrected'],
          ['_count', '200'],
          ['_sort', '-issued'],
        ])
      );
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setLoading(false);
    }
  }, [medplum]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inbox state follows the current tenant's reports
    loadReports().catch(showErrorNotification);
  }, [loadReports]);

  const visibleReports = useMemo(
    () => reports.filter((report) => filter === 'all' || getResultWorkflow(report).reviewStatus === filter),
    [filter, reports]
  );

  const saveWorkflow = async (report: WithId<DiagnosticReport>, workflow: ResultWorkflow): Promise<void> => {
    setSavingId(report.id);
    try {
      const saved = await medplum.updateResource(updateResultWorkflow(report, workflow));
      setReports((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setSavingId(undefined);
    }
  };

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end">
          <div>
            <Text tt="uppercase" fw={800} size="xs" c="teal.7" lts="0.14em">
              Clinical
            </Text>
            <Title order={1}>Results inbox</Title>
            <Text c="dimmed">Review results, identify urgent findings and record patient notification.</Text>
          </div>
          <Button variant="light" onClick={() => loadReports()}>
            Refresh
          </Button>
        </Group>
        <SegmentedControl
          value={filter}
          onChange={(value) => setFilter(value as InboxFilter)}
          data={[
            {
              value: 'new',
              label: `New (${reports.filter((report) => getResultWorkflow(report).reviewStatus === 'new').length})`,
            },
            { value: 'reviewed', label: 'Reviewed' },
            { value: 'all', label: 'All' },
          ]}
        />
        {loading && reports.length === 0 ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : (
          <Stack gap="sm">
            {visibleReports.map((report) => {
              const workflow = getResultWorkflow(report);
              const subject = report.subject;
              return (
                <Card key={report.id} withBorder radius="lg" p="lg">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={5}>
                      <Group gap="xs">
                        <Text fw={800}>{getReportDisplay(report)}</Text>
                        <Badge color={flagColor(workflow.clinicalFlag)} variant="filled">
                          {workflow.clinicalFlag}
                        </Badge>
                        <Badge variant="light">{workflow.reviewStatus}</Badge>
                        {workflow.patientNotified && <Badge color="teal">Patient notified</Badge>}
                      </Group>
                      {subject?.reference && (
                        <Text component={Link} to={`/${subject.reference}`} size="sm" fw={600}>
                          {subject.display || <ResourceName value={subject} />}
                        </Text>
                      )}
                      <Text size="sm" c="dimmed">
                        {report.issued
                          ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(
                              new Date(report.issued)
                            )
                          : 'Issue date not recorded'}
                      </Text>
                      {report.conclusion && <Text size="sm">{report.conclusion}</Text>}
                    </Stack>
                    <Group gap="xs">
                      {workflow.reviewStatus === 'new' && (
                        <Button
                          size="xs"
                          loading={savingId === report.id}
                          onClick={() =>
                            saveWorkflow(report, {
                              ...workflow,
                              reviewStatus: 'reviewed',
                              reviewedAt: new Date().toISOString(),
                              reviewedBy: profile ? getReferenceString(profile) : undefined,
                            })
                          }
                        >
                          Mark reviewed
                        </Button>
                      )}
                      {workflow.reviewStatus === 'reviewed' && !workflow.patientNotified && (
                        <Button
                          size="xs"
                          variant="light"
                          loading={savingId === report.id}
                          onClick={() =>
                            saveWorkflow(report, {
                              ...workflow,
                              patientNotified: true,
                              notifiedAt: new Date().toISOString(),
                            })
                          }
                        >
                          Patient notified
                        </Button>
                      )}
                      <ResultFlagMenu
                        workflow={workflow}
                        onChange={(clinicalFlag) => saveWorkflow(report, { ...workflow, clinicalFlag })}
                      />
                    </Group>
                  </Group>
                </Card>
              );
            })}
            {visibleReports.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">
                No results in this view.
              </Text>
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

function ResultFlagMenu(props: {
  workflow: ResultWorkflow;
  onChange: (flag: ResultClinicalFlag) => Promise<void>;
}): JSX.Element {
  return (
    <Menu position="bottom-end">
      <Menu.Target>
        <ActionIcon variant="subtle" aria-label="Set result flag">
          <IconDotsVertical size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {(['normal', 'abnormal', 'critical'] as const).map((flag) => (
          <Menu.Item key={flag} onClick={() => props.onChange(flag)} disabled={props.workflow.clinicalFlag === flag}>
            Mark {flag}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

function flagColor(flag: ResultClinicalFlag): string {
  if (flag === 'critical') {
    return 'red';
  }
  if (flag === 'abnormal') {
    return 'orange';
  }
  return 'teal';
}

function getReportDisplay(report: DiagnosticReport): string {
  return report.code.text || report.code.coding?.[0]?.display || report.code.coding?.[0]?.code || 'Diagnostic result';
}
