import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePipelineSummary,
  evaluateFieldAccess,
  formatCurrencySAR,
  generateLeadUniqueId,
  isValidLeadUniqueId,
  validateQuickDealInput,
} from './formatters';
import type { CrmProfile, Deal } from '../types/crm';

test('formatCurrencySAR formats SAR values cleanly with tabular numeric output', () => {
  assert.equal(formatCurrencySAR(450000, 'SAR'), '450,000 ر.س');
  assert.equal(formatCurrencySAR(12500, 'USD'), '$12,500');
});

test('generateLeadUniqueId generates sequential RWQ-xxxxx identifiers', () => {
  const nextId = generateLeadUniqueId(['RWQ-10421', 'RWQ-10428']);
  assert.equal(nextId, 'RWQ-10429');
  assert.equal(isValidLeadUniqueId(nextId), true);
  assert.equal(isValidLeadUniqueId('LEAD-104'), false);
});

test('calculatePipelineSummary computes open, weighted, won, and win rate correctly', () => {
  const sampleDeals: Deal[] = [
    {
      id: 'd1',
      ownerId: 'u1',
      title: 'صفقة 1',
      accountId: 'a1',
      accountName: 'شركة 1',
      amount: 100000,
      currency: 'SAR',
      stage: 'عرض سعر',
      probability: 50,
      closeDate: '2026-12-01',
      ownerName: 'أحمد',
    },
    {
      id: 'd2',
      ownerId: 'u1',
      title: 'صفقة 2',
      accountId: 'a2',
      accountName: 'شركة 2',
      amount: 200000,
      currency: 'SAR',
      stage: 'مكتملة',
      probability: 100,
      closeDate: '2026-11-10',
      ownerName: 'أحمد',
    },
    {
      id: 'd3',
      ownerId: 'u1',
      title: 'صفقة 3',
      accountId: 'a3',
      accountName: 'شركة 3',
      amount: 50000,
      currency: 'SAR',
      stage: 'خسارة',
      probability: 0,
      closeDate: '2026-11-05',
      ownerName: 'أحمد',
    },
  ];

  const summary = calculatePipelineSummary(sampleDeals);
  assert.equal(summary.openPipelineValue, 100000);
  assert.equal(summary.weightedPipelineValue, 50000);
  assert.equal(summary.closedWonValue, 200000);
  assert.equal(summary.winRatePercent, 50);
  assert.equal(summary.openDealsCount, 1);
});

test('evaluateFieldAccess enforces Field-Level Security over module CRUD permissions', () => {
  const profile: CrmProfile = {
    id: 'p1',
    ownerId: 'u1',
    name: 'ممثل مبيعات',
    isSystem: false,
    modulePermissions: {
      leads: { create: true, read: true, update: true, delete: false },
      contacts: { create: true, read: true, update: true, delete: false },
      accounts: { create: false, read: true, update: false, delete: false },
      deals: { create: true, read: true, update: true, delete: false },
      quotes: { create: true, read: true, update: true, delete: false },
      sales_orders: { create: false, read: true, update: false, delete: false },
      invoices: { create: false, read: false, update: false, delete: false },
      tasks: { create: true, read: true, update: true, delete: true },
    },
    fieldSecurity: {
      deals: {
        amount: 'read_only',
        internalMargin: 'hidden',
      },
    },
  };

  assert.equal(evaluateFieldAccess(profile, 'deals', 'amount'), 'read_only');
  assert.equal(evaluateFieldAccess(profile, 'deals', 'internalMargin'), 'hidden');
  assert.equal(evaluateFieldAccess(profile, 'deals', 'title'), 'read_write');
  assert.equal(evaluateFieldAccess(profile, 'invoices', 'totalAmount'), 'hidden');
});

test('validateQuickDealInput rejects empty or negative fields and passes valid input', () => {
  const bad = validateQuickDealInput({ title: '', accountId: '', amount: -10, closeDate: '' });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.title);
  assert.ok(bad.errors.accountId);
  assert.ok(bad.errors.amount);
  assert.ok(bad.errors.closeDate);

  const good = validateQuickDealInput({
    title: 'توريد منظومة سحابية',
    accountId: 'acc_1',
    amount: 250000,
    closeDate: '2026-12-20',
  });
  assert.equal(good.valid, true);
  assert.deepEqual(good.errors, {});
});
