import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { BarcodeScanner, BarcodeFormat, LensFacing } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';

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
 * Web Implementation using ZXing
 */
class WebScanner implements IScanner {
  private reader: BrowserQRCodeReader;
  private controls: IScannerControls | null = null;
  private isPaused = false;

  constructor() {
    this.reader = new BrowserQRCodeReader(undefined, {
      delayBetweenScanAttempts: 100,
    });
  }

  async checkPermission(): Promise<PermissionStatus> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return 'unsupported';
    try {
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
    const t0 = performance.now();
    try {
      this.controls = await this.reader.decodeFromVideoDevice(
        undefined, 
        videoElement,
        (result) => {
          if (this.isPaused) return;
          if (result) {
            console.log(`🔍 [ScannerPerf] QR Detected on Web: ${performance.now() - t0}ms since start`);
            onScan({
              data: result.getText(),
              format: result.getBarcodeFormat().toString(),
            });
          }
        }
      );
      console.log(`🔍 [ScannerPerf] Web Scanner Startup Time: ${performance.now() - t0}ms`);
    } catch (err) {
      console.error('[WebScanner] Start failed:', err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.controls) {
      this.controls.stop();
      this.controls = null;
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

  async checkPermission(): Promise<PermissionStatus> {
    try {
      const status = await BarcodeScanner.checkPermissions();
      return status.camera as PermissionStatus;
    } catch {
      return 'unsupported';
    }
  }

  async requestPermission(): Promise<PermissionStatus> {
    try {
      const status = await BarcodeScanner.requestPermissions();
      return status.camera as PermissionStatus;
    } catch {
      return 'denied';
    }
  }

  async start(_videoElement: HTMLVideoElement, onScan: (result: ScannerResult) => void): Promise<void> {
    const t0 = performance.now();
    try {
      // Start scanning
      await BarcodeScanner.addListener('barcodesScanned', (event) => {
        if (this.isPaused || !event.barcodes.length) return;
        const barcode = event.barcodes[0];
        console.log(`🔍 [ScannerPerf] Native ML Kit Detected QR`);
        onScan({
          data: barcode.displayValue,
          format: barcode.format,
        });
      });

      await BarcodeScanner.startScan({
        formats: [BarcodeFormat.QrCode],
        lensFacing: LensFacing.Back,
      });

      console.log(`🔍 [ScannerPerf] Native Scanner Startup Time: ${performance.now() - t0}ms`);
      document.documentElement.classList.add('barcode-scanner-active');
      document.body.classList.add('barcode-scanner-active');
    } catch (err) {
      console.error('[CapacitorScanner] Start failed:', err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    document.documentElement.classList.remove('barcode-scanner-active');
    document.body.classList.remove('barcode-scanner-active');
    try {
      await BarcodeScanner.stopScan();
      await BarcodeScanner.removeAllListeners();
      console.log('[CapacitorScanner] Scan stopped successfully.');
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
  if (isNative) {
    return new CapacitorScanner();
  }
  return new WebScanner();
};
