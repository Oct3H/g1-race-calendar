// In-memory design preview only. This module never contacts racing/betting sites.
export function createState() {
  return { cash: 500000, bank: 0, bankDays: 0, tickets: [], nextId: 1 };
}

export function addBankDays(state, days) {
  if (!Number.isSafeInteger(days) || days < 0) throw new Error('累计天数无效');
  if (state.shopActivated === false) return;
  state.bank = Math.min(1000000, state.bank + days * 10000);
  state.bankDays += days;
}

export function withdraw(state, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > state.bank) throw new Error('请输入银行余额以内的整数金额');
  state.bank -= amount;
  state.cash += amount;
}

export function dayKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}

export function withinBetWindow(race, now, timeZone) {
  if (!race.startAt) return false;
  const today = dayKey(now, timeZone);
  const [year, month, day] = today.split('-').map(Number);
  // 按电脑时区的日历日期计 30 天，不受夏令时或一天的小时数影响。
  const lastDay = new Date(Date.UTC(year, month - 1, day + 30)).toISOString().slice(0, 10);
  const raceDay = dayKey(new Date(race.startAt), timeZone);
  return raceDay > today && raceDay <= lastDay;
}

export function bettingBlockReason(race, now, timeZone) {
  if (race.sampleCancelled) return '赛事已取消';
  if (race.sampleFinished) return '赛事已结束';
  if (!race.startAt) return '发走时间待公布';
  if (dayKey(new Date(race.startAt), timeZone) <= dayKey(now, timeZone)) return '比赛当日及过去日期不可购买';
  if (!withinBetWindow(race, now, timeZone)) return '仅可购买未来 30 天内的赛事';
  if (race.sampleEntriesConfirmed !== true) return '出走名单尚未确认';
  if (race.sampleOfficialOdds !== true || !race.sampleOddsSource?.trim()) return '官方单胜赔率尚未取得';
  return '';
}

export function canBet(race, now, timeZone) {
  return bettingBlockReason(race, now, timeZone) === '';
}

export function grossReturn(amount, odds, shares = 1) {
  if (!/^\d+(\.\d+)?$/.test(String(odds)) || Number(odds) < 1) throw new Error('没有可用的倍率');
  if (!Number.isSafeInteger(shares) || shares < 1) throw new Error('并列冠军数量无效');
  const [whole, fraction = ''] = String(odds).split('.');
  // Preserve the locked decimal exactly, divide by champion count, then floor once to whole yen.
  return Number(BigInt(amount) * BigInt(whole + fraction) / ((10n ** BigInt(fraction.length)) * BigInt(shares)));
}

export function placeTicket(state, race, horse, amount, now, timeZone) {
  if (race.sampleCancelled) throw new Error('赛事已取消，不能购买马券');
  if (race.sampleWithdrawnNumbers?.includes(horse.number)) throw new Error('所选马匹已退赛，请重新选择');
  const blocked = bettingBlockReason(race, now, timeZone);
  if (blocked) throw new Error(blocked);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > state.cash) throw new Error('请输入可用资金以内的整数金额');
  grossReturn(amount, horse.odds);
  const ticket = { id: state.nextId++, raceId: race.id, horseNumber: horse.number, horseName: horse.name, amount, odds: String(horse.odds), source: race.sampleOddsSource, oddsAt: race.sampleOddsAt, placedAt: now.toISOString(), status: 'pending', read: false };
  state.cash -= amount;
  state.tickets.push(ticket);
  return ticket;
}

function confirmedWinnerNumbers(winnerNumber) {
  const winners = [...new Set(Array.isArray(winnerNumber) ? winnerNumber : [winnerNumber])];
  if (!winners.length || winners.some(number => !Number.isSafeInteger(number) || number < 1)) throw new Error('冠军马号无效');
  return winners;
}

export function recordRaceResult(state, raceId, winnerNumber) {
  const winners = confirmedWinnerNumbers(winnerNumber);
  for (const ticket of state.tickets.filter(item => item.raceId === raceId && item.status === 'pending')) {
    ticket.confirmedWinners = [...winners];
  }
}

export function settleRace(state, raceId, winnerNumber) {
  const supplied = winnerNumber === undefined ? null : confirmedWinnerNumbers(winnerNumber);
  for (const ticket of state.tickets.filter(item => item.raceId === raceId && item.status === 'pending')) {
    const winners = supplied || ticket.confirmedWinners;
    if (!winners) continue;
    const won = winners.includes(ticket.horseNumber);
    ticket.status = won ? 'won' : 'lost';
    ticket.winnerNumbers = [...winners];
    ticket.deadHeatCount = won ? winners.length : 0;
    ticket.singleWinnerReturn = won ? grossReturn(ticket.amount, ticket.odds) : 0;
    ticket.returned = won ? grossReturn(ticket.amount, ticket.odds, winners.length) : 0;
    ticket.profit = ticket.returned - ticket.amount;
    ticket.read = false;
    state.cash += ticket.returned;
  }
}

export function refundTickets(state, raceId, reason, horseNumber = null) {
  if (!['cancelled', 'withdrawn'].includes(reason)) throw new Error('退款原因无效');
  if (reason === 'withdrawn' && (!Number.isSafeInteger(horseNumber) || horseNumber < 1)) throw new Error('退赛马号无效');
  for (const ticket of state.tickets.filter(item => item.raceId === raceId && item.status === 'pending' && (reason === 'cancelled' || item.horseNumber === horseNumber))) {
    ticket.status = 'void';
    ticket.voidReason = reason;
    ticket.returned = ticket.amount;
    ticket.profit = 0;
    ticket.read = false;
    state.cash += ticket.amount;
  }
}

// 固定历史订单仅用于退款界面评审，与结算示例一样在内存中替换演示记录。
export function pendingRefundExample(raceId, horses) {
  const state = createState();
  for (const [index, amount] of [[0, 10000], [1, 20000]]) {
    const horse = horses[index];
    state.cash -= amount;
    state.tickets.push({ id: state.nextId++, raceId, horseNumber: horse.number, horseName: horse.name, amount, odds: String(horse.odds), source: '虚构出马表 · 退款演示', placedAt: '2026-10-17T03:00:00Z', status: 'pending', read: false });
  }
  return state;
}

export function refundExample(reason, raceId, horses) {
  const state = pendingRefundExample(raceId, horses);
  refundTickets(state, raceId, reason, 2);
  return state;
}

export function applyRaceChanges(state, races) {
  for (const race of races) {
    if (race.sampleCancelled) refundTickets(state, race.id, 'cancelled');
    else for (const number of race.sampleWithdrawnNumbers || []) refundTickets(state, race.id, 'withdrawn', number);
  }
}

export function unreadRefundRaceIds(state) {
  return [...new Set(state.tickets.filter(ticket => ticket.status === 'void' && !ticket.read).map(ticket => ticket.raceId))];
}

export function unreadForRace(state, raceId) {
  return state.tickets.filter(ticket => ticket.raceId === raceId && (ticket.status !== 'pending' || ticket.confirmedWinners) && !ticket.read);
}

export function markRead(state, raceId, ticketIds = null) {
  state.tickets.filter(ticket => ticket.raceId === raceId && ticket.status !== 'pending' && (!ticketIds || ticketIds.includes(ticket.id))).forEach(ticket => { ticket.read = true; });
}

export function settlementExample(kind, raceId, horses) {
  const state = createState();
  const choices = kind === 'broke' ? [[0, 200000], [2, 150000], [3, 150000]] : [[0, 10000]];
  for (const [index, amount] of choices) {
    const horse = horses[index];
    state.cash -= amount;
    state.tickets.push({ id: state.nextId++, raceId, horseNumber: horse.number, horseName: horse.name, amount, odds: String(horse.odds), source: '虚构出马表 · 结算演示', placedAt: '2026-10-17T03:00:00Z', status: 'pending', read: false });
  }
  if (kind === 'broke') addBankDays(state, 3);
  recordRaceResult(state, raceId, kind === 'dead-heat' ? [horses[0].number, horses[1].number] : kind === 'win' ? horses[0].number : horses[1].number);
  return state;
}
