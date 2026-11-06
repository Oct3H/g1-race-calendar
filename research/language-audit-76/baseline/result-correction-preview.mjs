// Fictional, in-memory review only. No network or persistent wallet.
import { grossReturn, recordRaceResult } from './game-state.mjs?v=43';
import { recordPreviewRaceChange } from './race-change-state.mjs?v=41';

export function correctionImpact(state, raceId) {
  const history = state.resultCorrections?.[raceId];
  const latest = history?.versions.at(-1);
  if (!latest) return null;
  const rows = state.tickets.filter(ticket => ticket.raceId === raceId && ['won', 'lost'].includes(ticket.status)).map(ticket => {
    const won = latest.winners.includes(ticket.horseNumber);
    const nextReturn = won ? grossReturn(ticket.amount, ticket.odds, latest.winners.length) : 0;
    return { ticket, beforeReturn: ticket.returned, nextReturn, delta: nextReturn - ticket.returned };
  });
  return { latest, rows, delta: rows.reduce((sum, row) => sum + row.delta, 0) };
}

export function hasUnreadCorrection(state, raceId) {
  const impact = correctionImpact(state, raceId);
  return Boolean(impact && state.resultCorrections[raceId].appliedId !== impact.latest.id && impact.rows.some(row => row.delta !== 0));
}

export function recordResultCorrection(state, race, update) {
  const winners = [...new Set(update.winners)].sort((a, b) => a - b);
  if (!update.id || !update.source || !Number.isFinite(Date.parse(update.at)) || !winners.length || winners.some(number => !Number.isSafeInteger(number) || number < 1)) throw new Error('更正资料不完整');
  const history = state.resultCorrections?.[race.id];
  if (history?.versions.some(version => version.id === update.id)) return false;
  if (history?.versions.length && Date.parse(update.at) <= Date.parse(history.versions.at(-1).at)) throw new Error('更正版本不是较新的记录');
  const before = race.sampleWinnerNumbers || [race.sampleWinnerNumber];
  if ([...before].sort((a, b) => a - b).join(',') === winners.join(',')) return false;
  state.resultCorrections ||= {};
  state.resultCorrections[race.id] ||= { versions: [], adjustments: [] };
  state.resultCorrections[race.id].versions.push({ ...update, winners });
  race.sampleWinnerNumbers = [...winners];
  race.sampleWinnerNumber = winners[0];
  race.sampleFinished = true;
  recordRaceResult(state, race.id, winners); // Unviewed first settlements use the latest official result.
  recordPreviewRaceChange(race, { kind: 'updated', updatedAt: update.at, fields: [{ label: '正式冠军马号', before: before.join('、'), after: winners.join('、') }] });
  return true;
}

export function applyResultCorrection(state, raceId, viewedAt) {
  const impact = correctionImpact(state, raceId);
  if (!impact) return null;
  const history = state.resultCorrections[raceId];
  if (history.appliedId === impact.latest.id) return null;
  const beforeCash = state.cash;
  const afterCash = Math.max(0, beforeCash + impact.delta);
  const receipt = {
    id: impact.latest.id, at: viewedAt, source: impact.latest.source,
    beforeCash, afterCash, expectedDelta: impact.delta, actualDelta: afterCash - beforeCash,
    waived: Math.max(0, -(beforeCash + impact.delta)),
    bankrupt: impact.delta < 0 && afterCash === 0,
    rows: impact.rows.map(row => ({ id: row.ticket.id, horseNumber: row.ticket.horseNumber, horseName: row.ticket.horseName, amount: row.ticket.amount, odds: row.ticket.odds, beforeReturn: row.beforeReturn, nextReturn: row.nextReturn, delta: row.delta }))
  };
  for (const row of impact.rows) {
    const ticket = row.ticket;
    ticket.originalSettlement ||= { returned: ticket.returned, profit: ticket.profit, status: ticket.status, winnerNumbers: [...ticket.winnerNumbers] };
    const won = impact.latest.winners.includes(ticket.horseNumber);
    ticket.status = won ? 'won' : 'lost';
    ticket.winnerNumbers = [...impact.latest.winners];
    ticket.deadHeatCount = won ? impact.latest.winners.length : 0;
    ticket.singleWinnerReturn = won ? grossReturn(ticket.amount, ticket.odds) : 0;
    ticket.returned = row.nextReturn;
    ticket.profit = row.nextReturn - ticket.amount;
    ticket.correctionHistory ||= [];
    ticket.correctionHistory.push({ id: receipt.id, at: receipt.at, beforeReturn: row.beforeReturn, nextReturn: row.nextReturn, delta: row.delta });
  }
  state.cash = afterCash;
  if (receipt.bankrupt) state.correctionBankrupt = true;
  history.appliedId = impact.latest.id;
  history.adjustments.push(receipt);
  return receipt;
}
