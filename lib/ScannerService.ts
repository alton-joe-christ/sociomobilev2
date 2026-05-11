import QrScanner from 'qr-scanner';
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
 * Web Implementation using Nimiq QrScanner
 * High performance, Worker-based scanning for PWA
 */
class WebScanner implements IScanner {
  private scanner: QrScanner | null = null;
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
    const t0 = performance.now();
    try {
      if (this.scanner) await this.stop();

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
          maxScansPerSecond: 25, // Increased for "instant" feel
          calculateScanRegion: (v) => {
             // ROI Optimization: Focus on the center 70% to reduce processing area
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
      console.log(`🔍 [ScannerPerf] Web Scanner Startup: ${performance.now() - t0}ms`);
    } catch (err) {
      console.error('[WebScanner] Start failed:', err);
      throw err;
    }
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
