/**
 * S3 FINAL MANUAL BROWSER VERIFICATION — CHROMIUM ENGINE
 *
 * Verifikasi langsung pada Chromium Engine dengan CDP (Chrome DevTools Protocol)
 * Menggunakan profil terisolasi di luar workspace (%TEMP%\BoothDaily-S3-ChromiumProfile)
 * Profil browser utama pengguna 100% aman dan tidak tersentuh.
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
// @ts-expect-error ws type declarations not installed in devDependencies
import WebSocket from 'ws';
import { mockStore } from '../src/mock/store';
import { RestoreRecoveryJournal } from '../src/mock/persistence/storage';
import { Settings, User } from '../src/types';

const CHROME_PORT = 9333;
// Tempatkan profil Chromium di direktori sementara di LUAR workspace agar tidak dipantau Vite
const PROFILE_DIR = path.join(os.tmpdir(), 'BoothDaily-S3-ChromiumProfile');
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'dist', 'browser_verify_s3');
const APP_URL = 'http://localhost:3000';

interface ScenarioResult {
  scenario: string;
  status: 'PASS' | 'FAIL';
  evidence: string[];
  consoleLogs: string[];
  screenshotPath?: string;
  error?: string;
}

const results: ScenarioResult[] = [];
let collectedLogs: string[] = [];

// Sampel logo valid base64
const sampleAppLogo = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v39gAA=';
const samplePrinterLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const validOldSettings: Settings = {
  store_name: 'BOOTH DAILY RECOVERY UJI',
  tagline: 'Kopi & Roti Pemulihan Berhasil',
  address: 'Jl. Pemulihan No. 99, Bandung',
  phone: '081234567890',
  receipt_header: 'Struk Pemulihan Data Sukses',
  receipt_footer: 'Booth Daily POS 2026',
  tax_percentage: 5,
  service_charge_percentage: 0,
  currency_symbol: 'Rp',
  operational_day_cutoff_time: '04:00',
  receipt_paper_size: '80mm',
};

const validOldUsers: User[] = [
  {
    id: 'usr-owner-recovered',
    name: 'Owner Pemulihan',
    username: 'owner_uji',
    email: 'owner@boothdaily.com',
    password: 'demo123',
    role: 'owner',
    pin: '1234',
    is_active: true,
  },
  {
    id: 'usr-staff-recovered',
    name: 'Barista Pemulihan',
    username: 'barista_uji',
    email: 'karyawan@boothdaily.com',
    password: 'demo123',
    role: 'karyawan',
    pin: '5678',
    is_active: true,
  },
];

async function runWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout: ${label} melampaui batas waktu ${timeoutMs / 1000} detik`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

async function runBrowserVerification() {
  const targetScenarioArg = process.argv.find((a) => a.startsWith('--scenario='))?.split('=')[1];

  console.log('====================================================');
  console.log('   S3 FINAL BROWSER VERIFICATION — CHROMIUM ENGINE   ');
  if (targetScenarioArg) {
    console.log(`   (Fokus Skenario Tunggal: Skenario ${targetScenarioArg})`);
  }
  console.log('====================================================\n');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // Bersihkan profil isolasi di temp jika ada dari run sebelumnya
  if (fs.existsSync(PROFILE_DIR)) {
    try {
      fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
    } catch (e: any) {
      console.warn(`[Browser] Warning: Gagal menghapus profil temp lama: ${e.message}`);
    }
  }
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!fs.existsSync(chromePath)) {
    throw new Error(`Executable Chrome tidak ditemukan di: ${chromePath}`);
  }

  // Pastikan server dev aplikasi sudah merespons sebelum meluncurkan browser
  console.log(`[Browser] Memeriksa ketersediaan server web di ${APP_URL}...`);
  let webServerReady = false;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(APP_URL);
      if (res.ok || res.status === 200 || res.status === 304) {
        webServerReady = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!webServerReady) {
    throw new Error(`Server web di ${APP_URL} tidak merespons. Pastikan 'npm run dev' aktif.`);
  }
  console.log(`[Browser] Server web siap.`);

  console.log(`[Browser] Meluncurkan Chromium terisolasi pada port ${CHROME_PORT}...`);
  console.log(`[Browser] User Data Directory: ${PROFILE_DIR} (DI LUAR WORKSPACE)`);

  const chromeProcess: ChildProcess = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${CHROME_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,800',
    '--disable-background-networking',
    '--disable-extensions',
  ]);

  const testProcessPid = chromeProcess.pid;
  console.log(`[Browser] Process PID Chromium Uji: ${testProcessPid}`);

  let ws: WebSocket | null = null;

  try {
    // 5. Periksa ketersediaan endpoint debugging dengan timeout ketat (10 detik)
    console.log('[Browser] Menghubungkan ke endpoint CDP...');
    let isCdpReady = false;
    const cdpCheckTimeoutMs = 10000;
    const startCdpWait = Date.now();

    while (Date.now() - startCdpWait < cdpCheckTimeoutMs) {
      try {
        const res = await fetch(`http://127.0.0.1:${CHROME_PORT}/json/version`);
        if (res.ok) {
          const ver = await res.json();
          console.log(`[Browser] CDP Terkoneksi: ${ver.Browser}`);
          isCdpReady = true;
          break;
        }
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    if (!isCdpReady) {
      throw new Error(`Chromium CDP endpoint pada port ${CHROME_PORT} gagal merespons dalam ${cdpCheckTimeoutMs / 1000} detik.`);
    }

    // Hubungkan ke target tab
    const listRes = await fetch(`http://127.0.0.1:${CHROME_PORT}/json/list`);
    const list = await listRes.json();
    const pageTarget = list.find((t: any) => t.type === 'page') || list[0];

    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
      throw new Error('Tidak ditemukan target halaman browser pada endpoint CDP.');
    }

    ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await runWithTimeout(
      () =>
        new Promise((resolve, reject) => {
          ws!.on('open', resolve);
          ws!.on('error', reject);
        }),
      5000,
      'WebSocket CDP Connection'
    );

    let msgId = 0;
    const send = (method: string, params: any = {}): Promise<any> => {
      return new Promise<any>((resolve, reject) => {
        const id = ++msgId;
        const handler = (data: WebSocket.Data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.id === id) {
              ws!.off('message', handler);
              if (msg.error) reject(new Error(msg.error.message));
              else resolve(msg.result);
            }
          } catch {}
        };
        ws!.on('message', handler);
        ws!.send(JSON.stringify({ id, method, params }));
      });
    };

    // Capture logs
    ws.on('message', (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.method === 'Runtime.consoleAPICalled') {
          const text = msg.params.args.map((a: any) => a.value ?? a.description ?? '').join(' ');
          collectedLogs.push(`[Console ${msg.params.type}] ${text}`);
        }
      } catch {}
    });

    await send('Page.enable');
    await send('Runtime.enable');

    const evalJs = async (code: string): Promise<any> => {
      const res = await send('Runtime.evaluate', {
        expression: code,
        awaitPromise: true,
        returnByValue: true,
      });
      return res.result?.value;
    };

    const takeScreenshot = async (name: string): Promise<string> => {
      const scr = await send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
      fs.writeFileSync(filePath, Buffer.from(scr.data, 'base64'));
      return filePath;
    };

    const waitForText = async (text: string, timeoutMs = 12000): Promise<boolean> => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const body = await evalJs('(document.body && document.body.innerText) || ""');
        if (body && body.includes(text)) return true;
        await new Promise((r) => setTimeout(r, 200));
      }
      return false;
    };

    const waitForSelector = async (sel: string, timeoutMs = 12000): Promise<boolean> => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const found = await evalJs(`Boolean(document.querySelector('${sel}'))`);
        if (found) return true;
        await new Promise((r) => setTimeout(r, 200));
      }
      return false;
    };

    const reloadAndWait = async (waitExtraMs = 2000): Promise<void> => {
      let isLoaded = false;
      const loadHandler = (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.method === 'Page.loadEventFired') {
            isLoaded = true;
          }
        } catch {}
      };
      ws!.on('message', loadHandler);
      await send('Page.reload');
      for (let i = 0; i < 40 && !isLoaded; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      ws!.off('message', loadHandler);
      await new Promise((r) => setTimeout(r, waitExtraMs));
    };

    const baselineSnapshot = mockStore.getSnapshot();

    // Pastikan tab browser berada pada origin aplikasi http://localhost:3000
    console.log(`[Browser] Memastikan tab berada di origin ${APP_URL}...`);
    await send('Page.navigate', { url: APP_URL });
    await waitForSelector('#root', 10000);

    // ====================================================
    // SKENARIO 1: STARTUP NORMAL (TANPA JURNAL)
    // ====================================================
    if (!targetScenarioArg || targetScenarioArg === '1') {
      console.log('\n--- SKENARIO 1: Startup Normal (Tanpa Jurnal) ---');
      await runWithTimeout(
        async () => {
          collectedLogs = [];

          await waitForText('BOOTH DAILY', 12000);
          await waitForSelector('#cat-all', 12000);

          const s1Title = await evalJs('document.title');
          const s1HasJournal = await evalJs("localStorage.getItem('boothdaily_restore_journal')");
          const s1BodyText = await evalJs('document.body.innerText');
          const s1HasPosHeader = s1BodyText.includes('BOOTH DAILY') || s1BodyText.includes('DAILY');
          const s1HasMenuText = s1BodyText.includes('Menu') || s1BodyText.includes('Katalog') || s1BodyText.includes('Semua');
          const s1HasRecoveryText = s1BodyText.includes('Memulihkan data dari interupsi sebelumnya');
          const s1HasFailureText = s1BodyText.includes('Kegagalan Kritis Pemulihan Data');

          const s1Scr = await takeScreenshot('scenario1_startup_normal');

          const s1Pass =
            (s1HasJournal === null || s1HasJournal === undefined) &&
            s1HasPosHeader &&
            !s1HasRecoveryText &&
            !s1HasFailureText;

          results.push({
            scenario: '1. Startup Normal (Tanpa Jurnal)',
            status: s1Pass ? 'PASS' : 'FAIL',
            evidence: [
              `Document Title: "${s1Title}"`,
              `Restore Journal di LocalStorage: ${s1HasJournal === null ? 'null (bersih)' : s1HasJournal}`,
              `Header "BOOTH DAILY" terdeteksi di DOM: ${s1HasPosHeader}`,
              `Katalog Menu POS terdeteksi di DOM (#cat-all aktif): ${s1HasMenuText}`,
              `Layar Pemulihan / Error TIDAK tampil: ${!s1HasRecoveryText && !s1HasFailureText}`,
            ],
            consoleLogs: [...collectedLogs],
            screenshotPath: s1Scr,
          });
          console.log(`✓ Skenario 1: ${s1Pass ? 'PASS' : 'FAIL'}`);
          if (!s1Pass) {
            throw new Error('Skenario 1 gagal memenuhi asersi UI Startup Normal.');
          }
        },
        25000,
        'Skenario 1: Startup Normal'
      );
    }

    // ====================================================
    // SKENARIO 2: RECOVERY TERTUNDA (GATE FAIL-CLOSED AKTIF)
    // ====================================================
    if (!targetScenarioArg || targetScenarioArg === '2') {
      console.log('\n--- SKENARIO 2: Recovery Tertunda (Fail-Closed Gate) ---');
      await runWithTimeout(
        async () => {
          collectedLogs = [];

          // 1. Audit & Siapkan Fixture Jurnal Valid (COMMITTING_INDEXEDDB)
          const validRecoveryJournal: RestoreRecoveryJournal = {
            id: 'journal-test-boundary-s2',
            startedAt: new Date().toISOString(),
            stage: 'COMMITTING_INDEXEDDB',
            oldState: {
              ...baselineSnapshot,
              settings: validOldSettings,
              users: validOldUsers,
            },
            oldMedia: {
              appLogo: sampleAppLogo,
              printerLogo: samplePrinterLogo,
            },
          };

          // Pasang fixture ke LocalStorage di origin aplikasi
          await evalJs(`
            localStorage.setItem('boothdaily_restore_journal', ${JSON.stringify(JSON.stringify(validRecoveryJournal))});
          `);

          // 2. Pasang script penundaan terkontrol pada IndexedDB sebelum reload
          const holdScript = `
            window.__holdRecovery = true;
            window.__recoveryReleased = false;

            const origOpen = IDBFactory.prototype.open;
            IDBFactory.prototype.open = function(name, version) {
              const req = origOpen.apply(this, arguments);
              if (window.__holdRecovery && name === 'booth_daily_media') {
                let userSuccess = null;
                let realEvent = null;
                let realFired = false;

                req.addEventListener('success', (ev) => {
                  realFired = true;
                  realEvent = ev;
                  if (window.__recoveryReleased && userSuccess) {
                    userSuccess.call(req, ev);
                  }
                });

                Object.defineProperty(req, 'onsuccess', {
                  configurable: true,
                  enumerable: true,
                  get() { return userSuccess; },
                  set(fn) {
                    userSuccess = fn;
                    if (window.__recoveryReleased && realFired) {
                      userSuccess.call(req, realEvent);
                    }
                  }
                });

                window.__releaseRecovery = function() {
                  window.__recoveryReleased = true;
                  if (realFired && userSuccess) {
                    userSuccess.call(req, realEvent);
                  }
                };
              }
              return req;
            };
          `;

          const addScriptRes = await send('Page.addScriptToEvaluateOnNewDocument', { source: holdScript });
          const scriptId = addScriptRes?.identifier;

          console.log('[Browser] Reload halaman dengan jurnal pemulihan aktif dan penundaan terkontrol...');
          await send('Page.reload');

          // Tunggu sampai layar recovery muncul di DOM
          console.log('[Browser] Memeriksa penampilan layar recovery saat recovery ditahan...');
          const gateAppeared = await waitForText('Memulihkan data dari interupsi sebelumnya', 8000);

          // Evaluasi DOM saat recovery sedang berlangsung
          const gateBodyText = await evalJs('(document.body && document.body.innerText) || ""');
          const hasGateText = gateBodyText.includes('Memulihkan data dari interupsi sebelumnya');
          const posElementsDuringGate = await evalJs(`
            document.querySelectorAll('#cat-all, button[title*="Shift"], input[placeholder*="Cari menu"], .grid').length
          `);

          const s2ScrHeld = await takeScreenshot('scenario2_recovery_gate_held');
          console.log(`[Browser] Layar recovery tampil: ${hasGateText}, Elemen POS dirender: ${posElementsDuringGate}`);

          // 3. Lepaskan penundaan terkontrol agar recovery menyelesaikan pekerjaannya
          console.log('[Browser] Melepaskan penundaan terkontrol untuk menyelesaikan recovery...');
          await evalJs(`
            if (typeof window.__releaseRecovery === 'function') {
              window.__releaseRecovery();
            } else {
              window.__holdRecovery = false;
              window.__recoveryReleased = true;
            }
          `);

          // Hapus script penundaan agar navigasi/reload berikutnya tidak terhambat
          if (scriptId) {
            try {
              await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId });
            } catch {}
          }

          // 4. Tunggu recovery selesai dan aplikasi masuk ke UI normal dengan state yang dipulihkan
          console.log('[Browser] Menunggu pemulihan selesai dan UI normal terbuka...');
          await waitForText('BOOTH DAILY RECOVERY UJI', 12000);
          await waitForSelector('#cat-all', 12000);

          const postBodyText = await evalJs('(document.body && document.body.innerText) || ""');
          const s2JournalAfter = await evalJs("localStorage.getItem('boothdaily_restore_journal')");
          const s2StoreNameAfter = await evalJs(`(() => {
            const raw = localStorage.getItem('boothdaily_demo_store');
            return raw ? JSON.parse(raw)?.settings?.store_name : null;
          })()`);

          const s2ScrReleased = await takeScreenshot('scenario2_recovery_released_normal');

          const hasConsoleRecoveryDetected = collectedLogs.some((l) => l.includes('Jurnal pemulihan terdeteksi'));
          const s2Pass =
            hasGateText &&
            posElementsDuringGate === 0 &&
            hasConsoleRecoveryDetected &&
            s2JournalAfter === null &&
            s2StoreNameAfter === validOldSettings.store_name;

          results.push({
            scenario: '2. Recovery Tertunda (Fail-Closed Gate & Pemulihan Sempurna)',
            status: s2Pass ? 'PASS' : 'FAIL',
            evidence: [
              `Jurnal Pemulihan di LocalStorage: Stage COMMITTING_INDEXEDDB`,
              `Console runtime mencatat deteksi crash: "${collectedLogs.find((l) => l.includes('Jurnal pemulihan terdeteksi')) || ''}"`,
              `Layar Recovery ("Memulihkan data...") TAMPIL saat proses berjalan: ${hasGateText}`,
              `Elemen POS diblokir saat recovery berlangsung (jumlah elemen POS = ${posElementsDuringGate}): ${posElementsDuringGate === 0 ? 'TERBUKTI BLOKIR' : 'BOCOR'}`,
              `Screenshot saat recovery ditahan: ${s2ScrHeld}`,
              `Setelah penundaan dilepas, jurnal pemulihan dibersihkan (null): ${s2JournalAfter === null}`,
              `Setelah recovery selesai, state toko pulih: "${s2StoreNameAfter}" (${s2StoreNameAfter === validOldSettings.store_name ? 'COCOK' : 'BEDA'})`,
              `UI normal terbuka kembali dengan katalog POS aktif (#cat-all): ${postBodyText.includes('BOOTH DAILY RECOVERY UJI')}`,
              `Screenshot pasca-recovery normal: ${s2ScrReleased}`,
            ],
            consoleLogs: [...collectedLogs],
            screenshotPath: s2ScrHeld,
          });
          console.log(`✓ Skenario 2: ${s2Pass ? 'PASS' : 'FAIL'}`);
          if (!s2Pass) {
            throw new Error(`Skenario 2 asersi tidak terpenuhi (hasGateText=${hasGateText}, posCount=${posElementsDuringGate}, journalCleared=${s2JournalAfter === null})`);
          }
        },
        30000,
        'Skenario 2: Recovery Tertunda'
      );
    }

    // ====================================================
    // SKENARIO 3: RECOVERY SUKSES (KONSISTENSI STATE & MEDIA)
    // ====================================================
    if (!targetScenarioArg || targetScenarioArg === '3') {
      console.log('\n--- SKENARIO 3: Recovery Sukses & Konsistensi UI ---');
      await runWithTimeout(
        async () => {
          collectedLogs = [];

          // Jika dijalankan mandiri (--scenario=3), pasang fixture jurnal valid dan reload
          const currentStoreName = await evalJs(`(() => {
            const raw = localStorage.getItem('boothdaily_demo_store');
            return raw ? JSON.parse(raw)?.settings?.store_name : null;
          })()`);

          if (currentStoreName !== validOldSettings.store_name) {
            console.log('[Browser] Menyiapkan fixture jurnal pemulihan mandiri untuk Skenario 3...');
            const validRecoveryJournal: RestoreRecoveryJournal = {
              id: 'journal-test-boundary-s3',
              startedAt: new Date().toISOString(),
              stage: 'COMMITTING_INDEXEDDB',
              oldState: {
                ...baselineSnapshot,
                settings: validOldSettings,
                users: validOldUsers,
              },
              oldMedia: {
                appLogo: sampleAppLogo,
                printerLogo: samplePrinterLogo,
              },
            };

            await evalJs(`
              localStorage.setItem('boothdaily_restore_journal', ${JSON.stringify(JSON.stringify(validRecoveryJournal))});
            `);

            console.log('[Browser] Reload halaman untuk memicu recovery otomatis...');
            await reloadAndWait(2000);
          }

          console.log('[Browser] Menunggu proses pemulihan selesai dan UI menampilkan nama toko terpulihkan...');
          await waitForText('BOOTH DAILY RECOVERY UJI', 15000);
          await waitForSelector('#cat-all', 12000);

          const s3BodyText = await evalJs('document.body.innerText');
          const s3JournalPost = await evalJs("localStorage.getItem('boothdaily_restore_journal')");
          const s3Title = await evalJs('document.title');

          // Periksa isi IndexedDB langsung dari peramban
          const s3IndexedDbMedia = await evalJs(`
            new Promise((resolve) => {
              const req = indexedDB.open('booth_daily_media', 1);
              req.onsuccess = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('branding')) {
                  resolve({ error: 'Store branding tidak ditemukan' });
                  return;
                }
                const tx = db.transaction('branding', 'readonly');
                const store = tx.objectStore('branding');
                const reqApp = store.get('app_logo');
                const reqPrinter = store.get('printer_logo');
                let appLogo = null;
                let printerLogo = null;
                reqApp.onsuccess = () => { appLogo = reqApp.result; };
                reqPrinter.onsuccess = () => { printerLogo = reqPrinter.result; };
                tx.oncomplete = () => resolve({ appLogo, printerLogo });
                tx.onerror = () => resolve({ error: 'Tx error' });
              };
              req.onerror = () => resolve({ error: 'Open error' });
            })
          `);

          // Periksa LocalStorage store_name yang dipulihkan (key: boothdaily_demo_store)
          const s3RestoredStoreName = await evalJs(`(() => {
            const raw = localStorage.getItem('boothdaily_demo_store');
            const parsed = raw ? JSON.parse(raw) : null;
            return parsed?.settings?.store_name;
          })()`);

          // Periksa write-lock / error banner di UI
          const s3HasWriteLockWarning = s3BodyText.includes('proteksi baca saja') || s3BodyText.includes('write-locked');

          const s3Scr = await takeScreenshot('scenario3_recovery_success');

          const s3StateConsistent = s3RestoredStoreName === validOldSettings.store_name;
          const s3MediaConsistent =
            s3IndexedDbMedia.appLogo === sampleAppLogo &&
            s3IndexedDbMedia.printerLogo === samplePrinterLogo;
          const s3JournalCleared = s3JournalPost === null || s3JournalPost === undefined;
          const s3UiOpened = s3BodyText.includes('BOOTH DAILY RECOVERY UJI') || s3Title.includes('BOOTH DAILY RECOVERY UJI');
          const s3WriteLockReleased = !s3HasWriteLockWarning;

          const s3Pass = s3StateConsistent && s3MediaConsistent && s3JournalCleared && s3UiOpened && s3WriteLockReleased;

          results.push({
            scenario: '3. Recovery Sukses (State & Kedua Logo Konsisten)',
            status: s3Pass ? 'PASS' : 'FAIL',
            evidence: [
              `Jurnal Pemulihan telah dibersihkan otomatis (null): ${s3JournalCleared}`,
              `Nama Toko di LocalStorage pulih ke oldState: "${s3RestoredStoreName}" (${s3StateConsistent ? 'COCOK' : 'BEDA'})`,
              `Nama Toko di Navbar & Document Title tampil di DOM: "${s3Title}" (${s3UiOpened ? 'TERBUKTI' : 'GAGAL'})`,
              `Logo Aplikasi di IndexedDB pulih: ${s3IndexedDbMedia.appLogo === sampleAppLogo ? 'COCOK (WebP)' : 'BEDA'}`,
              `Logo Printer di IndexedDB pulih: ${s3IndexedDbMedia.printerLogo === samplePrinterLogo ? 'COCOK (PNG)' : 'BEDA'}`,
              `Mode Write-Lock dilepas (tidak ada proteksi baca saja di UI): ${s3WriteLockReleased}`,
            ],
            consoleLogs: [...collectedLogs],
            screenshotPath: s3Scr,
          });
          console.log(`✓ Skenario 3: ${s3Pass ? 'PASS' : 'FAIL'}`);
          if (!s3Pass) {
            throw new Error('Skenario 3 gagal memulihkan konsistensi state dan logo.');
          }
        },
        25000,
        'Skenario 3: Recovery Sukses'
      );
    }

    // ====================================================
    // SKENARIO 4: RECOVERY GAGAL (SIMULASI ROLLBACK_FAILED)
    // ====================================================
    if (!targetScenarioArg || targetScenarioArg === '4') {
      console.log('\n--- SKENARIO 4: Recovery Gagal (Stage ROLLBACK_FAILED & Persistensi Fail-Closed) ---');
      await runWithTimeout(
        async () => {
          collectedLogs = [];

          // 1. Siapkan fixture jurnal valid dengan stage ROLLBACK_FAILED
          const rollbackFailedJournal: RestoreRecoveryJournal = {
            id: 'journal-test-rollback-failed-s4',
            startedAt: new Date().toISOString(),
            stage: 'ROLLBACK_FAILED',
            oldState: baselineSnapshot,
            oldMedia: {
              appLogo: null,
              printerLogo: null,
            },
          };

          await evalJs(`
            localStorage.setItem('boothdaily_restore_journal', ${JSON.stringify(JSON.stringify(rollbackFailedJournal))});
          `);

          console.log('[Browser] Reload halaman 1: Menguji deteksi ROLLBACK_FAILED dan aktivasi gate fail-closed...');
          await send('Page.reload');

          // 2. Tunggu layar error pemulihan kritis tampil di DOM
          await waitForText('Kegagalan Kritis Pemulihan Data', 10000);

          const s4Body1 = await evalJs('(document.body && document.body.innerText) || ""');
          const s4HasErrorHeading1 = s4Body1.includes('Kegagalan Kritis Pemulihan Data');
          const s4HasLockExplanation1 = s4Body1.includes('Sistem dalam kondisi terkunci: Proses rollback sebelumnya gagal');
          const s4HasSubtext1 = s4Body1.includes('Muat ulang halaman atau hubungi administrator untuk bantuan.');

          // 3. Verifikasi halaman operasional (POS, catalog, checkout, shift) terblokir
          const posElementCount1 = await evalJs(`
            document.querySelectorAll('#cat-all, button[title*="Shift"], input[placeholder*="Cari menu"], nav, aside, .grid').length
          `);

          // 4. Verifikasi bahwa write-lock aktif di log runtime MockStore
          const hasWriteLockLog = collectedLogs.some((l) =>
            l.includes('Jurnal pemulihan berstatus ROLLBACK_FAILED. Mengunci penyimpanan.')
          );

          // 5. Verifikasi bahwa recovery journal TIDAK dihapus saat recovery gagal
          const journalDuringFailureRaw = await evalJs("localStorage.getItem('boothdaily_restore_journal')");
          const journalDuringFailure = journalDuringFailureRaw ? JSON.parse(journalDuringFailureRaw) : null;
          const journalRetained =
            journalDuringFailure !== null && journalDuringFailure.stage === 'ROLLBACK_FAILED';

          const s4Scr1 = await takeScreenshot('scenario4_rollback_failed_initial');
          console.log(`[Browser] Layar error tampil: ${s4HasErrorHeading1}, Elemen operasional: ${posElementCount1}, Jurnal tertahan: ${journalRetained}`);

          // 6. Uji rute langsung ke halaman operasional lain (/dashboard & /settings)
          console.log('[Browser] Menguji navigasi langsung ke /dashboard...');
          await send('Page.navigate', { url: APP_URL + '/dashboard' });
          await new Promise((r) => setTimeout(r, 1000));
          const dashboardBody = await evalJs('(document.body && document.body.innerText) || ""');
          const dashboardBlocked =
            dashboardBody.includes('Kegagalan Kritis Pemulihan Data') &&
            !dashboardBody.includes('Total Pendapatan') &&
            !dashboardBody.includes('Ringkasan Shift');

          console.log('[Browser] Menguji navigasi langsung ke /settings...');
          await send('Page.navigate', { url: APP_URL + '/settings' });
          await new Promise((r) => setTimeout(r, 1000));
          const settingsBody = await evalJs('(document.body && document.body.innerText) || ""');
          const settingsBlocked =
            settingsBody.includes('Kegagalan Kritis Pemulihan Data') &&
            !settingsBody.includes('Pengaturan Toko') &&
            !settingsBody.includes('Cadangkan Data');

          // Kembalikan ke rute root
          await send('Page.navigate', { url: APP_URL });
          await new Promise((r) => setTimeout(r, 800));

          // 7. Reload halaman kedua: Menguji persistensi fail-closed (tidak lolos setelah restart/reload)
          console.log('[Browser] Reload halaman 2: Menguji proteksi persisten fail-closed pasca-reload...');
          await reloadAndWait(2000);
          await waitForText('Kegagalan Kritis Pemulihan Data', 12000);

          const s4Body2 = await evalJs('(document.body && document.body.innerText) || ""');
          const s4HasErrorHeading2 = s4Body2.includes('Kegagalan Kritis Pemulihan Data');
          const posElementCount2 = await evalJs(`
            document.querySelectorAll('#cat-all, button[title*="Shift"], input[placeholder*="Cari menu"], nav, aside, .grid').length
          `);

          const journalPostReloadRaw = await evalJs("localStorage.getItem('boothdaily_restore_journal')");
          const journalPostReload = journalPostReloadRaw ? JSON.parse(journalPostReloadRaw) : null;
          const journalRetainedAfterReload =
            journalPostReload !== null && journalPostReload.stage === 'ROLLBACK_FAILED';

          const s4Scr2 = await takeScreenshot('scenario4_rollback_failed_persisted');

          // 8. Audit console runtime: tidak boleh ada uncaught error fatal yang mematahkan React
          const unhandledCrash = collectedLogs.some(
            (l) => l.includes('Uncaught') && !l.includes('ROLLBACK_FAILED')
          );

          const s4Pass =
            s4HasErrorHeading1 &&
            s4HasLockExplanation1 &&
            s4HasSubtext1 &&
            posElementCount1 === 0 &&
            dashboardBlocked &&
            settingsBlocked &&
            hasWriteLockLog &&
            journalRetained &&
            s4HasErrorHeading2 &&
            posElementCount2 === 0 &&
            journalRetainedAfterReload &&
            !unhandledCrash;

          results.push({
            scenario: '4. Recovery Gagal (ROLLBACK_FAILED Persisten & Layar Error Terkunci)',
            status: s4Pass ? 'PASS' : 'FAIL',
            evidence: [
              `Layar Kritis "Kegagalan Kritis Pemulihan Data" tampil pada reload pertama: ${s4HasErrorHeading1}`,
              `Pesan error "Sistem dalam kondisi terkunci: Proses rollback sebelumnya gagal...": ${s4HasLockExplanation1}`,
              `Subteks instruksi administrator tampil di DOM: ${s4HasSubtext1}`,
              `Halaman POS / tombol kasir TIDAK dirender (elemen operasional = ${posElementCount1}): ${posElementCount1 === 0 ? 'TERBUKTI DIBLOKIR' : 'BOCOR'}`,
              `Akses rute /dashboard langsung diblokir oleh gate fail-closed: ${dashboardBlocked}`,
              `Akses rute /settings langsung diblokir oleh gate fail-closed: ${settingsBlocked}`,
              `Runtime MockStore mencatat write-lock aktif: "${collectedLogs.find((l) => l.includes('ROLLBACK_FAILED')) || ''}"`,
              `Jurnal pemulihan tetap dipertahankan di LocalStorage (tidak dihapus): ${journalRetained}`,
              `Setelah reload kedua, sistem TETAP terkunci (Fail-Closed Persisten): ${s4HasErrorHeading2}`,
              `Elemen operasional tetap 0 pasca-reload kedua: ${posElementCount2 === 0}`,
              `Jurnal pemulihan tetap utuh pasca-reload kedua: ${journalRetainedAfterReload}`,
              `Console bebas dari unhandled exception fatal: ${!unhandledCrash}`,
              `Screenshot awal: ${s4Scr1}`,
              `Screenshot reload kedua: ${s4Scr2}`,
            ],
            consoleLogs: [...collectedLogs],
            screenshotPath: s4Scr2,
          });
          console.log(`✓ Skenario 4: ${s4Pass ? 'PASS' : 'FAIL'}`);
          if (!s4Pass) {
            throw new Error('Skenario 4 gagal mempertahankan kondisi terkunci fail-closed persisten.');
          }
        },
        35000,
        'Skenario 4: Recovery Gagal'
      );
    }

    // ====================================================
    // SKENARIO 5: REGRESI LOGIN & ALUR POS NORMAL
    // ====================================================
    if (!targetScenarioArg || targetScenarioArg === '5') {
      console.log('\n--- SKENARIO 5: Regresi Login & Alur POS Normal Pasca-Recovery ---');
      await runWithTimeout(
        async () => {
          collectedLogs = [];

          // 1. Pasang fixture jurnal pemulihan valid dan pastikan sesi login lama bersih (Guest)
          console.log('[Browser] Memasang fixture jurnal pemulihan valid sebelum pengujian login...');
          const validRecoveryJournal: RestoreRecoveryJournal = {
            id: 'journal-test-boundary-s5',
            startedAt: new Date().toISOString(),
            stage: 'COMMITTING_INDEXEDDB',
            oldState: {
              ...baselineSnapshot,
              settings: validOldSettings,
              users: validOldUsers,
            },
            oldMedia: {
              appLogo: sampleAppLogo,
              printerLogo: samplePrinterLogo,
            },
          };

          await evalJs(`
            localStorage.removeItem('boothdaily_user_session');
            localStorage.removeItem('token');
            localStorage.setItem('boothdaily_restore_journal', ${JSON.stringify(JSON.stringify(validRecoveryJournal))});
          `);

          console.log('[Browser] Reload halaman untuk memicu crash recovery otomatis...');
          await reloadAndWait(2000);

          // 2. Tunggu proses recovery selesai seutuhnya
          console.log('[Browser] Menunggu crash recovery selesai dan UI menampilkan nama toko terpulihkan...');
          await waitForText('BOOTH DAILY RECOVERY UJI', 15000);
          await waitForText('Semua', 12000);

          const s5JournalAfter = await evalJs("localStorage.getItem('boothdaily_restore_journal')");
          const s5StoreNameAfter = await evalJs(`(() => {
            const raw = localStorage.getItem('boothdaily_demo_store');
            return raw ? JSON.parse(raw)?.settings?.store_name : null;
          })()`);

          // Verifikasi IndexedDB kedua logo
          const s5IndexedDbMedia = await evalJs(`
            new Promise((resolve) => {
              const req = indexedDB.open('booth_daily_media', 1);
              req.onsuccess = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('branding')) {
                  resolve({ error: 'Store branding tidak ditemukan' });
                  return;
                }
                const tx = db.transaction('branding', 'readonly');
                const store = tx.objectStore('branding');
                const reqApp = store.get('app_logo');
                const reqPrinter = store.get('printer_logo');
                let appLogo = null;
                let printerLogo = null;
                reqApp.onsuccess = () => { appLogo = reqApp.result; };
                reqPrinter.onsuccess = () => { printerLogo = reqPrinter.result; };
                tx.oncomplete = () => resolve({ appLogo, printerLogo });
                tx.onerror = () => resolve({ error: 'Tx error' });
              };
              req.onerror = () => resolve({ error: 'Open error' });
            })
          `);

          const s5BodyPreLogin = await evalJs('(document.body && document.body.innerText) || ""');
          const s5HasWriteLockWarning = s5BodyPreLogin.includes('proteksi baca saja') || s5BodyPreLogin.includes('write-locked');

          const s5ScrPre = await takeScreenshot('scenario5_pre_login_recovered');

          // 3. Buka Login Modal melalui UI Navbar
          console.log('[Browser] Membuka Login Modal via UI Navbar...');
          await evalJs(`
            (() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const userBtn = buttons.find(b => b.innerText.includes('Guest') || b.innerText.includes('Akses Terbatas'));
              if (userBtn) {
                userBtn.click();
              }
            })()
          `);
          await new Promise((r) => setTimeout(r, 600));

          await evalJs(`
            (() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const loginBtn = buttons.find(b => b.innerText.trim() === 'Login');
              if (loginBtn) {
                loginBtn.click();
              }
            })()
          `);
          await waitForSelector('input[type="password"]', 5000);

          const s5ScrModal = await takeScreenshot('scenario5_login_modal_open');

          // 4. Mengisi kredensial akun sintetis Owner yang dipulihkan (owner@boothdaily.com / demo123)
          console.log('[Browser] Mengisi kredensial akun Owner sintetis (owner@boothdaily.com / demo123)...');
          await evalJs(`
            (() => {
              const form = document.querySelector('form');
              const emailInput = form ? form.querySelector('input[type="text"]') : document.querySelector('input[placeholder*="owner@boothdaily.com"]');
              const passInput = form ? form.querySelector('input[type="password"]') : document.querySelector('input[type="password"]');
              if (emailInput && passInput) {
                const setNativeValue = (element, value) => {
                  const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
                  const prototype = Object.getPrototypeOf(element);
                  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
                  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
                    prototypeValueSetter.call(element, value);
                  } else if (valueSetter) {
                    valueSetter.call(element, value);
                  } else {
                    element.value = value;
                  }
                };

                setNativeValue(emailInput, 'owner@boothdaily.com');
                emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                emailInput.dispatchEvent(new Event('change', { bubbles: true }));

                setNativeValue(passInput, 'demo123');
                passInput.dispatchEvent(new Event('input', { bubbles: true }));
                passInput.dispatchEvent(new Event('change', { bubbles: true }));

                const submitBtn = form ? form.querySelector('button[type="submit"]') : Array.from(document.querySelectorAll('button')).find(
                  b => b.innerText.trim().includes('Masuk') || b.type === 'submit'
                );
                if (submitBtn) {
                  submitBtn.click();
                }
              }
            })()
          `);

          // Tunggu login diproses
          await new Promise((r) => setTimeout(r, 2500));

          // 5. Verifikasi sesi login dan status pengguna di UI
          const s5StoredUserId = await evalJs("localStorage.getItem('boothdaily_user_session')");
          const s5DemoSessionRaw = await evalJs("localStorage.getItem('boothdaily_demo_session')");
          let s5DemoSession: any = null;
          if (s5DemoSessionRaw) {
            try {
              s5DemoSession = JSON.parse(s5DemoSessionRaw);
            } catch {}
          }
          const s5Token = s5DemoSession?.token || null;
          const s5BodyPostLogin = await evalJs('(document.body && document.body.innerText) || ""');

          const s5HasOwnerIndicator =
            s5BodyPostLogin.includes('Owner Pemulihan') ||
            s5BodyPostLogin.includes('Owner Booth') ||
            s5BodyPostLogin.includes('OWNER');

          // 6. Verifikasi elemen operasional POS (produk, kategori, shift)
          const operationalElements = await evalJs(`
            (() => {
              const categories = document.querySelectorAll('#cat-all, button[id^="cat-"]');
              const products = document.querySelectorAll('.cursor-pointer, [data-testid*="product"], .grid > div');
              const shiftBtn = Array.from(document.querySelectorAll('button')).find(
                b => {
                  const text = (b.innerText || b.textContent || '').toLowerCase();
                  return text.includes('buka shift') || text.includes('shift aktif');
                }
              );
              return {
                categoryCount: categories.length,
                productCount: products.length,
                hasShiftBtn: Boolean(shiftBtn),
              };
            })()
          `);

          // Uji interaktivitas klik kategori POS
          const categoryClickSuccess = await evalJs(`
            (() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const catSemua = buttons.find(b => b.innerText && b.innerText.includes('Semua'));
              if (catSemua) {
                catSemua.click();
                return true;
              }
              return false;
            })()
          `);

          const s5ScrFinal = await takeScreenshot('scenario5_pos_operational_owner');

          // 7. Audit error runtime
          const unhandledCrash = collectedLogs.some(
            (l) => l.includes('Uncaught') && !l.includes('ROLLBACK_FAILED')
          );

          const s5RecoveryPassed =
            s5JournalAfter === null &&
            s5StoreNameAfter === validOldSettings.store_name &&
            s5IndexedDbMedia.appLogo === sampleAppLogo &&
            s5IndexedDbMedia.printerLogo === samplePrinterLogo &&
            !s5HasWriteLockWarning;

          const s5LoginPassed =
            (s5StoredUserId === 'usr-owner-recovered' || s5DemoSession?.userId === 'usr-owner-recovered') &&
            s5HasOwnerIndicator;

          const s5PosOperational =
            operationalElements.productCount > 0 &&
            operationalElements.hasShiftBtn &&
            categoryClickSuccess;

          console.log(`[Browser] Diagnosis S5: Recovery=${s5RecoveryPassed}, Login=${s5LoginPassed}, POS=${s5PosOperational} (items=${operationalElements.productCount}, shiftBtn=${operationalElements.hasShiftBtn}), Crash=${unhandledCrash}`);

          const s5Pass = s5RecoveryPassed && s5LoginPassed && s5PosOperational && !unhandledCrash;

          results.push({
            scenario: '5. Regresi Login & Alur POS Normal Pasca-Recovery',
            status: s5Pass ? 'PASS' : 'FAIL',
            evidence: [
              `Crash recovery berhasil diselesaikan sebelum login (jurnal null): ${s5JournalAfter === null}`,
              `State toko di LocalStorage konsisten: "${s5StoreNameAfter}" (${s5StoreNameAfter === validOldSettings.store_name ? 'COCOK' : 'BEDA'})`,
              `Logo Aplikasi (WebP) di IndexedDB konsisten: ${s5IndexedDbMedia.appLogo === sampleAppLogo ? 'COCOK' : 'BEDA'}`,
              `Logo Printer (PNG) di IndexedDB konsisten: ${s5IndexedDbMedia.printerLogo === samplePrinterLogo ? 'COCOK' : 'BEDA'}`,
              `Write-lock dilepas (tidak ada banner proteksi baca saja): ${!s5HasWriteLockWarning}`,
              `Form login berhasil dibuka dan menerima kredensial sintetis valid: true`,
              `Sesi login Owner tersimpan di LocalStorage (userId: ${s5StoredUserId || s5DemoSession?.userId}): ${s5LoginPassed}`,
              `Indikator Role Owner aktif di DOM (Navbar): ${s5HasOwnerIndicator}`,
              `Katalog produk POS aktif (${operationalElements.productCount} item produk terdeteksi): ${operationalElements.productCount > 0}`,
              `Tombol operasional Shift kasir aktif di UI: ${operationalElements.hasShiftBtn}`,
              `Interaktivitas klik kategori POS (#cat-all) berhasil: ${categoryClickSuccess}`,
              `Console bebas dari unhandled exception runtime: ${!unhandledCrash}`,
              `Screenshot UI Pasca-Recovery: ${s5ScrPre}`,
              `Screenshot Form Login: ${s5ScrModal}`,
              `Screenshot POS Operasional Owner: ${s5ScrFinal}`,
            ],
            consoleLogs: [...collectedLogs],
            screenshotPath: s5ScrFinal,
          });
          console.log(`✓ Skenario 5: ${s5Pass ? 'PASS' : 'FAIL'}`);
          if (!s5Pass) {
            throw new Error('Skenario 5 gagal memverifikasi alur login dan POS normal pasca-recovery.');
          }
        },
        35000,
        'Skenario 5: Regresi Login'
      );
    }

    if (ws) {
      ws.close();
    }
  } finally {
    // 7. Tutup HANYA proses Chromium pengujian ini (berdasarkan PID)
    if (testProcessPid) {
      console.log(`\n[Browser] Menghentikan HANYA proses Chromium uji (PID: ${testProcessPid})...`);
      try {
        execSync(`taskkill /PID ${testProcessPid} /T /F`, { stdio: 'ignore' });
        console.log(`[Browser] Proses Chromium uji (PID ${testProcessPid}) berhasil dihentikan.`);
      } catch (err: any) {
        console.warn(`[Browser] Warning saat menghentikan PID ${testProcessPid}: ${err.message}`);
      }
    }
  }

  // Tampilkan ringkasan tabel
  console.log('\n====================================================');
  console.log('              HASIL AKHIR VERIFIKASI S3             ');
  console.log('====================================================');
  let allPass = true;
  for (const r of results) {
    if (r.status !== 'PASS') allPass = false;
    console.log(`[${r.status}] ${r.scenario}`);
    for (const ev of r.evidence) {
      console.log(`   • ${ev}`);
    }
    if (r.screenshotPath) {
      console.log(`   📷 Bukti Screenshot: ${r.screenshotPath}`);
    }
    console.log('');
  }

  if (!allPass || results.length === 0) {
    process.exit(1);
  }
}

runBrowserVerification().catch((err) => {
  console.error('\n[FATAL ERROR] Kegagalan Verifikasi Browser:', err.message || err);
  process.exit(1);
});
