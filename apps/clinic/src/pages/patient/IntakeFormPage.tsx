// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Alert, Button, Stack, Text } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { formatHumanName, normalizeErrorString } from '@medplum/core';
import type { Questionnaire, QuestionnaireItem, QuestionnaireResponse } from '@medplum/fhirtypes';
import {
  AIRealTimeQuestionnaireForm,
  Document,
  Loading,
  useMedplum,
  useMedplumProfile,
  useValueSetAvailabilities,
} from '@medplum/react';
import type { JSX } from 'react';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { DuplicatePatientError } from '../../countries/india/patient';
import { indiaPatientIntakeQuestionnaire } from '../../countries/india/patient-questionnaire';
import { onboardPatient } from '../../utils/intake-form';

const voiceInstructions = (
  <ul>
    <li>
      To fill out the form, just speak naturally and the dictation tool will automatically map your spoken answers to
      the appropriate form fields.
    </li>
    <li>
      Pause briefly between thoughts to allow the tool to process and fill in the fields. You can continue speaking to
      add or update answers.
    </li>
    <li>
      Try saying something like: “My name is Asha Sharma and I was born on 12 January 1990” or “I live in Bengaluru,
      Karnataka.”
    </li>
  </ul>
);

export interface IntakeFormPageProps {
  skipValueSetCheck?: boolean;
  questionnaire?: Questionnaire;
}

export function IntakeFormPage({
  skipValueSetCheck = false,
  questionnaire: propQuestionnaire,
}: IntakeFormPageProps = {}): JSX.Element {
  const navigate = useNavigate();
  const medplum = useMedplum();
  const profile = useMedplumProfile();
  const questionnaire = propQuestionnaire ?? defaultQuestionnaire;

  // Every value set referenced by the questionnaire, deduplicated by URL (keeping the first
  // question that referenced it, for the "unavailable" list below).
  const valueSets = useMemo<ValueSetInfo[]>(() => {
    if (skipValueSetCheck) {
      return [];
    }
    const unique = new Map<string, ValueSetInfo>();
    for (const vs of extractValueSets(questionnaire?.item)) {
      if (!unique.has(vs.url)) {
        unique.set(vs.url, vs);
      }
    }
    return Array.from(unique.values());
  }, [skipValueSetCheck, questionnaire]);

  const { loading: checkingValueSets, unavailable } = useValueSetAvailabilities(valueSets.map((vs) => vs.url));
  const unavailableValueSets = valueSets.filter((vs) => unavailable.includes(vs.url));

  const handleOnSubmit = useCallback(
    async (response: QuestionnaireResponse) => {
      if (!questionnaire || !profile) {
        return;
      }
      try {
        const patient = await onboardPatient(medplum, questionnaire, response);
        navigate(`/Patient/${patient.id}/timeline`)?.catch(console.error);
      } catch (error) {
        if (error instanceof DuplicatePatientError) {
          showNotification({
            color: 'orange',
            title: 'Possible duplicate patient',
            message: (
              <Stack gap="xs">
                <Text size="sm">Review the existing record before creating another patient.</Text>
                {error.patients.slice(0, 3).map((patient) => (
                  <Button
                    key={patient.id}
                    variant="light"
                    size="compact-sm"
                    onClick={() => navigate(`/Patient/${patient.id}/timeline`)?.catch(console.error)}
                  >
                    Open {formatHumanName(patient.name?.[0]) || 'existing patient'}
                  </Button>
                ))}
              </Stack>
            ),
            autoClose: false,
          });
          return;
        }
        showNotification({
          color: 'red',
          message: normalizeErrorString(error),
          autoClose: false,
        });
      }
    },
    [medplum, navigate, profile, questionnaire]
  );

  return (
    <Document width={800}>
      {checkingValueSets && <Loading />}
      {!checkingValueSets && unavailableValueSets.length > 0 && (
        <Alert color="red" title="Some valuesets are unavailable" mb="md">
          <p>
            The following questions may not display correctly because their valuesets are not available. Please contact
            sales to enable these valuesets.
          </p>
          <ul>
            {unavailableValueSets.map((vs) => (
              <li key={vs.linkId}>{vs.url}</li>
            ))}
          </ul>
        </Alert>
      )}
      <AIRealTimeQuestionnaireForm
        questionnaire={questionnaire}
        onSubmit={handleOnSubmit}
        voiceInstructions={voiceInstructions}
      />
    </Document>
  );
}

interface ValueSetInfo {
  url: string;
  questionText: string;
  linkId: string;
}

/**
 * Recursively extracts all valueset URLs from questionnaire items
 * @param items - The questionnaire items to extract valuesets from
 * @param result - Accumulator array for valueset information
 * @returns Array of valueset information including URL, question text, and linkId
 */
function extractValueSets(items: QuestionnaireItem[] | undefined, result: ValueSetInfo[] = []): ValueSetInfo[] {
  if (!items) {
    return result;
  }

  for (const item of items) {
    if (item.answerValueSet) {
      result.push({
        url: item.answerValueSet,
        questionText: item.text || item.linkId || 'Unknown question',
        linkId: item.linkId || 'unknown',
      });
    }
    if (item.item) {
      extractValueSets(item.item, result);
    }
  }

  return result;
}

const defaultQuestionnaire = indiaPatientIntakeQuestionnaire;
