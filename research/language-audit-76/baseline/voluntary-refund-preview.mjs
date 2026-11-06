// Proposed local-game rule only; the ordinary UI does not enable this feature.
import { dayKey } from './game-state.mjs?v=43';

export function voluntaryRefundBlockReason(ticket, race, now, timeZone) {
  if (ticket.status !== 'pending') return ticket.status === 'void' ? '本张已退款，不可重复申请' : '本张已结算，不可申请退款';
  if (ticket.confirmedWinners || race.sampleFinished) return '赛果已确认，不可主动退款';
  if (race.sampleCancelled || race.sampleWithdrawnNumbers?.includes(ticket.horseNumber)) return '已确认官方取消或退赛，等待自动退款';
  if (!race.startAt) return '比赛日期尚未确认，暂不可主动退款';
  const [year, month, day] = dayKey(new Date(race.startAt), timeZone).split('-').map(Number);
  const cutoffDay = new Date(Date.UTC(year, month - 1, day - 2)).toISOString().slice(0, 10);
  if (dayKey(now, timeZone) >= cutoffDay) return '比赛当天及前 2 个日历日不可主动退款，过去赛事也不可退款';
  return '';
}

export function refundPreviewTicket(state, ticketId, race, now, timeZone) {
  const ticket = state.tickets.find(item => item.id === ticketId);
  if (!ticket || ticket.raceId !== race.id) throw new Error('未找到本张马券');
  if (ticket.status === 'void' && ticket.voidReason === 'voluntary') return ticket;
  const blocked = voluntaryRefundBlockReason(ticket, race, now, timeZone);
  if (blocked) throw new Error(blocked);
  ticket.status = 'void';
  ticket.voidReason = 'voluntary';
  ticket.returned = ticket.amount;
  ticket.profit = 0;
  ticket.refundedAt = now.toISOString();
  ticket.read = true;
  state.cash += ticket.amount;
  return ticket;
}
