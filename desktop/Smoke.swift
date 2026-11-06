import AppKit
import WebKit

extension Desktop {
    func runSmoke(_ web: WKWebView) {
        guard let url = web.url, let path = server.localPath(url), let smoke else { fail("Unexpected web URL \(web.url?.absoluteString ?? "nil")"); return }
        let key = path + (url.query ?? "")
        tested.insert(key)
        let script: String
        if path == "/welcome.html" {
            guard ["fresh", "schedule", "details", "history-future", "audit-history", "horse-ui"].contains(smoke) else { fail("Language was not saved"); return }
            script = """
            await until(() => document.body?.dataset.desktop === 'dev' && document.querySelector('#welcome-form'));
            select('zh');
            await until(() => !q('#welcome-continue').disabled);
            assert(q('#welcome-form input:checked').value === 'zh', 'Onboarding selected the wrong language');
            q('#welcome-continue').click();
            return 'onboarding → zh';
            """
        } else if smoke == "horse-ui" {
            script = """
            await until(() => document.querySelector('.workspace-status'));
            const {renderLiveHorse} = await import('./desktop-view.mjs');
            const {showDetailMascot,clearDetailMascot} = await import('./detail-mascot.mjs');
            const {race,runner} = await (await fetch('data/horse-ui-review.json')).json();
            q('#race-dialog').dataset.liveRace = '';
            renderLiveHorse(race,runner,true,rank=>rank===1?'win':rank<=5?'placed':'other',()=>{});
            q('#race-dialog').showModal();
            const rows=[...document.querySelectorAll('#horse-form-list li')];
            assert(rows.length===5,'Missing recent starts');
            assert(q('.history-race-title').getBoundingClientRect().width>180,'Race title squeezed into the old icon column');
            assert(rows.every(row=>row.getBoundingClientRect().height<130),'History cards are too tall');
            assert(q('.history-race-meta').textContent.includes('團野大'),'Incorrect history jockey');
            assert(q('.history-race-time').textContent==='1:22.9','Incorrect history time');
            assert(getComputedStyle(rows[0]).backgroundImage.includes('linear-gradient'),'Finish gradient missing');
            const mascot=q('#horse-load-mascot');
            showDetailMascot(mascot,'test-run','loading');
            assert(getComputedStyle(q('#horse-load-mascot .tachyon-sprite')).animationName.includes('tachyon-run'),'Running animation missing');
            showDetailMascot(mascot,'test-run','complete');
            assert(getComputedStyle(q('#horse-load-mascot .tachyon-sprite')).animationName.includes('tachyon-jump'),'Completion jump missing');
            showDetailMascot(mascot,'test-cached','idle');
            assert(mascot.dataset.state==='idle','Cached profile should stand ready');
            const image=new Image();image.src='assets/agnes-tachyon-status-sprites-v1.png';await image.decode();
            assert(image.naturalWidth>1000,'Sprite asset missing from native bundle');
            clearDetailMascot(mascot);
            return JSON.stringify({horseUIPassed:true});
            """
        } else if smoke == "audit-history" {
            script = """
            const {createDetails} = await import('./desktop-details.mjs');
            const archive = await (await fetch('./data/races-2025.json')).json();
            const codes = {JPN:'JP',ENG:'GB',USA:'US',AUS:'AU',GER:'DE',IRE:'IE',UAE:'AE',KSA:'SA',SAF:'ZA'};
            const cases = archive.races.filter(row => row.country === 'JPN' || row.rank != null).map(row => ({
                id:row.id,name:row.name,date:row.date,sourceEnglish:row.canonical_name,country:codes[row.country] || row.country,
                scheduleURL:row.source_url,scheduleSource:row.country==='JPN' ? row.source_url.includes('keiba.go.jp') ? 'nar' : 'jra' : 'archive'
            }));
            const selected = cases.filter(race => (!auditCountry || race.country===auditCountry) && (!auditIds || auditIds.split(',').includes(race.id)));
            cases.splice(0,cases.length,...selected);
            const total = cases.length;
            const service = createDetails(false);
            const records = [];
            const worker = async () => {
                while (cases.length) {
                    const race = cases.shift();
                    const started = Date.now();
                    try {
                        await service.load(race, () => {});
                        records.push({name:race.name,sourceEnglish:race.sourceEnglish,country:race.country,date:race.date,runners:race.realResult?.runners.length || 0,url:race.realResult?.url,
                          seconds:(Date.now()-started)/1000,status:race.refreshState,error:race.detailError,failureKind:race.failureKind,attempts:race.lookup.attempts,misses:race.lookup.misses});
                    } catch (error) {
                        records.push({name:race.name,date:race.date,seconds:(Date.now()-started)/1000,status:'failed',error:String(error.message)});
                    }
                }
            };
            await Promise.all([worker(),worker()]);
            return JSON.stringify({auditPassed:records.length===total && records.every(row => row.status==='success'),total,records});
            """
        } else if smoke == "history-future" {
            script = """
            await until(() => document.querySelector('.workspace-status'));
            const jump = (year, month) => {
                q('#calendar-jump').click();
                q('#calendar-year-input').value = year;
                q('#calendar-year-input').dispatchEvent(new Event('input', {bubbles:true}));
                q(`[data-calendar-month="${month}"]`).click();
            };
            jump(2024,12);
            await until(() => [...document.querySelectorAll('[data-date="2024-12-22"] .race-card')].some(card => card.textContent.includes('有馬記念')), '2024 calendar');
            [...document.querySelectorAll('[data-date="2024-12-22"] .race-card')].find(card => card.textContent.includes('有馬記念')).click();
            await until(() => q('#entry-rows').rows.length===16, '2024 Arima results including scratched runner');
            assert(q('#entry-rows').textContent.includes('Regaleira') && q('#entry-rows').textContent.includes('SCR'), '2024 result or scratch missing');
            q('#race-dialog .close-button').click();
            jump(2015,12);
            await until(() => [...document.querySelectorAll('[data-date="2015-12-27"] .race-card')].some(card => card.textContent.includes('有馬記念')), 'Legacy 2015 calendar');
            [...document.querySelectorAll('[data-date="2015-12-27"] .race-card')].find(card => card.textContent.includes('有馬記念')).click();
            await until(() => q('#entry-rows').rows.length===16, 'Legacy 2015 result table');
            assert(q('#entry-rows').textContent.includes('Gold Actor'), '2015 winner missing');
            q('#race-dialog .close-button').click();
            jump(2025,12);
            [...document.querySelectorAll('[data-date="2025-12-27"] .race-card')].find(card => card.textContent.includes('ホープフル')).click();
            await until(() => q('#entry-rows').rows.length===16, '2025 suffixed result URL');
            assert(q('.source-placeholder a').href.endsWith('251227-03.html'), 'Result link suffix not discovered');
            q('#race-dialog .close-button').click();
            jump(2026,11);
            const future = [...document.querySelectorAll('[data-date="2026-11-07"] .race-card')].find(card => /Champions Mile/.test(card.textContent));
            assert(future,'Future Australian race missing');
            future.click();
            await until(() => q('#entry-rows').rows.length===9, 'Genuine future declarations');
            assert(q('#race-dialog').dataset.raceView==='entries', 'Future race was displayed as a completed result');
            assert(q('#race-quality-time').textContent.includes('本次查询'), 'Query duration missing');
            return JSON.stringify({historyFuturePassed:true});
            """
        } else if smoke == "details" || smoke == "details-offline" {
            script = """
            await until(() => document.querySelector('.workspace-status'));
            const jump = (year, month) => {
                q('#calendar-jump').click();
                const input = q('#calendar-year-input');
                input.value = year;
                input.dispatchEvent(new Event('input', {bubbles:true}));
                q(`[data-calendar-month="${month}"]`).click();
            };
            jump(2023, 12);
            await until(() => [...document.querySelectorAll('[data-date="2023-12-10"] .race-card')].some(card => /Hong Kong Cup|香港[盃杯]/i.test(card.textContent)), '2023 HK Cup schedule');
            [...document.querySelectorAll('[data-date="2023-12-10"] .race-card')].find(card => /Hong Kong Cup|香港[盃杯]/i.test(card.textContent)).click();
            await until(() => q('#entry-rows').rows.length === 11, 'HK Cup results must contain eleven real starters');
            assert(q('#race-dialog').dataset.raceView === 'results', 'Past race did not default to results');
            assert(q('#entry-rows').textContent.includes('浪漫勇士'), 'HK result runner missing');
            const horseButton = [...document.querySelectorAll('#entry-rows .horse-name-button')].find(button => button.textContent.includes('浪漫勇士'));
            assert(horseButton, 'Real horse has no profile button');
            horseButton.click();
            await until(() => q('#horse-sire').textContent.includes('Acclamation'), 'Real horse pedigree');
            assert(q('#horse-dam').textContent.includes('Folk Melody'), 'Dam missing');
            assert(q('#horse-damsire').textContent.includes('Street Cry'), 'Dam sire missing');
            await until(() => document.querySelectorAll('#horse-form-list [data-live-history-date]').length > 0, 'Real horse history');
            if (mode === 'details') await until(() => [...document.querySelectorAll('#horse-form-list .history-race-title')].some(title => !title.textContent.includes('待取得')), 'Real recent race names');
            assert(q('#horse-form-list [data-live-history-date]').dataset.liveHistoryDate === '2023-10-28', 'Horse history omitted overseas starts');
            assert([...document.querySelectorAll('#horse-form-list [data-live-history-date]')].every(item => item.dataset.liveHistoryDate < '2023-12-10'), 'Horse history leaked future starts');
            q('#back-to-entries').click();
            q('[data-race-view-option="entries"]').click();
            assert(q('#entry-rows').rows.length === 11, 'Starters tab lost result runners');
            q('#race-dialog .close-button').click();
            jump(2026, 10);
            const kikuka = [...document.querySelectorAll('[data-date="2026-10-25"] .race-card')].find(card => card.textContent.includes('菊花賞'));
            assert(kikuka, 'Kikuka schedule missing');
            kikuka.click();
            await until(() => q('#entry-rows').rows.length >= 16, 'Recent Kikuka official result');
            assert(q('#entry-rows').textContent.includes('Going to Sky'), 'Recent winner missing');
            q('#entry-rows .horse-name-button').click();
            assert(q('#horse-sire').textContent.includes('Contrail'), 'Japanese pedigree missing');
            q('#back-to-entries').click();
            q('#race-dialog .close-button').click();
            const cox = [...document.querySelectorAll('[data-date="2026-10-24"] .race-card')].find(card => /Cox Plate/.test(card.textContent));
            assert(cox, 'Cox Plate schedule missing');
            cox.click();
            await until(() => q('#entry-rows').rows.length === 12, 'Recent overseas result');
            assert(q('#race-dialog').dataset.raceView === 'results', 'Overseas result did not open');
            q('#entry-rows .horse-name-button').click();
            assert(q('#horse-sire').textContent !== '—', 'Overseas sire missing');
            q('#back-to-entries').click();
            q('#race-dialog .close-button').click();
            const nambu = [...document.querySelectorAll('[data-date="2026-10-12"] .race-card')].find(card => card.textContent.includes('南部杯'));
            assert(nambu, 'NAR schedule missing');
            nambu.click();
            await until(() => q('#entry-rows').rows.length === 11, 'NAR official result');
            assert(q('#entry-rows').textContent.includes('メイショウハチロー'), 'NAR runner missing');
            q('#entry-rows .horse-name-button').click();
            assert(q('#horse-sire').textContent.includes('シニスターミニスター'), 'NAR pedigree missing');
            q('#back-to-entries').click();
            q('#race-dialog .close-button').click();
            jump(2026, 11);
            const jbc = [...document.querySelectorAll('[data-date="2026-11-03"] .race-card')].find(card => card.textContent.includes('ＪＢＣクラシック') || card.textContent.includes('JBCクラシック'));
            assert(jbc, 'Recent JBC schedule missing');
            jbc.click();
            await until(() => q('#entry-rows').rows.length >= 8, 'Recent JBC result');
            assert(q('#race-dialog').dataset.raceView === 'results', 'Recent JBC results still unavailable');
            if (mode === 'details-offline') {
                assert(!q('#race-quality-entry').hidden, 'Offline warning portrait missing');
                q('#quality-avatar-button').click();
                assert(q('#race-quality-dialog').open, 'Warning portrait did not open the status dialog');
                q('#race-quality-dialog .close-button').click();
            }
            return JSON.stringify({detailsPassed:true,mode});
            """
        } else if smoke == "schedule" || smoke == "schedule-offline" {
            script = """
            await until(() => document.querySelector('.workspace-status'));
            assert(q('.app-header').contains(q('#calendar-refresh')), 'Refresh is not in the v2 toolbar');
            assert(!document.querySelector('#calendar [data-race-id="desktop-fixture"]'), 'Fictional race in the calendar');
            const offline = mode === 'schedule-offline';
            const bridge = window.webkit.messageHandlers.calendar;
            const snapshot = async (year, provider) => JSON.parse(await bridge.postMessage({command:'readSchedule',value:{year,provider}}) || 'null');
            const ready = async label => {
                await until(() => !q('#calendar-refresh').disabled &&
                    (offline || q('#desktop-schedule-sources').textContent.match(/已保存|获取失败|年度目录未取得/)), label);
            };
            const jump = (year, month) => {
                q('#calendar-jump').click();
                const input = q('#calendar-year-input');
                input.value = year;
                input.dispatchEvent(new Event('input', {bubbles:true}));
                q(`[data-calendar-month="${month}"]`).click();
            };
            jump(2026, 9);
            await ready('Initial 2026 schedule');
            const sprint = [...document.querySelectorAll('[data-date="2026-09-27"] .race-card')].find(race => race.textContent.includes('スプリンターズステークス'));
            assert(sprint, 'Missing September JRA race');
            sprint.click();
            assert(q('#race-dialog').open && q('#race-title').textContent.includes('スプリンターズ'), 'Schedule-only detail did not open');
            assert(q('#entry-rows').rows.length === 0, 'Schedule-only race showed demo entries');
            assert(q('.source-placeholder a').href.includes('japanracing.jp'), 'Missing schedule source');
            q('#race-dialog .close-button').click();
            jump(2026, 5);
            assert([...document.querySelectorAll('[data-date="2026-05-03"] .race-card')].some(race => race.textContent.includes('天皇賞')), 'Missing May JRA race');
            assert([...document.querySelectorAll('[data-date="2026-05-05"] .race-card')].some(race => race.textContent.includes('かしわ記念')), 'Missing May NAR race');
            jump(2026, 8);
            const international = await snapshot(2026, 'ifha');
            assert(international?.matchedCount >= 80, 'Incomplete live overseas data in SQLite: ' + [...q('#desktop-schedule-sources').children].map(node => node.title).join(' '));
            const august = [...document.querySelectorAll('[data-date^="2026-08-"] .race-card')];
            assert(august.some(race => /Juddmonte International/.test(race.textContent)), 'Missing August York fixture');
            assert(august.some(race => /Winx/.test(race.textContent)), 'Missing August Australian fixture');
            assert(q('#calendar-empty').hidden, 'August still reported empty');
            august.find(race => /Juddmonte International/.test(race.textContent)).click();
            assert(q('.source-placeholder a').href.includes('ifhaonline.org'), 'Missing IFHA fixture link');
            q('#race-dialog .close-button').click();
            jump(2026, 12);
            assert([...document.querySelectorAll('[data-date="2026-12-27"] .race-card')].some(race => race.textContent.includes('有馬記念')), 'Missing December published race');
            const central = await snapshot(2026, 'jra');
            const local = await snapshot(2026, 'nar');
            assert(central?.races?.length > 0 || local?.races?.length > 0, 'No live 2026 data in SQLite');
            jump(2025, 10);
            await ready('2025 schedule after month jump');
            assert([...document.querySelectorAll('[data-date="2025-10-05"] .race-card')].some(race => race.textContent.includes('Arc de Triomphe')), 'Missing verified 2025 overseas archive');
            const historicalCentral = await snapshot(2025,'jra');
            const historicalLocal = await snapshot(2025,'nar');
            if (historicalCentral) assert(historicalCentral.races.length === 24, '2025 central schedule gained duplicates');
            if (!offline) {
                assert(historicalCentral || historicalLocal, 'Changing to 2025 did not collect a separate year');
                assert((await snapshot(2025, 'ifha'))?.fetchedAt, 'Changing to 2025 did not collect the overseas schedule');
                jump(2026, 8);
                await new Promise(resolve => setTimeout(resolve, 0));
                q('#calendar-refresh').click();
                await until(() => q('#calendar-refresh').disabled, 'Manual refresh started');
                await ready('Manual 2026 refresh completed');
                assert((await snapshot(2026, 'ifha'))?.fetchedAt > international.fetchedAt, 'Manual refresh did not save a new IFHA snapshot');
            }
            if (offline) assert(q('#calendar-update').dataset.state === 'offline', 'Offline status missing');
            q('.game-shop-launcher').click();
            assert(q('#game-dialog').open, 'Shop did not open from the v2 toolbar');
            if (!offline) {
                assert(q('#game-cash').textContent === '¥500,000', 'Initial shop grant incorrect');
                q('[data-game-action="bet"][data-race="desktop-fixture"]').click();
                q('[data-game-action="stake"][data-amount="1000"]').click();
                q('#game-bet-form').requestSubmit();
                await until(() => q('#game-cash').textContent === '¥499,000');
            }
            assert(q('#game-cash').textContent === '¥499,000', 'Wallet balance was not kept');
            q('#game-dialog .close-button').click();
            return JSON.stringify({schedulePassed:true,mode,central:central?.races?.length,local:local?.races?.length,
                international:international.matchedCount,august:august.length,rankingYear:international.rankingYear,sourceRows:international.sourceRows,rankingArchived:international.rankingArchived,
                historicalCentral:historicalCentral?.races?.length,historicalLocal:historicalLocal?.races?.length});
            """
        } else if path == "/settings.html" {
            script = """
            assert(document.documentElement.lang === 'zh-CN', 'Settings did not inherit Chinese');
            select('en');
            await until(() => document.documentElement.lang === 'en');
            q('.settings-return').click();
            return 'settings → en';
            """
        } else if URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.contains(URLQueryItem(name: "page", value: "cache")) == true {
            script = """
            await until(() => document.querySelector('.desktop-cache-panel'));
            assert(!q('#cache-view').hidden, 'Cache route did not open');
            if (mode === 'clear') {
                q('.desktop-cache-panel .cache-year-clear').click();
                await until(() => q('.desktop-cache-panel .cache-year-clear').disabled);
                const state = await window.webkit.messageHandlers.calendar.postMessage({command:'load'});
                assert(JSON.parse(state.result).cleared === true, 'Clear did not persist');
            }
            q('.settings-menu-calendar-return').click();
            return 'cache opened and returned';
            """
        } else {
            script = """
            await until(() => document.querySelector('#calendar .day') && q('#game-header-cash'));
            assert(document.querySelectorAll('#calendar .day').length >= 28, 'Calendar did not render');
            const lang = document.documentElement.lang;
            if (mode !== 'fresh') assert(lang === 'en', 'Persisted English not restored');
            const raceButton = q('[data-race-id="desktop-tenno-2026"].race-card');
            assert(q('#calendar-previous').getBoundingClientRect().width > 0, 'Month controls are hidden');
            raceButton.click();
            await until(() => q('#race-dialog').open && !q('#calendar-refresh').disabled);
            assert(q('#game-race-purchase').hidden, 'Purchase entry was enabled by default');
            const rows = q('#entry-rows').rows;
            if (mode === 'clear' && visitedCache) {
                assert(rows.length === 0, 'Cleared results were reinserted while offline');
            } else {
                assert(rows.length === 17 && rows[0].textContent.includes('ダノンデサイル'), 'Incorrect official rows');
            }
            assert(q('.source-placeholder a').href === source, 'Missing official source link');
            const state = await window.webkit.messageHandlers.calendar.postMessage({command:'load'});
            if (mode === 'fresh') {
                assert(Date.parse(JSON.parse(state.result).fetchedAt) > Date.parse('2026-11-04T09:33:23.671Z'), 'Fresh result not written to SQLite');
            } else {
                assert(q('#calendar-update').dataset.state === 'offline', 'Offline state missing');
                q('#quality-avatar-button').click();
                assert(q('#race-quality-dialog').open, 'Failure details did not open');
                q('#race-quality-dialog').close();
            }
            q('#race-dialog').close();
            q('.game-shop-launcher').click();
            await until(() => q('#game-cash').textContent.length > 0);
            if (lang === 'zh-CN') {
                assert(q('#game-cash').textContent === '¥500,000', 'Initial grant incorrect');
                q('[data-game-action="bet"][data-race="desktop-fixture"]').click();
                q('[data-game-action="stake"][data-amount="1000"]').click();
                q('#game-bet-form').requestSubmit();
                await until(() => q('#game-cash').textContent === '¥499,000');
            }
            assert(q('#game-cash').textContent === '¥499,000', 'Wallet balance lost');
            assert(q('#game-tickets details[data-ticket-race="desktop-fixture"]').open === false, 'Ticket group should start collapsed');
            q('[data-game-action="close"]').click();
            if (lang === 'zh-CN') {
                q('.settings-menu-trigger').click();
                q('#settings-quick-panel [data-settings-destination="language"]').click();
                return 'purchase ¥1,000 → language settings';
            }
            if (!visitedCache) {
                q('.settings-menu-trigger').click();
                q('#settings-quick-panel [data-settings-destination="cache"]').click();
                return 'opening cache';
            }
            return 'verified';
            """
        }
        let helpers = """
        const q = selector => {
            const element = document.querySelector(selector);
            if (!element) throw Error('Missing element: ' + selector);
            return element;
        };
        const assert = (ok, message) => { if (!ok) throw Error(message); };
        const until = async (check, label = 'Condition') => {
            for (let attempt = 0; attempt < (mode === 'history-future' ? 1800 : 660); attempt++) {
                if (testErrors.length) throw Error(testErrors.join('\\n'));
                if (check()) return;
                await new Promise(resolve => setTimeout(resolve, 60));
            }
            throw Error(label + ' timed out');
        };
        const select = language => {
            const input = q('[name=language][value=' + language + ']');
            input.click();
            assert(input.checked, 'Radio not selected: ' + language + ' actual=' + document.querySelector('[name=language]:checked')?.value);
        };
        """
        let visitedCache = tested.contains(where: { $0.contains("page=cache") })
        web.callAsyncJavaScript(helpers + script,
                                arguments: ["mode": smoke, "visitedCache": visitedCache || completed, "source": sourceURL.absoluteString, "auditCountry": option("--audit-country") ?? "", "auditIds": option("--audit-ids") ?? ""],
                                in: nil, in: .page) { outcome in
            switch outcome {
            case .success(let value):
                print("\(url.path) \(value)")
                if let result = value as? String, result.contains("\"schedulePassed\":true") || result.contains("\"detailsPassed\":true") || result.contains("\"historyFuturePassed\":true") || result.contains("\"auditPassed\":true") || result.contains("\"horseUIPassed\":true") {
                    print("PASS \(smoke)")
                    exit(0)
                }
                if smoke == "audit-history" && path == "/index.html" { self.fail("Some historical queries failed"); return }
                if (value as? String) == "verified" {
                    if smoke == "fresh" && !self.completed {
                        self.completed = true
                        self.tested.removeAll()
                        self.reopenForSmoke()
                    } else {
                        print("PASS \(smoke)")
                        exit(0)
                    }
                }
            case .failure(let error):
                self.fail("\(url.absoluteString) \(error) \((error as NSError).userInfo)")
            }
        }
    }
}
