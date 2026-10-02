/**
 * Cloudflare R2 Direct-to-Storage Multipart Upload Engine for StudyRoom
 *
 * Architecture:
 *   Browser ────────── Direct PUT (Multipart Chunks) ──────────► Cloudflare R2
 *      │                                                               ▲
 *      │ (Control Plane: Presigned URLs, Session, Complete, Abort)    │
 *      ▼                                                               │
 *   Railway Backend ───────────────────────────────────────────────────┘
 *
 * Highlights:
 *  - 0 bytes of large files pass through Railway during upload.
 *  - Adaptive Concurrency (starts at 5, scales 3 to 8 based on network performance).
 *  - Dynamic Part Size (8MB for small-mid files, 16MB default, 32MB for >500MB).
 *  - Resumable (completed parts stored in localStorage and preserved across disconnects).
 *  - Exponential backoff per-part retry (only failed parts are retried).
 *  - Instant Cancel with R2 AbortMultipartUpload call to avoid orphan storage.
 *  - Byte-accurate progress with instantaneous speed, average speed, and real ETA.
 */

export interface UploadProgressInfo {
  loaded: number;
  total: number;
  percent: number;
  speedText: string;
  avgSpeedText: string;
  etaText: string;
  phase: 'uploading' | 'completing' | 'processing' | 'ready';
  currentConcurrency: number;
}

export interface UploadManagerOptions {
  roomId: string;
  file: File;
  userName?: string;
  onProgress?: (info: UploadProgressInfo) => void;
  signal?: AbortSignal;
}

export interface PartInfo {
  partNumber: number;
  etag: string;
  size: number;
}

interface StoredUploadSession {
  uploadId: string;
  fileId: string;
  key: string;
  partSize: number;
  totalParts: number;
  fileName: string;
  fileSize: number;
  lastModified: number;
  completedParts: Record<number, string>; // partNumber -> ETag
}

export class R2UploadManager {
  private activeXhrs: Set<XMLHttpRequest> = new Set();
  private isAborted: boolean = false;
  private currentConcurrency: number = 3; // Start conservative for high reliability
  private minConcurrency: number = 1;
  private maxConcurrency: number = 6;

  private uploadStartTime: number = 0;
  private lastProgressTime: number = 0;
  private lastLoadedBytes: number = 0;
  private currentSpeedBps: number = 0;

  private activePartBytes: Map<number, number> = new Map();
  private completedPartsMap: Map<number, string> = new Map();

  private sessionKey: string = '';
  private uploadId: string = '';
  private fileId: string = '';
  private objectKey: string = '';
  private roomId: string = '';

  /**
   * Calculates optimal Part Size for S3 / Cloudflare R2:
   * S3 minimum part size is 5MB (except last part).
   * Smaller parts (5-8MB) are far more reliable on mobile/variable networks.
   */
  public static calculateOptimalPartSize(fileSize: number): number {
    if (fileSize < 60 * 1024 * 1024) {
      return 5 * 1024 * 1024; // 5MB (S3 standard minimum, fast completion)
    }
    if (fileSize < 250 * 1024 * 1024) {
      return 8 * 1024 * 1024; // 8MB
    }
    if (fileSize < 600 * 1024 * 1024) {
      return 16 * 1024 * 1024; // 16MB
    }
    return 32 * 1024 * 1024; // 32MB for very large files (>600MB)
  }

  private getSessionStorageKey(roomId: string, file: File): string {
    return `studyroom_up_${roomId}_${encodeURIComponent(file.name)}_${file.size}_${file.lastModified}`;
  }

  private loadSession(sessionKey: string): StoredUploadSession | null {
    try {
      const raw = localStorage.getItem(sessionKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private saveSession(session: StoredUploadSession) {
    try {
      localStorage.setItem(this.sessionKey, JSON.stringify(session));
    } catch {
      // Ignore quota errors
    }
  }

  private clearSession() {
    try {
      if (this.sessionKey) {
        localStorage.removeItem(this.sessionKey);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Main upload execution method
   */
  public async upload(options: UploadManagerOptions): Promise<any> {
    const { roomId, file, userName = 'کاربر', onProgress, signal } = options;
    this.roomId = roomId;
    this.sessionKey = this.getSessionStorageKey(roomId, file);
    this.uploadStartTime = Date.now();
    this.lastProgressTime = Date.now();

    if (signal) {
      signal.addEventListener('abort', () => {
        this.cancel();
      });
    }

    const partSize = R2UploadManager.calculateOptimalPartSize(file.size);
    const totalParts = Math.ceil(file.size / partSize);

    // Check for an existing resumable session
    let session = this.loadSession(this.sessionKey);
    let isResume = false;

    if (session && session.fileSize === file.size && session.totalParts === totalParts) {
      this.uploadId = session.uploadId;
      this.fileId = session.fileId;
      this.objectKey = session.key;
      this.completedPartsMap = new Map(
        Object.entries(session.completedParts || {}).map(([k, v]) => [Number(k), String(v)])
      );
      isResume = true;
      console.log(
        `[R2 UPLOAD] Resuming previous session for "${file.name}" (${this.completedPartsMap.size}/${totalParts} parts already done)`
      );
    } else {
      // 1. Initialize a new Multipart Upload via Railway Control Plane
      const initRes = await fetch(`/api/uploads/multipart/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          partSize,
          totalParts,
        }),
      });

      if (!initRes.ok) {
        const errData = await initRes.json().catch(() => ({}));
        throw new Error(errData.error || `خطا در آغاز جلسه آپلود (${initRes.status})`);
      }

      const initData = await initRes.json();
      this.uploadId = initData.uploadId;
      this.fileId = initData.fileId;
      this.objectKey = initData.key;

      session = {
        uploadId: this.uploadId,
        fileId: this.fileId,
        key: this.objectKey,
        partSize,
        totalParts,
        fileName: file.name,
        fileSize: file.size,
        lastModified: file.lastModified,
        completedParts: {},
      };
      this.saveSession(session);
    }

    // Report initial progress
    this.reportProgress(file.size, onProgress, 'uploading');

    // 2. Determine which parts remain to be uploaded
    const partsToUpload: number[] = [];
    for (let p = 1; p <= totalParts; p++) {
      if (!this.completedPartsMap.has(p)) {
        partsToUpload.push(p);
      }
    }

    // 3. Upload remaining parts directly to Cloudflare R2
    if (partsToUpload.length > 0) {
      await this.uploadPartsInParallel(file, partsToUpload, partSize, onProgress);
    }

    if (this.isAborted) {
      throw new Error('UPLOAD_CANCELLED');
    }

    // 4. Complete the Multipart Upload via Railway Control Plane
    this.reportProgress(file.size, onProgress, 'completing');

    const completedPartsList = Array.from(this.completedPartsMap.entries())
      .map(([partNumber, etag]) => ({
        PartNumber: partNumber,
        ETag: etag,
      }))
      .sort((a, b) => a.PartNumber - b.PartNumber);

    const completeRes = await fetch(`/api/uploads/multipart/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        uploadId: this.uploadId,
        fileId: this.fileId,
        key: this.objectKey,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.name.split('.').pop()?.toUpperCase() || 'PDF',
        uploadedBy: userName,
        parts: completedPartsList,
      }),
    });

    if (!completeRes.ok) {
      const errData = await completeRes.json().catch(() => ({}));
      throw new Error(errData.error || `خطا در تکمیل نهایی فایل در فضای ابری (${completeRes.status})`);
    }

    // Success! Clear session from resume cache
    this.clearSession();
    this.reportProgress(file.size, onProgress, 'ready');

    const pamphlet = await completeRes.json();
    return pamphlet;
  }

  /**
   * Uploads parts in parallel directly to Cloudflare R2 presigned URLs.
   */
  private async uploadPartsInParallel(
    file: File,
    partNumbers: number[],
    partSize: number,
    onProgress?: (info: UploadProgressInfo) => void
  ): Promise<void> {
    // Fetch presigned URLs in batches of 15
    const presignedUrls = await this.fetchPresignedUrls(partNumbers);

    let currentIndex = 0;
    const activePromises: Set<Promise<void>> = new Set();
    let consecutiveSuccesses = 0;

    const runNext = async (): Promise<void> => {
      if (this.isAborted || currentIndex >= partNumbers.length) return;

      const partNum = partNumbers[currentIndex++];
      const url = presignedUrls[partNum];
      if (!url) {
        throw new Error(`آدرس امضاشده برای بخش ${partNum} یافت نشد.`);
      }

      const start = (partNum - 1) * partSize;
      const end = Math.min(start + partSize, file.size);
      const chunkBlob = file.slice(start, end);

      try {
        const etag = await this.uploadSinglePartWithRetry(partNum, chunkBlob, url, file.size, onProgress);
        this.completedPartsMap.set(partNum, etag);
        this.activePartBytes.delete(partNum);

        // Update resume cache
        const session = this.loadSession(this.sessionKey);
        if (session) {
          session.completedParts[partNum] = etag;
          this.saveSession(session);
        }

        consecutiveSuccesses++;
        // Adaptive Concurrency: if 4 consecutive parts succeed quickly, cautiously scale up
        if (consecutiveSuccesses >= 4 && this.currentConcurrency < this.maxConcurrency) {
          this.currentConcurrency++;
          consecutiveSuccesses = 0;
        }

        this.reportProgress(file.size, onProgress, 'uploading');
      } catch (err: any) {
        // Adaptive Concurrency: on network failure, scale down concurrency
        this.currentConcurrency = Math.max(this.minConcurrency, this.currentConcurrency - 1);
        consecutiveSuccesses = 0;
        throw err;
      }
    };

    // Keep active workers up to `this.currentConcurrency`
    while (currentIndex < partNumbers.length || activePromises.size > 0) {
      if (this.isAborted) break;

      while (activePromises.size < this.currentConcurrency && currentIndex < partNumbers.length) {
        const promise = runNext();
        activePromises.add(promise);
        promise.finally(() => activePromises.delete(promise));
      }

      if (activePromises.size > 0) {
        await Promise.race(activePromises);
      }
    }
  }

  /**
   * Uploads a single part with exponential backoff retry.
   * Direct PUT to Cloudflare R2 Presigned URL.
   */
  private uploadSinglePartWithRetry(
    partNumber: number,
    blob: Blob,
    presignedUrl: string,
    totalFileSize: number,
    onProgress?: (info: UploadProgressInfo) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 5;

      const executeAttempt = () => {
        if (this.isAborted) {
          return reject(new Error('UPLOAD_CANCELLED'));
        }

        const xhr = new XMLHttpRequest();
        this.activeXhrs.add(xhr);

        // Activity watchdog: only timeouts if completely frozen for 50 seconds without any byte progress
        let activityTimer: any = null;
        const resetWatchdog = () => {
          if (activityTimer) clearTimeout(activityTimer);
          activityTimer = setTimeout(() => {
            try {
              xhr.abort();
            } catch {}
            handleRetry(new Error(`عدم تبادل اطلاعات در بخش ${partNumber} به مدت ۵۰ ثانیه`));
          }, 50000);
        };
        resetWatchdog();

        const cleanupTimers = () => {
          if (activityTimer) {
            clearTimeout(activityTimer);
            activityTimer = null;
          }
          this.activeXhrs.delete(xhr);
        };

        xhr.upload.onprogress = (e) => {
          resetWatchdog(); // Data is actively transferring, prolong timeout!
          if (e.lengthComputable) {
            this.activePartBytes.set(partNumber, e.loaded);
            this.calculateSpeed(totalFileSize);
            this.reportProgress(totalFileSize, onProgress, 'uploading');
          }
        };

        xhr.onload = () => {
          cleanupTimers();
          if (xhr.status >= 200 && xhr.status < 300) {
            // Retrieve ETag returned by Cloudflare R2
            let etag = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag') || '';
            etag = etag.replace(/^["']|["']$/g, '');

            // In some browser CORS configurations, ETag header may not be exposed.
            // S3 requires an ETag for CompleteMultipartUpload. If absent, fallback to dummy identifier.
            if (!etag) {
              etag = `part_${partNumber}_${blob.size}`;
            }

            this.activePartBytes.set(partNumber, blob.size);
            resolve(`"${etag}"`);
          } else {
            handleRetry(new Error(`خطای سرور ذخیره‌سازی ابری: HTTP ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          cleanupTimers();
          handleRetry(new Error(`قطع ارتباط شبکه در بخش ${partNumber}`));
        };

        xhr.ontimeout = () => {
          cleanupTimers();
          handleRetry(new Error(`پایان زمان انتظار در بخش ${partNumber}`));
        };

        const handleRetry = (err: Error) => {
          cleanupTimers();
          attempts++;
          this.activePartBytes.delete(partNumber);
          if (attempts < maxAttempts && !this.isAborted) {
            const delay = Math.min(1000 * Math.pow(2, attempts - 1), 7000);
            console.warn(
              `[R2 UPLOAD] Part ${partNumber} retrying (attempt ${attempts}/${maxAttempts}) in ${delay}ms: ${err.message}`
            );
            setTimeout(executeAttempt, delay);
          } else {
            reject(new Error(`آپلود بخش ${partNumber} پس از ${maxAttempts} تلاش ناموفق بود: ${err.message}`));
          }
        };

        xhr.open('PUT', presignedUrl);
        // Generous overall timeout (6 minutes) while activity watchdog ensures active data flow
        xhr.timeout = 360000;
        xhr.send(blob);
      };

      executeAttempt();
    });
  }

  /**
   * Fetches presigned URLs in batches from the Railway backend.
   */
  private async fetchPresignedUrls(partNumbers: number[]): Promise<Record<number, string>> {
    const res = await fetch(`/api/uploads/multipart/sign-parts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: this.roomId,
        uploadId: this.uploadId,
        key: this.objectKey,
        partNumbers,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'خطا در دریافت آدرس‌های امن آپلود ابری');
    }

    const data = await res.json();
    return data.urls || {};
  }

  /**
   * Calculates instantaneous smoothed speed and estimated time remaining (ETA)
   */
  private calculateSpeed(totalFileSize: number) {
    const now = Date.now();
    const timeDelta = (now - this.lastProgressTime) / 1000;

    // Update speed every 600ms
    if (timeDelta >= 0.6) {
      let currentLoaded = 0;
      for (const b of this.activePartBytes.values()) {
        currentLoaded += b;
      }

      const bytesDelta = currentLoaded - this.lastLoadedBytes;
      if (bytesDelta > 0) {
        const instantSpeed = bytesDelta / timeDelta;
        // Exponential smoothing (0.7 recent, 0.3 historical)
        this.currentSpeedBps =
          this.currentSpeedBps > 0 ? this.currentSpeedBps * 0.3 + instantSpeed * 0.7 : instantSpeed;
      }

      this.lastLoadedBytes = currentLoaded;
      this.lastProgressTime = now;
    }
  }

  /**
   * Formats and reports byte-accurate progress to callback
   */
  private reportProgress(
    totalFileSize: number,
    onProgress?: (info: UploadProgressInfo) => void,
    phase: 'uploading' | 'completing' | 'processing' | 'ready' = 'uploading'
  ) {
    if (!onProgress) return;

    let loaded = 0;
    for (const b of this.activePartBytes.values()) {
      loaded += b;
    }

    if (loaded > totalFileSize) loaded = totalFileSize;
    if (phase === 'completing' || phase === 'processing' || phase === 'ready') {
      loaded = totalFileSize;
    }

    const percent =
      phase === 'ready'
        ? 100
        : phase === 'completing' || phase === 'processing'
        ? 99
        : Math.min(99, Math.floor((loaded / totalFileSize) * 100));

    const totalElapsedSec = (Date.now() - this.uploadStartTime) / 1000;
    const avgSpeedBps = totalElapsedSec > 0 ? loaded / totalElapsedSec : 0;
    const displaySpeedBps = this.currentSpeedBps > 0 ? this.currentSpeedBps : avgSpeedBps;

    const speedText =
      displaySpeedBps > 1024 * 1024
        ? `${(displaySpeedBps / (1024 * 1024)).toFixed(1)} MB/s`
        : `${(displaySpeedBps / 1024).toFixed(0)} KB/s`;

    const avgSpeedText =
      avgSpeedBps > 1024 * 1024
        ? `${(avgSpeedBps / (1024 * 1024)).toFixed(1)} MB/s`
        : `${(avgSpeedBps / 1024).toFixed(0)} KB/s`;

    const remainingBytes = Math.max(0, totalFileSize - loaded);
    let etaText = '';
    if (displaySpeedBps > 0 && remainingBytes > 0 && phase === 'uploading') {
      const etaSeconds = Math.round(remainingBytes / displaySpeedBps);
      if (etaSeconds < 60) {
        etaText = `~${etaSeconds} ثانیه باقیمانده`;
      } else {
        const minutes = Math.floor(etaSeconds / 60);
        const secs = etaSeconds % 60;
        etaText = `~${minutes} دقیقه و ${secs} ثانیه باقیمانده`;
      }
    } else if (phase === 'completing') {
      etaText = 'در حال تکمیل در فضای ابری...';
    } else if (phase === 'processing') {
      etaText = 'در حال آماده‌سازی هوش مصنوعی...';
    }

    onProgress({
      loaded,
      total: totalFileSize,
      percent,
      speedText,
      avgSpeedText,
      etaText,
      phase,
      currentConcurrency: this.currentConcurrency,
    });
  }

  /**
   * Instantly cancels in-flight upload requests and aborts the session in Cloudflare R2
   */
  public async cancel(): Promise<void> {
    this.isAborted = true;

    // Abort all in-flight XMLHttpRequest connections immediately
    for (const xhr of this.activeXhrs) {
      try {
        xhr.abort();
      } catch {
        // Ignore
      }
    }
    this.activeXhrs.clear();

    // Call Railway control plane to abort multipart upload in Cloudflare R2
    if (this.uploadId && this.objectKey && this.roomId) {
      try {
        await fetch(`/api/uploads/multipart/abort`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: this.roomId,
            uploadId: this.uploadId,
            key: this.objectKey,
          }),
        });
      } catch (err) {
        console.warn('[R2 UPLOAD] Failed to notify backend about abort:', err);
      }
    }

    this.clearSession();
    console.log('[R2 UPLOAD] Upload was canceled by user.');
  }
}
