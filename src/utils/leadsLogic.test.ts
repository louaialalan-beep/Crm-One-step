import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSeedDataset } from '../data/seedData.ts';
import {
  aggregateLeadsForChart,
  computeVelocityMetrics,
  DEFAULT_DOCKED_FILTER,
  exportLeadsToCsv,
  filterLeads,
  filterLeadsByChartTimeRange,
  findDuplicateLeads,
  findLiveDuplicatesForInput,
  isMyLead,
  isValidEmailFormat,
  isValidSaudiWhatsappPhone,
  normalizePhone,
  parseLeadsCsv,
  pickRoundRobinOwner,
} from './leadsLogic.ts';

describe('leadsLogic domain utilities', () => {
  const seed = buildSeedDataset('test-owner');

  it('normalizes Saudi phone numbers consistently for duplicate detection', () => {
    assert.equal(normalizePhone('+966 55 987 6543'), '966559876543');
    assert.equal(normalizePhone('0559876543'), '966559876543');
    assert.equal(normalizePhone('00966-55-987-6543'), '966559876543');
  });

  it('detects seeded duplicate phone and email pairs accurately', () => {
    const result = findDuplicateLeads(seed.leads);
    assert.ok(result.duplicateLeadIds.has('lead_6'));
    assert.ok(result.duplicateLeadIds.has('lead_7'));
    assert.ok(result.duplicateLeadIds.has('lead_2'));
    assert.ok(result.duplicateLeadIds.has('lead_9'));
    assert.ok(result.groups.length >= 2);
  });

  it('detects live duplicates when typing matching phone or email', () => {
    const matches = findLiveDuplicatesForInput(seed.leads, {
      phone: '0559876543',
      email: '',
    });
    assert.equal(matches.length, 2);
    assert.ok(matches.some((m) => m.lead.id === 'lead_6'));
  });

  it('matches "عملائي" across full and short Arabic display names', () => {
    assert.equal(isMyLead('سلمان القحطاني', 'سلمان عبد العزيز القحطاني'), true);
    assert.equal(isMyLead('نورة السبيعي', 'سلمان عبد العزيز القحطاني'), false);
  });

  it('filters leads by quick filters and inline docked AND/OR rules', () => {
    const myLeads = filterLeads(seed.leads, {
      quickFilter: 'my_leads',
      currentUserName: 'سلمان عبد العزيز القحطاني',
      searchQuery: '',
      dockedFilter: DEFAULT_DOCKED_FILTER,
    });
    assert.ok(myLeads.length >= 4);
    assert.ok(myLeads.every((l) => l.assignedToName === 'سلمان القحطاني'));

    const slaWhatsapp = filterLeads(seed.leads, {
      quickFilter: 'all',
      currentUserName: 'سلمان عبد العزيز القحطاني',
      searchQuery: '',
      dockedFilter: {
        ...DEFAULT_DOCKED_FILTER,
        channels: ['whatsapp'],
        slaOnly: true,
        logicOperator: 'AND',
      },
    });
    assert.ok(slaWhatsapp.length >= 2);
    assert.ok(
      slaWhatsapp.every((l) => l.channel === 'whatsapp' && (l.awaitingReplyHours ?? 0) > 2)
    );

    const orFiltered = filterLeads(seed.leads, {
      quickFilter: 'all',
      currentUserName: 'سلمان عبد العزيز القحطاني',
      searchQuery: '',
      dockedFilter: {
        ...DEFAULT_DOCKED_FILTER,
        channels: ['messenger'],
        stages: ['غير مهتم'],
        logicOperator: 'OR',
      },
    });
    assert.ok(orFiltered.some((l) => l.channel === 'messenger'));
    assert.ok(orFiltered.some((l) => l.status === 'غير مهتم'));
  });

  it('round-trips CSV export and Arabic/English CSV parsing cleanly', () => {
    const csv = exportLeadsToCsv(seed.leads.slice(0, 2));
    assert.ok(csv.startsWith('\uFEFF'));
    const parsed = parseLeadsCsv(csv);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].fullName, seed.leads[0].fullName);
    assert.equal(parsed[0].phone, seed.leads[0].phone);
    assert.equal(parsed[0].city, seed.leads[0].city);
    assert.equal(parsed[0].source, seed.leads[0].source);
    assert.equal(parsed[0].channel, 'whatsapp');
  });

  it('aggregates chart buckets (including city) and filters by time range accurately', () => {
    const byStage = aggregateLeadsForChart(seed.leads, 'status', 'count');
    assert.equal(
      byStage.reduce((sum, b) => sum + b.count, 0),
      seed.leads.length
    );

    const byCity = aggregateLeadsForChart(seed.leads, 'city', 'avgAiScore');
    assert.ok(byCity.some((b) => b.key === 'الرياض'));
    assert.ok(byCity.some((b) => b.key === 'جدة'));

    const todayActivity = filterLeadsByChartTimeRange(seed.leads, 'lastActivity', 'today');
    assert.ok(todayActivity.length > 0 && todayActivity.length < seed.leads.length);

    const byChannelValue = aggregateLeadsForChart(seed.leads, 'channel', 'estimatedValue');
    assert.ok(byChannelValue.length >= 4);
    assert.ok(byChannelValue[0].value >= byChannelValue[byChannelValue.length - 1].value);

    const metrics = computeVelocityMetrics(seed.leads);
    assert.equal(metrics.totalCount, seed.leads.length);
    assert.ok(metrics.conversionRatePercent > 0);
    assert.ok(metrics.awaitingReplyCount >= 4);
  });

  it('picks balanced Round-Robin owner and validates Saudi WhatsApp phones and emails', () => {
    const picked = pickRoundRobinOwner(seed.leads);
    assert.equal(picked, 'طارق الدوسري');
    assert.equal(isValidSaudiWhatsappPhone('50 123 4567'), true);
    assert.equal(isValidSaudiWhatsappPhone('+966 55 987 6543'), true);
    assert.equal(isValidSaudiWhatsappPhone('1234'), false);
    assert.equal(isValidEmailFormat('a.otaibi@ofuqu.sa'), true);
    assert.equal(isValidEmailFormat('invalid-email'), false);
  });
});
