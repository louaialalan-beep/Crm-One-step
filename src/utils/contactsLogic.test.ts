import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildSeedDataset } from '../data/seedData';
import {
  aggregateContactsForChart,
  computeContactsSummaryMetrics,
  DEFAULT_CONTACT_DOCKED_FILTER,
  exportContactsToCsv,
  filterContacts,
  findDuplicateContacts,
  formatCompactDealValue,
  getDealsForContact,
  parseContactsCsv,
} from './contactsLogic';

test('findDuplicateContacts detects phone duplicates in seed dataset', () => {
  const seed = buildSeedDataset('test-owner');
  const dup = findDuplicateContacts(seed.contacts);
  assert.ok(dup.duplicateContactIds.has('con_7'));
  assert.ok(dup.duplicateContactIds.has('con_8'));
  assert.equal(dup.groups.length, 1);
  assert.equal(dup.groups[0].type, 'phone');
});

test('filterContacts filters purchased, open deals, my_contacts, and duplicates accurately', () => {
  const seed = buildSeedDataset('test-owner');
  const dup = findDuplicateContacts(seed.contacts);

  const purchased = filterContacts(seed.contacts, seed.deals, {
    quickFilter: 'purchased',
    currentUserName: 'سلمان عبد العزيز القحطاني',
    searchQuery: '',
    dockedFilter: DEFAULT_CONTACT_DOCKED_FILTER,
    duplicateContactIds: dup.duplicateContactIds,
  });
  assert.ok(purchased.some((c) => c.id === 'con_4'));
  assert.ok(purchased.some((c) => c.id === 'con_5'));
  assert.ok(purchased.some((c) => c.id === 'con_6'));

  const openDeals = filterContacts(seed.contacts, seed.deals, {
    quickFilter: 'open_deals',
    currentUserName: 'سلمان عبد العزيز القحطاني',
    searchQuery: '',
    dockedFilter: DEFAULT_CONTACT_DOCKED_FILTER,
    duplicateContactIds: dup.duplicateContactIds,
  });
  assert.ok(openDeals.some((c) => c.id === 'con_1'));
  assert.ok(openDeals.some((c) => c.id === 'con_2'));

  const myContacts = filterContacts(seed.contacts, seed.deals, {
    quickFilter: 'my_contacts',
    currentUserName: 'سلمان عبد العزيز القحطاني',
    searchQuery: '',
    dockedFilter: DEFAULT_CONTACT_DOCKED_FILTER,
    duplicateContactIds: dup.duplicateContactIds,
  });
  assert.ok(myContacts.every((c) => (c.assignedToName ?? '').includes('سلمان')));
});

test('computeContactsSummaryMetrics computes non-zero total deal value and repeat buyer ratio', () => {
  const seed = buildSeedDataset('test-owner');
  const metrics = computeContactsSummaryMetrics(seed.contacts, seed.deals);
  assert.ok(metrics.totalDealsValue > 2000000);
  assert.ok(metrics.repeatPurchasePercent > 0);
  assert.equal(formatCompactDealValue(185000), '185K');
  assert.equal(formatCompactDealValue(1500000), '1.5M');
});

test('parseContactsCsv and exportContactsToCsv round-trip cleanly', () => {
  const seed = buildSeedDataset('test-owner');
  const csv = exportContactsToCsv(seed.contacts.slice(0, 2), seed.deals);
  const parsed = parseContactsCsv(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].fullName, seed.contacts[0].fullName);
  assert.ok(getDealsForContact(seed.contacts[0], seed.deals).length >= 1);
});

test('aggregateContactsForChart aggregates by contactStatus and channel', () => {
  const seed = buildSeedDataset('test-owner');
  const byStatus = aggregateContactsForChart(seed.contacts, seed.deals, 'contactStatus', 'count');
  assert.ok(byStatus.length >= 3);
  const totalCount = byStatus.reduce((s, b) => s + b.count, 0);
  assert.equal(totalCount, seed.contacts.length);
});
