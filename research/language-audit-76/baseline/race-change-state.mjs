// In-memory design examples only; no source discovery or official feed is connected.
const fields = { startAt: '发走时间', place: '赛场', distance: '距离', surface: '场地类型' };
const runnerFields = { number: '马号', jockey: '骑师', weight: '负重' };
const known = value => value !== undefined && value !== null && value !== '';
const same = (a, b) => String(a) === String(b);
const runnerList = runners => [...runners].sort((a, b) => a.id.localeCompare(b.id)).map(runner => runner.id).join(',');

export function recordPreviewRaceChange(race, change) {
  const snapshot = record => structuredClone({ ...record, raceStartAt: record.raceStartAt ?? race.startAt, withdrawnNumbers: record.withdrawnNumbers ?? race.sampleWithdrawnNumbers ?? [] });
  if (race.sampleChange) race.sampleChangeHistory = [snapshot(race.sampleChange), ...(race.sampleChangeHistory || [])];
  race.sampleChange = snapshot({ ...change, read: false });
}

export function applyPreviewRaceUpdate(race, patch, updatedAt) {
  const changes = [];
  function compare(label, before, after) {
    // First publication or filling a missing field is ordinary information, not a revision.
    if (known(before) && known(after) && !same(before, after)) changes.push({ label, before, after });
  }
  for (const [key, label] of Object.entries(fields)) {
    const before = key === 'startAt' && race[key] ? new Date(race[key]).toISOString() : race[key];
    const after = key === 'startAt' && patch[key] ? new Date(patch[key]).toISOString() : patch[key];
    compare(label, before, after);
  }
  if (typeof patch.sampleCancelled === 'boolean') compare('赛事取消状态', Boolean(race.sampleCancelled), patch.sampleCancelled);
  if (Array.isArray(patch.sampleWithdrawnNumbers)) {
    const list = values => [...values].sort((a, b) => a - b).join('、') || '无';
    compare('退赛马号', list(race.sampleWithdrawnNumbers || []), list(patch.sampleWithdrawnNumbers));
  }
  // The demo supplies complete confirmed lists with stable fictional horse IDs.
  // Unknown/partial lists are not taken as removals; real source identity matching is separate work.
  if (race.sampleEntriesConfirmed && patch.sampleEntriesConfirmed !== false && Array.isArray(race.sampleRunners) && Array.isArray(patch.sampleRunners)) {
    const before = race.sampleRunners;
    const after = patch.sampleRunners;
    if (runnerList(before) !== runnerList(after)) changes.push({ label: '确认出走名单', before: before.map(runner => runner.name).join('、'), after: after.map(runner => runner.name).join('、') });
    for (const runner of after) {
      const old = before.find(item => item.id === runner.id);
      if (old) for (const [key, label] of Object.entries(runnerFields)) compare(`${runner.name} · ${label}`, old[key], runner[key]);
    }
  }
  if (changes.length) {
    const withdrawn = changes.some(change => change.label === '退赛马号') && patch.sampleWithdrawnNumbers?.length;
    recordPreviewRaceChange(race, { kind: patch.sampleCancelled === true ? 'cancelled' : withdrawn ? 'withdrawn' : 'updated', fields: changes, updatedAt, raceStartAt: patch.startAt ?? race.startAt, withdrawnNumbers: patch.sampleWithdrawnNumbers ?? race.sampleWithdrawnNumbers ?? [] });
  }
  for (const [key, value] of Object.entries(patch)) if (known(value)) race[key] = structuredClone(value);
  return changes;
}
