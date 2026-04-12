-- Stated reason for visit at presentation (owner/patient complaint), distinct from CC/HPI narrative.

alter table public.visit_clinical_evaluations
  add column if not exists patient_complaint text;

comment on column public.visit_clinical_evaluations.patient_complaint is
  'What the owner or patient reports as the reason for today''s visit; may be pre-filled from booking intake.';
