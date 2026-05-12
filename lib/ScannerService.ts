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
}

/**
 * Web Implementation using Nimiq QrScanner
 * High performance, Worker-based scanning for PWA
 */
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

class WebScanner implements IScanner {
  private scanner: (Awaited<ReturnType<typeof getQrScannerLib>>['default']) | null = null;
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
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 25,
          calculateScanRegion: (v) => {
            const smallestDimension = Math.min(v.videoWidth, v.videoHeight);
            const scanRegionSize = Math.round(smallestDimension * 0.7);
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
}

/**
 * Native Implementation using Capacitor ML Kit
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
