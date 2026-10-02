import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { GoogleGenAI } from '@google/genai';
import type { PamphletChunk, PamphletFile } from '../types';

export interface ProcessingJob {
  fileId: string;
  roomId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  totalPages: number;
  processedPages: number;
  status: 'processing' | 'ready' | 'error' | 'scanned_ocr_required';
  error?: string;
  errorCode?: string;
  totalChunks?: number;
  createdAt: string;
  updatedAt: string;
}

export type ProgressCallback = (progress: {
  fileId: string;
  roomId: string;
  fileName: string;
  status: 'processing' | 'ready' | 'error' | 'scanned_ocr_required';
  current: number;
  total: number;
  percent: number;
  error?: string;
  errorCode?: string;
}) => void;

const DATA_DIR = path.resolve(process.cwd(), '.data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const CHUNKS_DIR = path.join(DATA_DIR, 'chunks');
const JOBS_DIR = path.join(DATA_DIR, 'jobs');

// Ensure directories exist
function ensureDirectories() {
  try {
    for (const dir of [DATA_DIR, UPLOADS_DIR, CHUNKS_DIR, JOBS_DIR]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  } catch (err) {
    console.warn('[PAMPHLET PROCESSOR] Could not ensure directories:', err);
  }
}
ensureDirectories();

// Persian & English text normalizer
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[۰]/g, '0')
    .replace(/[۱]/g, '1')
    .replace(/[۲]/g, '2')
    .replace(/[۳]/g, '3')
    .replace(/[۴]/g, '4')
    .replace(/[۵]/g, '5')
    .replace(/[۶]/g, '6')
    .replace(/[۷]/g, '7')
    .replace(/[۸]/g, '8')
    .replace(/[۹]/g, '9')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ');
}

// Convert numbers in string to english
export function extractPageNumberFromQuery(query: string): number | null {
  const normalized = normalizeText(query);
  const match = normalized.match(/(?:صفحه|ص|page|p\.?)\s*(\d+)/i);
  if (match) {
    const num = parseInt(match[1], 10);
    return isNaN(num) ? null : num;
  }
  return null;
}

// Persian stopwords
const STOP_WORDS = new Set([
  'و', 'در', 'به', 'از', 'که', 'این', 'را', 'با', 'است', 'برای', 'آن', 'یک', 'شود', 'خود',
  'تا', 'کرد', 'بر', 'هم', 'نیز', 'گفت', 'می', 'شد', 'ایشان', 'او', 'ما', 'شما', 'آنها',
  'چیست', 'کیست', 'کدام', 'چگونه', 'چرا', 'چه', 'توضیح', 'بده', 'کن', 'درباره', 'مورد',
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'with', 'about'
]);

// Tokenizer for Persian and English
export function tokenize(text: string): string[] {
  const norm = normalizeText(text).toLowerCase();
  const words = norm
    .split(/[\s,،؛.:;!؟?()\[\]{}"'«»\/\\+\-=*&^%$#@~`_]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return words;
}

// Split page text into overlapping chunks preserving Room ID
export function chunkPageText(
  pageText: string,
  metadata: {
    roomId: string;
    fileId: string;
    fileName: string;
    pageNumber: number;
  },
  chunkSize = 650,
  overlap = 120
): PamphletChunk[] {
  const clean = pageText.trim();
  if (!clean) return [];

  const chunks: PamphletChunk[] = [];
  let chunkIndex = 0;

  if (clean.length <= chunkSize + 150) {
    chunks.push({
      id: `${metadata.fileId}-p${metadata.pageNumber}-c0`,
      roomId: metadata.roomId,
      fileId: metadata.fileId,
      fileName: metadata.fileName,
      pageNumber: metadata.pageNumber,
      chunkIndex: 0,
      text: clean,
      tokenCount: Math.ceil(clean.length / 4),
    });
    return chunks;
  }

  const paragraphs = clean.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  let currentBuffer = '';

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (currentBuffer.length + trimmedPara.length + 1 <= chunkSize) {
      currentBuffer += (currentBuffer ? '\n\n' : '') + trimmedPara;
    } else {
      if (currentBuffer) {
        chunks.push({
          id: `${metadata.fileId}-p${metadata.pageNumber}-c${chunkIndex++}`,
          roomId: metadata.roomId,
          fileId: metadata.fileId,
          fileName: metadata.fileName,
          pageNumber: metadata.pageNumber,
          chunkIndex: chunkIndex - 1,
          text: currentBuffer.trim(),
          tokenCount: Math.ceil(currentBuffer.length / 4),
        });
        const overlapSlice = currentBuffer.slice(-overlap);
        currentBuffer = overlapSlice + '\n' + trimmedPara;
      } else {
        let start = 0;
        while (start < trimmedPara.length) {
          const end = Math.min(start + chunkSize, trimmedPara.length);
          const slice = trimmedPara.slice(start, end).trim();
          if (slice) {
            chunks.push({
              id: `${metadata.fileId}-p${metadata.pageNumber}-c${chunkIndex++}`,
              roomId: metadata.roomId,
              fileId: metadata.fileId,
              fileName: metadata.fileName,
              pageNumber: metadata.pageNumber,
              chunkIndex: chunkIndex - 1,
              text: slice,
              tokenCount: Math.ceil(slice.length / 4),
            });
          }
          start += chunkSize - overlap;
        }
        currentBuffer = '';
      }
    }
  }

  if (currentBuffer.trim()) {
    chunks.push({
      id: `${metadata.fileId}-p${metadata.pageNumber}-c${chunkIndex++}`,
      roomId: metadata.roomId,
      fileId: metadata.fileId,
      fileName: metadata.fileName,
      pageNumber: metadata.pageNumber,
      chunkIndex: chunkIndex - 1,
      text: currentBuffer.trim(),
      tokenCount: Math.ceil(currentBuffer.length / 4),
    });
  }

  return chunks;
}

// Job Checkpoint Persistence
function getJobFilePath(fileId: string): string {
  return path.join(JOBS_DIR, `${fileId}.json`);
}

export function saveJobCheckpoint(job: ProcessingJob): void {
  ensureDirectories();
  job.updatedAt = new Date().toISOString();
  try {
    fs.writeFileSync(getJobFilePath(job.fileId), JSON.stringify(job, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[PAMPHLET LOG] Failed to save job checkpoint:', err);
  }
}

export function getJob(fileId: string): ProcessingJob | null {
  const p = getJobFilePath(fileId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

// Chunks Persistence per Room and File
function getChunksFilePath(roomId: string, fileId: string): string {
  const roomDir = path.join(CHUNKS_DIR, roomId);
  try {
    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create room chunks directory:', err);
  }
  return path.join(roomDir, `${fileId}.json`);
}

export function saveChunks(roomId: string, fileId: string, chunks: PamphletChunk[]): void {
  const p = getChunksFilePath(roomId, fileId);
  try {
    fs.writeFileSync(p, JSON.stringify(chunks, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[PAMPHLET LOG] Failed to save chunks:', err);
  }
}

export function loadChunksForFile(roomId: string, fileId: string): PamphletChunk[] {
  const p = getChunksFilePath(roomId, fileId);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return [];
  }
}

export function loadAllChunksForRoom(roomId: string): PamphletChunk[] {
  const roomDir = path.join(CHUNKS_DIR, roomId);
  if (!fs.existsSync(roomDir)) return [];

  const chunks: PamphletChunk[] = [];
  try {
    const files = fs.readdirSync(roomDir);
    for (const f of files) {
      if (f.endsWith('.json')) {
        const fullPath = path.join(roomDir, f);
        try {
          const fileChunks: PamphletChunk[] = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          const filtered = fileChunks.filter((c) => c.roomId === roomId);
          chunks.push(...filtered);
        } catch {}
      }
    }
  } catch (err) {
    console.error(`[PAMPHLET LOG] Failed to load chunks for room ${roomId}:`, err);
  }
  return chunks;
}

export function deleteChunksForFile(roomId: string, fileId: string): void {
  const p = getChunksFilePath(roomId, fileId);
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch {}
  }
  const jobPath = getJobFilePath(fileId);
  if (fs.existsSync(jobPath)) {
    try { fs.unlinkSync(jobPath); } catch {}
  }
}

/**
 * Main Processor Class for Multi-page Documents (PDF, DOCX, TXT)
 */
export class PamphletProcessor {
  private activeJobs = new Map<string, boolean>();

  public getUploadPath(roomId: string, fileId: string, originalName: string): string {
    const roomUploads = path.join(UPLOADS_DIR, roomId);
    try {
      if (!fs.existsSync(roomUploads)) {
        fs.mkdirSync(roomUploads, { recursive: true });
      }
    } catch (err) {
      console.warn('Could not create room uploads folder:', err);
    }
    const safeExt = path.extname(originalName) || '';
    return path.join(roomUploads, `${fileId}${safeExt}`);
  }

  /**
   * Start or resume document processing in background with structured logging
   */
  public async processDocument(
    job: ProcessingJob,
    onProgress?: ProgressCallback
  ): Promise<{ totalPages: number; totalChunks: number }> {
    if (this.activeJobs.get(job.fileId)) {
      console.log(`[PAMPHLET LOG] PROCESSING_SKIPPED fileId=${job.fileId} reason=already_active`);
      return { totalPages: job.totalPages, totalChunks: job.totalChunks || 0 };
    }

    this.activeJobs.set(job.fileId, true);
    job.status = 'processing';
    saveJobCheckpoint(job);

    console.log(`[PAMPHLET LOG] PROCESSING_STARTED fileId=${job.fileId} roomId=${job.roomId} fileName="${job.fileName}" path=${job.filePath}`);

    try {
      if (!fs.existsSync(job.filePath)) {
        throw new Error(`STORAGE_READ_FAILED: File not found at path ${job.filePath}`);
      }

      const ext = path.extname(job.fileName).toLowerCase();
      let totalPages = job.totalPages || 0;
      let allChunks: PamphletChunk[] = [];

      console.log(`[PAMPHLET LOG] TEXT_EXTRACTION_STARTED fileId=${job.fileId} type=${ext}`);

      if (ext === '.pdf') {
        const result = await this.processPdf(job, onProgress);
        totalPages = result.totalPages;
        allChunks = result.chunks;
      } else if (ext === '.docx' || ext === '.doc') {
        const result = await this.processDocx(job, onProgress);
        totalPages = result.totalPages;
        allChunks = result.chunks;
      } else if (ext === '.txt' || ext === '.text') {
        const result = await this.processTxt(job, onProgress);
        totalPages = result.totalPages;
        allChunks = result.chunks;
      } else {
        throw new Error(`UNSUPPORTED_FILE: Extension ${ext} is not supported`);
      }

      console.log(`[PAMPHLET LOG] TEXT_EXTRACTION_COMPLETED fileId=${job.fileId} totalPages=${totalPages}`);
      console.log(`[PAMPHLET LOG] CHUNKING_COMPLETED fileId=${job.fileId} totalChunks=${allChunks.length}`);

      if (allChunks.length === 0 && totalPages > 0) {
        job.status = 'scanned_ocr_required';
        job.errorCode = 'SCANNED_PDF_NEEDS_OCR';
        job.error = 'این فایل اسکن‌شده/تصویری است و متن قابل استخراج متنی ندارد.';
      } else {
        job.status = 'ready';
        job.errorCode = undefined;
        job.error = undefined;
      }

      job.totalPages = totalPages;
      job.processedPages = totalPages;
      job.totalChunks = allChunks.length;
      saveJobCheckpoint(job);

      console.log(`[PAMPHLET LOG] PROCESSING_COMPLETED fileId=${job.fileId} status=${job.status} totalChunks=${allChunks.length}`);

      if (onProgress) {
        onProgress({
          fileId: job.fileId,
          roomId: job.roomId,
          fileName: job.fileName,
          status: job.status,
          current: totalPages,
          total: totalPages,
          percent: 100,
          error: job.error,
          errorCode: job.errorCode,
        });
      }

      this.activeJobs.delete(job.fileId);
      return { totalPages, totalChunks: allChunks.length };
    } catch (err: unknown) {
      this.activeJobs.delete(job.fileId);
      const errMsg = err instanceof Error ? err.message : String(err);
      
      let errorCode = 'PROCESSING_FAILED';
      if (errMsg.includes('STORAGE_READ_FAILED')) errorCode = 'STORAGE_READ_FAILED';
      else if (errMsg.includes('UNSUPPORTED_FILE')) errorCode = 'UNSUPPORTED_FILE';
      else if (errMsg.includes('DOCX_EXTRACTION_FAILED')) errorCode = 'DOCX_EXTRACTION_FAILED';
      else if (errMsg.includes('PDF_EXTRACTION_FAILED')) errorCode = 'PDF_EXTRACTION_FAILED';
      else if (errMsg.includes('FILE_EMPTY')) errorCode = 'FILE_EMPTY';

      console.error(`[PAMPHLET LOG ERROR] PROCESSING_FAILED fileId=${job.fileId} code=${errorCode} message=${errMsg}`, err);

      job.status = 'error';
      job.error = errMsg;
      job.errorCode = errorCode;
      saveJobCheckpoint(job);

      if (onProgress) {
        onProgress({
          fileId: job.fileId,
          roomId: job.roomId,
          fileName: job.fileName,
          status: 'error',
          current: job.processedPages,
          total: job.totalPages || 1,
          percent: 0,
          error: errMsg,
          errorCode,
        });
      }
      throw err;
    }
  }

  /**
   * PDF processor using cross-platform pure TypeScript/Node PDFParse
   * Runs natively in Node.js / Railway without browser DOM or worker threads.
   */
  private async processPdf(
    job: ProcessingJob,
    onProgress?: ProgressCallback
  ): Promise<{ totalPages: number; chunks: PamphletChunk[] }> {
    try {
      const fileBytes = fs.readFileSync(job.filePath);
      const uint8Array = new Uint8Array(fileBytes);

      if (uint8Array.length === 0) {
        throw new Error('FILE_EMPTY: PDF file is zero bytes');
      }

      const parser = new PDFParse(uint8Array);
      const parsed = await parser.getText();

      const pages = parsed.pages || [];
      const totalPages = parsed.total || pages.length || 1;
      job.totalPages = totalPages;

      const chunks: PamphletChunk[] = [];
      let processedCount = 0;

      for (let i = 0; i < pages.length; i++) {
        const pageObj = pages[i];
        const pageNum = pageObj.num || i + 1;
        const rawText = (pageObj.text || '').trim();

        if (rawText.length > 0) {
          const pageChunks = chunkPageText(rawText, {
            roomId: job.roomId,
            fileId: job.fileId,
            fileName: job.fileName,
            pageNumber: pageNum,
          });
          chunks.push(...pageChunks);
        }

        processedCount++;
        job.processedPages = processedCount;

        if (onProgress && totalPages > 0) {
          const percent = Math.min(99, Math.round((processedCount / totalPages) * 100));
          onProgress({
            fileId: job.fileId,
            roomId: job.roomId,
            fileName: job.fileName,
            status: 'processing',
            current: processedCount,
            total: totalPages,
            percent,
          });
        }
      }

      if (chunks.length === 0 && totalPages > 0) {
        console.log(`[PAMPHLET LOG] PDF has no extractable text. Attempting Gemini OCR fallback for fileId=${job.fileId}...`);
        try {
          const ocrChunks = await this.runGeminiOcr(job);
          if (ocrChunks && ocrChunks.length > 0) {
            chunks.push(...ocrChunks);
            console.log(`[PAMPHLET LOG] Gemini OCR fallback succeeded! Extracted ${chunks.length} chunks for fileId=${job.fileId}`);
          }
        } catch (ocrErr) {
          console.error(`[PAMPHLET LOG ERROR] Gemini OCR fallback failed for fileId=${job.fileId}:`, ocrErr);
        }
      }

      saveChunks(job.roomId, job.fileId, chunks);
      return { totalPages, chunks };
    } catch (err: unknown) {
      console.error(`[PAMPHLET LOG ERROR] PDF_EXTRACTION_FAILED fileId=${job.fileId}:`, err);
      throw new Error(`PDF_EXTRACTION_FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Run Gemini OCR on scanned PDF pages
   */
  private async runGeminiOcr(job: ProcessingJob): Promise<PamphletChunk[]> {
    const apiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.API_KEY ||
      ''
    ).trim().replace(/^["']|["']$/g, '');

    if (!apiKey) {
      console.warn('[PAMPHLET LOG] Gemini API key not set, skipping OCR fallback.');
      return [];
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const fileBytes = fs.readFileSync(job.filePath);
      const base64Data = fileBytes.toString('base64');

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data,
            },
          },
          {
            text: `شما یک پردازشگر سند فوق‌پیشرفته هستید. لطفاً تمام صفحات این فایل PDF اسکن‌شده یا تصویری را بخوانید و متن فارسی و انگلیسی هر صفحه را به صورت مجزا استخراج کنید.
پاسخ خود را دقیقاً در قالب فرمت JSON زیر بازگردانید (فقط یک آرایه JSON و بدون هیچ متن اضافه یا قالب‌بندی دیگر):
[
  {
    "page": 1,
    "text": "متن استخراج شده از صفحه اول"
  },
  {
    "page": 2,
    "text": "متن استخراج شده از صفحه دوم"
  }
]`,
          }
        ],
        config: {
          responseMimeType: 'application/json',
        }
      });

      if (!response.text) {
        return [];
      }

      const parsed: Array<{ page: number; text: string }> = JSON.parse(response.text.trim());
      const chunks: PamphletChunk[] = [];

      for (const item of parsed) {
        const pageNum = item.page || 1;
        const pageText = (item.text || '').trim();
        if (pageText) {
          const pageChunks = chunkPageText(pageText, {
            roomId: job.roomId,
            fileId: job.fileId,
            fileName: job.fileName,
            pageNumber: pageNum,
          });
          chunks.push(...pageChunks);
        }
      }

      return chunks;
    } catch (err) {
      console.error('[PAMPHLET LOG ERROR] Gemini OCR fallback failed:', err);
      return [];
    }
  }

  /**
   * DOCX processor using Mammoth to extract raw text
   */
  private async processDocx(
    job: ProcessingJob,
    onProgress?: ProgressCallback
  ): Promise<{ totalPages: number; chunks: PamphletChunk[] }> {
    try {
      const rawResult = await mammoth.extractRawText({ path: job.filePath });
      const fullText = (rawResult.value || '').trim();

      if (!fullText) {
        throw new Error('FILE_EMPTY: DOCX file contains no text');
      }

      const pageSize = 1800;
      const pages: string[] = [];
      let start = 0;
      while (start < fullText.length) {
        pages.push(fullText.slice(start, start + pageSize));
        start += pageSize;
      }

      const totalPages = pages.length || 1;
      job.totalPages = totalPages;
      const chunks: PamphletChunk[] = [];

      for (let i = 0; i < pages.length; i++) {
        const pageNum = i + 1;
        const pageChunks = chunkPageText(pages[i], {
          roomId: job.roomId,
          fileId: job.fileId,
          fileName: job.fileName,
          pageNumber: pageNum,
        });
        chunks.push(...pageChunks);

        job.processedPages = pageNum;
        if (onProgress) {
          const percent = Math.round((pageNum / totalPages) * 100);
          onProgress({
            fileId: job.fileId,
            roomId: job.roomId,
            fileName: job.fileName,
            status: 'processing',
            current: pageNum,
            total: totalPages,
            percent,
          });
        }
      }

      saveChunks(job.roomId, job.fileId, chunks);
      return { totalPages, chunks };
    } catch (err: unknown) {
      console.error(`[PAMPHLET LOG ERROR] DOCX_EXTRACTION_FAILED fileId=${job.fileId}:`, err);
      throw new Error(`DOCX_EXTRACTION_FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * TXT processor: splits by character/line count into distinct pages
   */
  private async processTxt(
    job: ProcessingJob,
    onProgress?: ProgressCallback
  ): Promise<{ totalPages: number; chunks: PamphletChunk[] }> {
    try {
      const fullText = fs.readFileSync(job.filePath, 'utf-8').trim();
      if (!fullText) {
        throw new Error('FILE_EMPTY: Text file is empty');
      }

      const pageSize = 1500;
      const pages: string[] = [];
      let start = 0;
      while (start < fullText.length) {
        pages.push(fullText.slice(start, start + pageSize));
        start += pageSize;
      }

      const totalPages = pages.length || 1;
      job.totalPages = totalPages;
      const chunks: PamphletChunk[] = [];

      for (let i = 0; i < pages.length; i++) {
        const pageNum = i + 1;
        const pageChunks = chunkPageText(pages[i], {
          roomId: job.roomId,
          fileId: job.fileId,
          fileName: job.fileName,
          pageNumber: pageNum,
        });
        chunks.push(...pageChunks);

        job.processedPages = pageNum;
        if (onProgress) {
          const percent = Math.round((pageNum / totalPages) * 100);
          onProgress({
            fileId: job.fileId,
            roomId: job.roomId,
            fileName: job.fileName,
            status: 'processing',
            current: pageNum,
            total: totalPages,
            percent,
          });
        }
      }

      saveChunks(job.roomId, job.fileId, chunks);
      return { totalPages, chunks };
    } catch (err: unknown) {
      console.error(`[PAMPHLET LOG ERROR] TXT_EXTRACTION_FAILED fileId=${job.fileId}:`, err);
      throw new Error(`TXT_EXTRACTION_FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Semantic BM25-like search across room's pamphlet chunks
   * STRICT ROOM ISOLATION: loads ONLY chunks belonging to roomId
   */
  public searchRelevantChunks(
    roomId: string,
    query: string,
    topK = 8
  ): { chunk: PamphletChunk; score: number }[] {
    const allChunks = loadAllChunksForRoom(roomId);
    if (allChunks.length === 0) return [];

    const explicitPage = extractPageNumberFromQuery(query);
    const queryTokens = tokenize(query);

    if (queryTokens.length === 0 && !explicitPage) {
      return allChunks.slice(0, topK).map((chunk) => ({ chunk, score: 1 }));
    }

    const scored = allChunks.map((chunk) => {
      let score = 0;
      const chunkNorm = normalizeText(chunk.text).toLowerCase();

      if (explicitPage && chunk.pageNumber === explicitPage) {
        score += 25.0;
      }

      for (const token of queryTokens) {
        // Count occurrences of token in chunkNorm safely and robustly for Persian/Arabic
        const count = chunkNorm.split(token).length - 1;
        if (count > 0) {
          score += count * 4.0;
        }
      }

      return { chunk, score };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Resume pending or interrupted jobs across all rooms
   */
  public resumePendingJobs(onProgress?: ProgressCallback): void {
    if (!fs.existsSync(JOBS_DIR)) return;
    try {
      const files = fs.readdirSync(JOBS_DIR);
      for (const f of files) {
        if (f.endsWith('.json')) {
          const jobPath = path.join(JOBS_DIR, f);
          try {
            const job: ProcessingJob = JSON.parse(fs.readFileSync(jobPath, 'utf-8'));
            if ((job.status === 'processing' || job.status === 'error') && fs.existsSync(job.filePath)) {
              console.log(`[PAMPHLET LOG] Auto-resuming job ${job.fileId} (${job.fileName})`);
              this.processDocument(job, onProgress).catch((e) => {
                console.warn(`[PAMPHLET LOG] Job ${job.fileId} error on resume:`, e);
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      console.warn('[PAMPHLET LOG] Failed to resume jobs:', err);
    }
  }
}

export const pamphletProcessor = new PamphletProcessor();
