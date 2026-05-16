import { Capacitor } from '@capacitor/core';
import { logCapacitorPerfAudit, logCapacitorPerfAuditThrottled, withPerfSpan } from '@/lib/capacitorPerfAudit';

export interface ScannerResult {
  data: string;
  format: string;
}

export type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'unsupported';

export interface IScanner {
  start(videoElement: HTMLVideoElement, onScan: (result: ScannerResult) => void): Promise<void>;
  stop(): Promise<void>;
  pause(): void;
  resume(): void;
  checkPermission(): Promise<PermissionStatus>;
  requestPermission(): Promise<PermissionStatus>;
  setTorch(enabled: boolean): Promise<void>;
}

/**
 * PLATFORM REGISTRY
 * ─────────────────────────────────────────────────────────────
 * WebScanner      → Web browser / PWA standalone mode
 *                   Uses qr-scanner (Nimiq) — worker-based, lightweight
 * CapacitorScanner → Android APK (Capacitor native)
 *                   Uses @capacitor-mlkit/barcode-scanning — ML Kit
 *
 * Factory (getScanner) selects automatically via Capacitor.isNativePlatform().
 * NEVER instantiate CapacitorScanner directly on web — it will fail.
 */

/** Lazy-loaded to avoid loading native modules on web */
let qrScannerLibPromise: Promise<typeof import('qr-scanner')> | null = null;
let mlkitLibPromise: Promise<typeof import('@capacitor-mlkit/barcode-scanning')> | null = null;

async function getQrScannerLib() {
  if (!qrScannerLibPromise) qrScannerLibPromise = import('qr-scanner');
  return qrScannerLibPromise;
}

async function getMlKitLib() {
  if (!mlkitLibPromise) mlkitLibPromise = import('@capacitor-mlkit/barcode-scanning');
  return mlkitLibPromise;
}

/**
 * WEB/PWA Scanner — uses Nimiq qr-scanner (worker-based, no native bridge).
 * Safe for: browser, PWA standalone, desktop.
 * NOT used in native APK builds.
 */
class WebScanner implements IScanner {
  private scanner: InstanceType<Awaited<ReturnType<typeof getQrScannerLib>>['default']> | null = null;
  private isPaused = false;

  async checkPermission(): Promise<PermissionStatus> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return 'unsupported';
    try {
      // Permissions API is not supported for 'camera' in all browsers (e.g. Firefox)
      const result = await navigator.permissions.query({ name: 'camera' as any });
      return result.state as PermissionStatus;
    } catch {
      return 'prompt';
    }
  }

  async requestPermission(): Promise<PermissionStatus> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return 'granted';
    } catch {
      return 'denied';
    }
  }

  async start(videoElement: HTMLVideoElement, onScan: (result: ScannerResult) => void): Promise<void> {
    await withPerfSpan('scanner.web.start', async () => {
      if (this.scanner) await this.stop();
      const { default: QrScanner } = await getQrScannerLib();

      this.scanner = new QrScanner(
        videoElement,
        (result) => {
          if (this.isPaused) return;
          onScan({
            data: result.data,
            format: 'QR_CODE',
          });
        },
        {
          preferredCamera: 'environment',
          highlightScanRegion: false,
          highlightCodeOutline: false,
          maxScansPerSecond: 30, // upgraded from 22 for faster acquisition
          calculateScanRegion: (v) => {
            const smallestDimension = Math.min(v.videoWidth, v.videoHeight);
            const scanRegionSize = Math.round(smallestDimension * 0.62);
            return {
              x: Math.round((v.videoWidth - scanRegionSize) / 2),
              y: Math.round((v.videoHeight - scanRegionSize) / 2),
              width: scanRegionSize,
              height: scanRegionSize,
            };
          }
        }
      );

      await this.scanner.start();

      // Post-start stream optimization for WebScanner
      try {
        const stream = videoElement.srcObject as MediaStream;
        const track = stream?.getVideoTracks()[0];
        if (track) {
          const capabilities = track.getCapabilities?.() || {};
          const currentConstraints = track.getConstraints();
          const advanced: any[] = [];

          // 1. Autofocus Optimization
          const focusModes = (capabilities as any).focusMode || [];
          if (focusModes.includes('continuous')) {
             advanced.push({ focusMode: 'continuous' });
          } else if (focusModes.includes('continuous-video')) {
             advanced.push({ focusMode: 'continuous-video' });
          } else if (focusModes.includes('continuous-picture')) {
             advanced.push({ focusMode: 'continuous-picture' });
          }

          // 2. Low Light / Exposure Optimization
          const exposureModes = (capabilities as any).exposureMode || [];
          if (exposureModes.includes('continuous')) {
             advanced.push({ exposureMode: 'continuous' });
          }

          if (advanced.length > 0) {
            await track.applyConstraints({
              ...currentConstraints,
              advanced
            });
          }
        }
      } catch (err) {
        console.warn('[WebScanner] Failed to apply advanced track constraints', err);
      }
    });
  }

  async stop(): Promise<void> {
    if (this.scanner) {
      this.scanner.stop();
      this.scanner.destroy();
      this.scanner = null;
    }
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  async setTorch(enabled: boolean): Promise<void> {
    if (!this.scanner) return;
    try {
      if (enabled) {
        await this.scanner.turnFlashOn();
      } else {
        await this.scanner.turnFlashOff();
      }
    } catch (err) {
      console.warn('[WebScanner] Torch not supported', err);
    }
  }
}

/**
 * NATIVE APK Scanner — uses Capacitor ML Kit barcode scanning.
 * Safe for: Android APK (Capacitor native platform only).
 * NOT used in web/PWA builds — will throw if called outside native context.
 */
class CapacitorScanner implements IScanner {
  private isPaused = false;
  private listenerHandle: { remove: () => Promise<void> } | null = null;
  private static moduleInstallPromise: Promise<void> | null = null;

  async checkPermission(): Promise<PermissionStatus> {
    try {
      const { BarcodeScanner } = await getMlKitLib();
      const status = await withPerfSpan('scanner.native.check-permission', () => BarcodeScanner.checkPermissions());
      return status.camera as PermissionStatus;
    } catch {
      return 'unsupported';
    }
  }

  async requestPermission(): Promise<PermissionStatus> {
    try {
      const { BarcodeScanner } = await getMlKitLib();
      const status = await withPerfSpan('scanner.native.request-permission', () => BarcodeScanner.requestPermissions());
      return status.camera as PermissionStatus;
    } catch {
      return 'denied';
    }
  }

  async start(_videoElement: HTMLVideoElement, onScan: (result: ScannerResult) => void): Promise<void> {
    const { BarcodeScanner, BarcodeFormat, LensFacing } = await getMlKitLib();
    await withPerfSpan('scanner.native.start', async () => {
      if (Capacitor.getPlatform() === 'android') {
        if (!CapacitorScanner.moduleInstallPromise) {
          CapacitorScanner.moduleInstallPromise = BarcodeScanner.installGoogleBarcodeScannerModule()
            .then(() => undefined)
            .catch((installErr: any) => {
              logCapacitorPerfAudit('scanner.native.module-install', {
                status: 'skip',
                reason: installErr?.message || String(installErr),
              });
            });
        }
        await CapacitorScanner.moduleInstallPromise;
      }

      if (this.listenerHandle) {
        await this.listenerHandle.remove().catch(() => {});
      }

      this.listenerHandle = await BarcodeScanner.addListener('barcodesScanned', (event) => {
        if (this.isPaused || !event.barcodes.length) return;
        const barcode = event.barcodes[0];
        logCapacitorPerfAuditThrottled('scanner.native.barcode-detected', 1500, {
          format: barcode.format,
          hasValue: Boolean(barcode.displayValue),
        });
        onScan({
          data: barcode.displayValue,
          format: barcode.format,
        });
      });

      await BarcodeScanner.startScan({
        formats: [BarcodeFormat.QrCode],
        lensFacing: LensFacing.Back,
      });

      document.documentElement.classList.add('barcode-scanner-active');
      document.body.classList.add('barcode-scanner-active');
    });
  }

  async stop(): Promise<void> {
    document.documentElement.classList.remove('barcode-scanner-active');
    document.body.classList.remove('barcode-scanner-active');
    try {
      const { BarcodeScanner } = await getMlKitLib();
      await withPerfSpan('scanner.native.stop', async () => {
        await BarcodeScanner.stopScan();
        if (this.listenerHandle) {
          await this.listenerHandle.remove().catch(() => {});
          this.listenerHandle = null;
        }
      });
    } catch (err) {
      console.error('[CapacitorScanner] Stop failed:', err);
    }
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  async setTorch(enabled: boolean): Promise<void> {
    try {
      const { BarcodeScanner } = await getMlKitLib();
      const { available } = await BarcodeScanner.isTorchAvailable();
      if (!available) return;

      if (enabled) {
        await BarcodeScanner.enableTorch();
      } else {
        await BarcodeScanner.disableTorch();
      }
    } catch (err) {
      console.warn('[CapacitorScanner] Torch not supported', err);
    }
  }
}

/**
 * Factory to get the appropriate scanner for the current platform
 */
export const getScanner = (): IScanner => {
  const isNative = Capacitor.isNativePlatform();
  logCapacitorPerfAudit('scanner.factory', { isNative });
  if (isNative) {
    return new CapacitorScanner();
  }
  return new WebScanner();
};
