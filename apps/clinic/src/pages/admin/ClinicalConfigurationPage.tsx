// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Container,
  Group,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import type { WithId } from '@medplum/core';
import type { Questionnaire } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconForms, IconPlus, IconTrash } from '@tabler/icons-react';
import type { FormEvent, JSX } from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { ClinicalFormItemInput, ClinicalFormItemType } from '../../clinical/forms';
import { buildClinicalForm, CLINICBUDDY_FORM_IDENTIFIER } from '../../clinical/forms';
import { showErrorNotification, showSuccessNotification } from '../../utils/notifications';

const fieldTypes: { value: ClinicalFormItemType; label: string }[] = [
  { value: 'string', label: 'Short text' },
  { value: 'text', label: 'Long text' },
  { value: 'boolean', label: 'Yes / no' },
  { value: 'integer', label: 'Whole number' },
  { value: 'decimal', label: 'Decimal number' },
  { value: 'date', label: 'Date' },
  { value: 'choice', label: 'Choice' },
];

export function ClinicalConfigurationPage(): JSX.Element {
  const medplum = useMedplum();
  const [forms, setForms] = useState<WithId<Questionnaire>[]>([]);
  const [templateCount, setTemplateCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ClinicalFormItemInput[]>([{ text: '', type: 'text', required: false }]);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      try {
        const [questionnaires, templates] = await Promise.all([
          medplum.searchResources('Questionnaire', { _count: '200', _sort: 'title' }),
          medplum.searchResources('PlanDefinition', { _count: '200', status: 'active' }),
        ]);
        if (active) {
          setForms(
            questionnaires.filter((form) =>
              form.identifier?.some((identifier) => identifier.system === CLINICBUDDY_FORM_IDENTIFIER)
            )
          );
          setTemplateCount(templates.length);
        }
      } catch (error) {
        showErrorNotification(error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    load().catch(showErrorNotification);
    return () => {
      active = false;
    };
  }, [medplum]);

  const save = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await medplum.createResource(buildClinicalForm({ title, description, items }));
      setForms((current) =>
        [...current, saved].sort((left, right) => (left.title ?? '').localeCompare(right.title ?? ''))
      );
      setTitle('');
      setDescription('');
      setItems([{ text: '', type: 'text', required: false }]);
      setOpened(false);
      showSuccessNotification({ title: 'Clinical form created', message: saved.title ?? 'Form ready.' });
    } catch (error) {
      showErrorNotification(error);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (form: WithId<Questionnaire>): Promise<void> => {
    try {
      const saved = await medplum.updateResource({ ...form, status: form.status === 'active' ? 'retired' : 'active' });
      setForms((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      showErrorNotification(error);
    }
  };

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <IconForms size={36} color="var(--mantine-primary-color-filled)" />
            <div>
              <Title order={2}>Clinical configuration</Title>
              <Text c="dimmed">Reusable forms and care templates owned by this clinic.</Text>
            </div>
          </Group>
          <Button leftSection={<IconPlus size={17} />} onClick={() => setOpened(true)}>
            New form
          </Button>
        </Group>
        <Card withBorder radius="lg">
          <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
            Active care templates
          </Text>
          <Text fz="1.8rem" fw={900}>
            {templateCount}
          </Text>
          <Text size="sm" c="dimmed">
            PlanDefinitions are selectable when a new encounter is created.
          </Text>
        </Card>
        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {forms.map((form) => (
              <Card key={form.id} withBorder radius="lg">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Title order={4}>{form.title}</Title>
                    <Badge color={form.status === 'active' ? 'teal' : 'gray'}>{form.status}</Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {form.description || `${form.item?.length ?? 0} fields`}
                  </Text>
                  <Group>
                    <Button component={Link} to={`/Questionnaire/${form.id}`} variant="light" size="xs">
                      Open
                    </Button>
                    <Button variant="subtle" size="xs" onClick={() => toggle(form)}>
                      {form.status === 'active' ? 'Retire' : 'Activate'}
                    </Button>
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}
        {!loading && forms.length === 0 && (
          <Text c="dimmed" ta="center">
            No ClinicBuddy clinical forms yet.
          </Text>
        )}
      </Stack>
      <Modal opened={opened} onClose={() => setOpened(false)} title="New clinical form" size="lg">
        <form onSubmit={save}>
          <Stack>
            <TextInput
              required
              label="Form title"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
            <Textarea
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
            {items.map((item, index) => (
              <Group key={index} align="flex-end" wrap="nowrap">
                <TextInput
                  required
                  label={`Field ${index + 1}`}
                  style={{ flex: 1 }}
                  value={item.text}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((value, itemIndex) =>
                        itemIndex === index ? { ...value, text: event.currentTarget.value } : value
                      )
                    )
                  }
                />
                <Select
                  label="Type"
                  data={fieldTypes}
                  value={item.type}
                  onChange={(value) =>
                    value &&
                    setItems((current) =>
                      current.map((field, itemIndex) =>
                        itemIndex === index ? { ...field, type: value as ClinicalFormItemType } : field
                      )
                    )
                  }
                />
                <Checkbox
                  label="Required"
                  checked={item.required}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((field, itemIndex) =>
                        itemIndex === index ? { ...field, required: event.currentTarget.checked } : field
                      )
                    )
                  }
                />
                <ActionIcon
                  color="red"
                  variant="subtle"
                  aria-label="Remove field"
                  disabled={items.length === 1}
                  onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Group>
            ))}
            <Button
              variant="light"
              size="xs"
              onClick={() => setItems((current) => [...current, { text: '', type: 'text', required: false }])}
            >
              Add field
            </Button>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Create form
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
