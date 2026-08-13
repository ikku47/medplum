// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { MedplumClient } from '@medplum/core';
import type {
  ChargeItemDefinition,
  HealthcareService,
  Organization,
  PlanDefinition,
  Questionnaire,
  Resource,
} from '@medplum/fhirtypes';
import { buildServiceDefinition } from '../billing/financial';
import { buildAppointmentType } from '../tenancy/clinic-configuration';
import { buildClinicalForm } from './forms';

export const CLINICBUDDY_SPECIALTY_PACK_TAG = 'https://clinicbuddy.health/fhir/CodeSystem/specialty-pack';
export const CLINICBUDDY_SPECIALTY_ARTIFACT_TAG = 'https://clinicbuddy.health/fhir/CodeSystem/specialty-artifact';

export type ClinicBuddySpecialtyPackId = 'general-practice';

export interface SpecialtyPackInstallResult {
  created: number;
  existing: number;
  total: number;
}

interface PackArtifact<T extends Resource = Resource> {
  key: string;
  resource: T;
}

export function buildGeneralPracticePack(organization: Organization & { id: string }): PackArtifact[] {
  const forms: PackArtifact<Questionnaire>[] = [
    {
      key: 'form-consultation',
      resource: buildClinicalForm({
        title: 'General practice consultation',
        description: 'Structured history and examination prompts for an outpatient consultation.',
        formId: 'general-practice-consultation',
        items: [
          { text: 'Chief complaint', type: 'text', required: true },
          { text: 'Symptom duration', type: 'string', required: false },
          { text: 'Relevant history', type: 'text', required: false },
          { text: 'Examination findings', type: 'text', required: false },
          { text: 'Red flags identified', type: 'boolean', required: true },
        ],
      }),
    },
    {
      key: 'form-chronic-disease-review',
      resource: buildClinicalForm({
        title: 'Chronic disease review',
        description: 'Medication adherence, home readings, complications and care-plan review.',
        formId: 'general-practice-chronic-disease-review',
        items: [
          { text: 'Medication adherence', type: 'choice', required: true },
          { text: 'Home monitoring readings', type: 'text', required: false },
          { text: 'New complications or symptoms', type: 'text', required: false },
          { text: 'Lifestyle goals reviewed', type: 'boolean', required: true },
          { text: 'Next review date', type: 'date', required: true },
        ],
      }),
    },
    {
      key: 'form-follow-up',
      resource: buildClinicalForm({
        title: 'Follow-up review',
        description: 'Tracks response, adherence, adverse effects and the next plan.',
        formId: 'general-practice-follow-up',
        items: [
          { text: 'Response since previous visit', type: 'text', required: true },
          { text: 'Treatment adherence', type: 'choice', required: false },
          { text: 'Adverse effects', type: 'text', required: false },
          { text: 'Plan and follow-up interval', type: 'text', required: true },
        ],
      }),
    },
  ];

  const templates: PackArtifact<PlanDefinition>[] = [
    careTemplate('template-new-consultation', 'GP new consultation', 'Initial assessment and care planning.'),
    careTemplate('template-follow-up', 'GP follow-up', 'Review treatment response and update the care plan.'),
  ];
  const appointmentTypes: PackArtifact<HealthcareService>[] = [
    {
      key: 'appointment-new-consultation',
      resource: buildAppointmentType({
        name: 'New patient consultation',
        code: 'GP-NEW',
        durationMinutes: 30,
        organization: { reference: `Organization/${organization.id}`, display: organization.name },
      }),
    },
    {
      key: 'appointment-follow-up',
      resource: buildAppointmentType({
        name: 'Follow-up consultation',
        code: 'GP-FOLLOWUP',
        durationMinutes: 15,
        organization: { reference: `Organization/${organization.id}`, display: organization.name },
      }),
    },
    {
      key: 'appointment-procedure',
      resource: buildAppointmentType({
        name: 'Minor procedure',
        code: 'GP-PROCEDURE',
        durationMinutes: 30,
        organization: { reference: `Organization/${organization.id}`, display: organization.name },
      }),
    },
  ];
  const services: PackArtifact<ChargeItemDefinition>[] = [
    billingService('service-new-consultation', 'GP-NEW', 'General consultation - new patient', 500),
    billingService('service-follow-up', 'GP-FOLLOWUP', 'General consultation - follow-up', 300),
    billingService('service-minor-procedure', 'GP-PROCEDURE', 'Minor procedure', 750, 'Procedure'),
  ];
  const artifacts: PackArtifact[] = [...forms, ...templates, ...appointmentTypes, ...services];
  return artifacts.map(tagArtifact);
}

export async function installGeneralPracticePack(
  medplum: MedplumClient,
  organization: Organization & { id: string }
): Promise<SpecialtyPackInstallResult> {
  const artifacts = buildGeneralPracticePack(organization);
  let created = 0;
  for (const artifact of artifacts) {
    const existing = await medplum.searchOne(artifact.resource.resourceType, {
      _tag: `${CLINICBUDDY_SPECIALTY_ARTIFACT_TAG}|${artifact.key}`,
    });
    if (!existing) {
      await medplum.createResource(artifact.resource);
      created += 1;
    }
  }
  return { created, existing: artifacts.length - created, total: artifacts.length };
}

function careTemplate(key: string, title: string, description: string): PackArtifact<PlanDefinition> {
  return {
    key,
    resource: {
      resourceType: 'PlanDefinition',
      url: `https://clinicbuddy.health/fhir/PlanDefinition/${key}`,
      version: '1.0.0',
      name: key,
      title,
      status: 'active',
      experimental: false,
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/plan-definition-type',
            code: 'clinical-protocol',
            display: 'Clinical Protocol',
          },
        ],
      },
      description,
    },
  };
}

function billingService(
  key: string,
  code: string,
  title: string,
  price: number,
  category = 'Consultation'
): PackArtifact<ChargeItemDefinition> {
  return { key, resource: buildServiceDefinition({ code, title, price, taxRate: 0, category }) };
}

function tagArtifact<T extends Resource>(artifact: PackArtifact<T>): PackArtifact<T> {
  return {
    ...artifact,
    resource: {
      ...artifact.resource,
      meta: {
        ...artifact.resource.meta,
        tag: [
          ...(artifact.resource.meta?.tag ?? []),
          { system: CLINICBUDDY_SPECIALTY_PACK_TAG, code: 'general-practice', display: 'General Practice' },
          { system: CLINICBUDDY_SPECIALTY_ARTIFACT_TAG, code: artifact.key },
        ],
      },
    },
  };
}
