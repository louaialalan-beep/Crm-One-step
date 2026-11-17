import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { buildSeedDataset } from '../data/seedData';
import {
  aggregateDealsForChart,
  computeDealPipelineMetrics,
  DEFAULT_DEAL_DOCKED_FILTER,
  filterDeals,
  getBlueprintTransitionRequirements,
  getDealColumnForStage,
  getNextAdvanceStage,
  resolveDealLastTouchAttribution,
} from './dealsLogic';

const seed = buildSeedDataset('test_owner');

describe('dealsLogic domain utilities', () => {
  it('maps all 6 underlying stages cleanly onto the 5 Kanban columns', () => {
    assert.equal(getDealColumnForStage('تأهيل مبدئي').id, 'qualifying');
    assert.equal(getDealColumnForStage('تحديد الاحتياج').id, 'qualifying');
    assert.equal(getDealColumnForStage('عرض سعر').id, 'proposal');
    assert.equal(getDealColumnForStage('تفاوض').id, 'negotiation');
    assert.equal(getDealColumnForStage('مكتملة').id, 'won');
    assert.equal(getDealColumnForStage('خسارة').id, 'lost');
  });

  it('advances deal stages sequentially via 1-click arrow helper', () => {
    assert.equal(getNextAdvanceStage('تأهيل مبدئي'), 'عرض سعر');
    assert.equal(getNextAdvanceStage('عرض سعر'), 'تفاوض');
    assert.equal(getNextAdvanceStage('تفاوض'), 'مكتملة');
    assert.equal(getNextAdvanceStage('مكتملة'), null);
    assert.equal(getNextAdvanceStage('خسارة'), null);
  });

  it('enforces Blueprint mandatory During fields when moving to مكتملة or تفاوض', () => {
    const toWon = getBlueprintTransitionRequirements(seed.blueprints, 'مكتملة');
    assert.equal(toWon.requiresModal, true);
    assert.equal(toWon.requireFinalAmount, true);
    assert.equal(toWon.requireDiscountPercent, true);
    assert.equal(toWon.requireContractPdf, true);
    assert.ok(toWon.checklistItems.length >= 2);

    const toQualifying = getBlueprintTransitionRequirements(seed.blueprints, 'تأهيل مبدئي');
    assert.equal(toQualifying.requiresModal, false);
  });

  it('computes pipeline totals, weighted revenue, and Last-Touch attribution', () => {
    const metrics = computeDealPipelineMetrics(seed.deals);
    assert.ok(metrics.totalPipelineValue > 0);
    assert.ok(metrics.weightedPipelineValue > 0);
    assert.ok(metrics.weightedRatioPercent > 0);

    const attr = resolveDealLastTouchAttribution(
      seed.deals[0],
      seed.contacts,
      seed.touchpoints
    );
    assert.ok(attr.length > 0);
  });

  it('filters deals by pipeline, quick filters, and aggregates chart buckets', () => {
    const myDeals = filterDeals(seed.deals, seed.contacts, seed.touchpoints, {
      pipeline: 'all',
      quickFilter: 'my_deals',
      currentUserName: 'سلمان عبد العزيز القحطاني',
      searchQuery: '',
      dockedFilter: DEFAULT_DEAL_DOCKED_FILTER,
    });
    assert.ok(myDeals.length > 0);

    const buckets = aggregateDealsForChart(
      seed.deals,
      seed.contacts,
      seed.touchpoints,
      'stage',
      'amount'
    );
    assert.ok(buckets.length >= 3);
  });
});
