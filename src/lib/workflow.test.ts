import { describe, it, expect } from 'vitest';
import {
  EXPENSE_TRANSITIONS,
  PRODUCTION_TRANSITIONS,
  SETTLEMENT_TRANSITIONS,
  QC_ALLOWED_STATES,
  canTransition,
} from './workflow';

describe('expense workflow', () => {
  it('runs draft → submitted → approved → paid', () => {
    expect(canTransition(EXPENSE_TRANSITIONS, 'DRAFT', 'SUBMITTED')).toBe(true);
    expect(canTransition(EXPENSE_TRANSITIONS, 'SUBMITTED', 'APPROVED')).toBe(true);
    expect(canTransition(EXPENSE_TRANSITIONS, 'APPROVED', 'PAID')).toBe(true);
  });

  it('refuses to pay an expense that was never approved', () => {
    expect(canTransition(EXPENSE_TRANSITIONS, 'DRAFT', 'PAID')).toBe(false);
    expect(canTransition(EXPENSE_TRANSITIONS, 'SUBMITTED', 'PAID')).toBe(false);
  });

  it('treats paid and rejected as terminal', () => {
    for (const to of Object.keys(EXPENSE_TRANSITIONS)) {
      expect(canTransition(EXPENSE_TRANSITIONS, 'PAID', to)).toBe(false);
      expect(canTransition(EXPENSE_TRANSITIONS, 'REJECTED', to)).toBe(false);
    }
  });
});

describe('production workflow', () => {
  it('moves a task through the sewing floor', () => {
    expect(canTransition(PRODUCTION_TRANSITIONS, 'PENDING', 'ASSIGNED')).toBe(true);
    expect(canTransition(PRODUCTION_TRANSITIONS, 'ASSIGNED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition(PRODUCTION_TRANSITIONS, 'IN_PROGRESS', 'COMPLETED')).toBe(true);
    expect(canTransition(PRODUCTION_TRANSITIONS, 'IN_PROGRESS', 'REWORK')).toBe(true);
  });

  it('only allows rework to reopen a completed task', () => {
    const allowed = Object.keys(PRODUCTION_TRANSITIONS).filter((to) =>
      canTransition(PRODUCTION_TRANSITIONS, 'COMPLETED', to),
    );
    expect(allowed).toEqual(['REWORK']);
  });

  it('cancelled tasks are terminal', () => {
    for (const to of Object.keys(PRODUCTION_TRANSITIONS)) {
      expect(canTransition(PRODUCTION_TRANSITIONS, 'CANCELLED', to)).toBe(false);
    }
  });
});

describe('settlement workflow', () => {
  it('requires approval before payment', () => {
    expect(canTransition(SETTLEMENT_TRANSITIONS, 'PENDING', 'PAID')).toBe(false);
    expect(canTransition(SETTLEMENT_TRANSITIONS, 'PENDING', 'APPROVED')).toBe(true);
    expect(canTransition(SETTLEMENT_TRANSITIONS, 'APPROVED', 'PAID')).toBe(true);
  });

  it('cannot pay the same settlement twice', () => {
    expect(canTransition(SETTLEMENT_TRANSITIONS, 'PAID', 'PAID')).toBe(false);
  });
});

describe('qc gating', () => {
  it('only permits QC on started or finished work', () => {
    expect(QC_ALLOWED_STATES).toContain('IN_PROGRESS');
    expect(QC_ALLOWED_STATES).toContain('REWORK');
    expect(QC_ALLOWED_STATES).toContain('COMPLETED');
    expect(QC_ALLOWED_STATES).not.toContain('PENDING');
    expect(QC_ALLOWED_STATES).not.toContain('CANCELLED');
  });
});

describe('unknown states', () => {
  it('denies transitions from an unmapped state', () => {
    expect(canTransition(EXPENSE_TRANSITIONS, 'MADE_UP', 'PAID')).toBe(false);
  });
});
