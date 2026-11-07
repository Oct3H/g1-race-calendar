import { native } from './desktop-bridge.mjs';
import { loadHorseProfile } from './desktop-details.mjs';

// The journal records attempts, while the actual documents stay in their
// existing SQLite keys. A crash can replay an attempt without duplicating data.
export function createCollection(data, onChange) {
  const today = new Date().toLocaleDateString('sv-SE');
  const currentYear = Number(today.slice(0, 4));
  const dateYears = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear + 1, currentYear + 2];
  const detailYears = dateYears.slice(0, 3);
  const state = data.collectionState;
  if (state.day !== today) {
    state.day = today;
    state.dates = {};
    for (const entry of Object.values(state.years || {})) {
      if (!entry.requested) { entry.races = {}; entry.horses = {}; }
    }
  }
  state.dates ??= {};
  state.years ??= {};
  state.scheduleLaunches ??= {};
  const progress = { phase: 'idle' };
  let task;
  let forceDates = false;

  function notify(phase, year, name) {
    Object.assign(progress, { phase, year, name });
    onChange();
  }

  async function save() {
    await native('collection', JSON.stringify(state));
  }

  const requested = () => Object.keys(state.years).map(Number).filter(year => state.years[year].requested);
  const shouldStop = () => state.paused || data.offline || navigator.onLine === false;
  function totals() {
    const directories = dateYears.map(year => state.dates[year]).filter(value => value !== undefined);
    const races = Object.values(state.years).flatMap(year => Object.values(year.races));
    const horses = Object.values(state.years).flatMap(year => Object.values(year.horses));
    return {
      dates: directories.length,
      directoriesMissing: directories.reduce((sum, missing) => sum + missing, 0),
      races: races.length, horses: horses.length,
      unavailable: [...races, ...horses].filter(value => value === 'unavailable' || value === 'unsupported').length,
      failed: [...races, ...horses].filter(value => value === 'failed').length
    };
  }

  async function collectDates(year, force = false) {
    const startupDue = data.launchId && year >= currentYear && state.scheduleLaunches[year] !== data.launchId;
    force ||= Boolean(startupDue);
    const alreadyChecked = Object.hasOwn(state.dates, year) && !force;
    notify('dates', year);
    await data.schedule.collect(year, force, () => onChange(year), { localOnly: alreadyChecked });
    if (!alreadyChecked) {
      const { providers, providersExpected } = data.schedule.state(year);
      state.dates[year] = providersExpected.filter(provider => providers[provider]?.status !== 'success').length;
      if (startupDue) state.scheduleLaunches[year] = data.launchId;
      await save();
    }
  }

  async function collectDetails(year, manual) {
    const revision = await native('cacheRevision', year);
    const previous = state.years[year];
    if (revision && previous?.revision !== revision) {
      if (previous) {
        delete state.years[year];
        await save();
      }
      return;
    }
    const entry = state.years[year] = previous || { revision, races: {}, horses: {} };
    const races = data.schedule.races().filter(race => Number(race.date.slice(0, 4)) === year
      && race.id !== 'jra-2026-tenno-autumn');
    if (year === 2026) races.push(data.race);
    if (year === currentYear) {
      const day = Date.parse(today);
      races.sort((a, b) => Math.abs(Date.parse(a.date) - day) - Math.abs(Date.parse(b.date) - day));
      if (data.launchId && entry.launchId !== data.launchId) {
        for (const race of races) {
          const outcome = entry.races[race.id];
          if (outcome === 'entries' || race.date >= today) delete entry.races[race.id];
        }
        entry.launchId = data.launchId;
      }
    } else {
      races.sort((a, b) => b.date.localeCompare(a.date));
    }
    const stopped = () => shouldStop() || state.years[year] !== entry || (!manual && requested().length);

    for (const original of races) {
      if (stopped()) return;
      const race = original === data.race ? original : { ...original };
      if (!Object.hasOwn(entry.races, race.id)) {
        notify('race', year, race.name);
        let outcome;
        if (race === data.race) {
          try { outcome = (!manual && race.realResult) || await data.refresh(revision) ? 'success' : 'unavailable'; }
          catch { outcome = 'failed'; }
        } else {
          outcome = await data.details.load(race, () => {}, { reuseFinished: !manual, revision });
          if (outcome === 'success' && data.details.attach(race).realResult?.finished === false) outcome = 'entries';
        }
        if (state.years[year] !== entry) return;
        entry.races[race.id] = outcome;
        await save();
        onChange(year);
      } else if (year === currentYear && race !== data.race) {
        // A restart can occur between saving the race and fetching its horses.
        await data.details.readCached(race);
      }
      if (year !== currentYear) continue;
      for (const runner of data.details.attach(race).realResult?.runners || []) {
        if (stopped()) return;
        if (!runner.horseId || Object.hasOwn(entry.horses, runner.horseId)) continue;
        notify('horse', year, runner.name);
        let outcome;
        try {
          const profile = await loadHorseProfile(runner.horseId, runner.name, year, false, undefined, revision);
          outcome = profile.stale ? 'failed' : 'success';
        } catch { outcome = 'failed'; }
        if (state.years[year] !== entry) return;
        entry.horses[runner.horseId] = outcome;
        await save();
        onChange();
      }
    }
    if (manual && state.years[year] === entry) {
      entry.requested = false;
      await save();
    }
  }

  function run() {
    if (task || shouldStop()) return task;
    task = (async () => {
      do {
        for (const year of requested()) {
          if (shouldStop()) return;
          const entry = state.years[year];
          if (!entry.catalogChecked) {
            await collectDates(year, true);
            if (state.years[year] !== entry) continue;
            entry.catalogChecked = true;
            await save();
          } else await collectDates(year);
          if (shouldStop()) return;
          await collectDetails(year, true);
        }
        if (!data.backgroundCollection) return;
        for (const year of dateYears) {
          if (shouldStop() || requested().length) break;
          await collectDates(year, forceDates);
        }
        for (const year of detailYears) {
          if (shouldStop() || requested().length) break;
          await collectDetails(year, false);
        }
      } while (!shouldStop() && requested().length);
    })().then(() => { forceDates = false; notify('idle'); }).catch(error => {
      console.error(error);
      notify('error');
    }).finally(() => { task = null; });
    return task;
  }

  return {
    dateYears, detailYears, state, progress, totals, run,
    async check() {
      if (task || shouldStop()) return;
      for (const entry of Object.values(state.years)) {
        if (entry.requested) continue;
        for (const outcomes of [entry.races, entry.horses]) {
          for (const id of Object.keys(outcomes)) if (outcomes[id] !== 'success') delete outcomes[id];
        }
      }
      await save();
      forceDates = true;
      run();
    },
    async setPaused(paused) {
      state.paused = paused;
      await save();
      onChange();
      if (!paused) run();
    },
    async clear(year) {
      await native('clearCacheYear', year);
      delete state.years[year];
      data.details.forgetYear(year);
      if (year === 2026) data.race.realResult = null;
      await save();
      onChange(year);
    },
    async redownload(year) {
      if (state.years[year]?.requested) return;
      const revision = await native('cacheRevision', year);
      state.years[year] = { revision, requested: true, races: {}, horses: {} };
      await save();
      onChange();
      run();
    }
  };
}
