import '../src/services/pdfPolyfill';
import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  pamphletProcessor,
  saveJobCheckpoint,
  getJob,
  loadAllChunksForRoom,
  loadChunksForFile,
  tokenize,
  extractPageNumberFromQuery,
  type ProcessingJob,
} from '../src/services/pamphletProcessor';

async function generateTestPdf(pagesText: string[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const txt of pagesText) {
    const page = pdfDoc.addPage([600, 400]);
    if (txt.trim()) {
      page.drawText(txt.trim(), { x: 50, y: 350, size: 14, font });
    }
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

async function runTests() {
  console.log('====================================================');
  console.log('   RUNNING STUDYROOM PAMPHLET PIPELINE TEST SUITE   ');
  console.log('====================================================\n');

  const testDir = path.resolve(process.cwd(), '.data/test_fixtures');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const roomId1 = 'ROOM_MATH_TEST';
  const roomId2 = 'ROOM_HISTORY_TEST';

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      process.exitCode = 1;
    }
  }

  // 1. Tokenizer & Page number query extraction
  assert(extractPageNumberFromQuery('لطفاً صفحه ۸۴ را توضیح بده') === 84, 'Query page extraction (Persian digits: صفحه ۸۴ -> 84)');
  assert(extractPageNumberFromQuery('What is on page 12?') === 12, 'Query page extraction (English digits: page 12 -> 12)');
  assert(tokenize('فرمول مشتق در صفحه ۳ چیست؟').includes('مشتق'), 'Persian stopword filtering & tokenization');

  // 2. Normal Single-Page PDF
  const singlePdfPath = path.join(testDir, 'single_page.pdf');
  const singleBytes = await generateTestPdf(['Physics quantum mechanics notes and wave function fundamentals.']);
  fs.writeFileSync(singlePdfPath, singleBytes);
  const job1: ProcessingJob = {
    fileId: 'f_single_pdf',
    roomId: roomId1,
    fileName: 'single_page.pdf',
    filePath: singlePdfPath,
    fileType: 'PDF',
    totalPages: 1,
    processedPages: 0,
    status: 'processing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await pamphletProcessor.processDocument(job1);
  const chunks1 = loadChunksForFile(roomId1, 'f_single_pdf');
  assert(chunks1.length > 0 && chunks1[0].text.includes('quantum mechanics'), 'Test 1: Normal single-page PDF text extraction & chunking');

  // 3. Multi-page PDF with Page Numbers preserved
  const multiPdfPath = path.join(testDir, 'multi_page.pdf');
  const multiBytes = await generateTestPdf([
    'Page 1: Introduction to Calculus and Limits.',
    'Page 2: Derivatives and Chain Rule formulas in mathematics.',
    'Page 3: Integration by parts and definite integrals.',
    'Page 4: Differential equations and practical mathematical models.'
  ]);
  fs.writeFileSync(multiPdfPath, multiBytes);
  const jobMulti: ProcessingJob = {
    fileId: 'f_multi_pdf',
    roomId: roomId1,
    fileName: 'calculus.pdf',
    filePath: multiPdfPath,
    fileType: 'PDF',
    totalPages: 4,
    processedPages: 0,
    status: 'processing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await pamphletProcessor.processDocument(jobMulti);
  const chunksMulti = loadChunksForFile(roomId1, 'f_multi_pdf');
  assert(chunksMulti.length === 4, 'Test 2: Multi-page PDF generated exact 4 page chunks');
  assert(chunksMulti.find(c => c.pageNumber === 3)?.text.includes('Integration by parts') === true, 'Test 2b: Preserved pageNumber=3 metadata accurately');

  // 4. Large Multi-page PDF (55 pages)
  const largePages: string[] = [];
  for (let i = 1; i <= 55; i++) {
    largePages.push(`Page ${i}: Comprehensive lecture material on Engineering Mathematics section ${i}.`);
  }
  const largePdfPath = path.join(testDir, 'large_55_pages.pdf');
  const largeBytes = await generateTestPdf(largePages);
  fs.writeFileSync(largePdfPath, largeBytes);
  const jobLarge: ProcessingJob = {
    fileId: 'f_large_pdf',
    roomId: roomId1,
    fileName: 'math_55_pages.pdf',
    filePath: largePdfPath,
    fileType: 'PDF',
    totalPages: 55,
    processedPages: 0,
    status: 'processing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  let progressCount = 0;
  await pamphletProcessor.processDocument(jobLarge, (p) => {
    progressCount = p.current;
  });
  const chunksLarge = loadChunksForFile(roomId1, 'f_large_pdf');
  assert(chunksLarge.length === 55, 'Test 3: Large 55-page PDF chunking without memory/timeout issues');
  assert(progressCount === 55, 'Test 3b: Progress callback accurately reached page 55 of 55');

  // 5. Scanned PDF (Blank digital text) Fallback
  const scannedPdfPath = path.join(testDir, 'scanned_pdf.pdf');
  const scannedBytes = await generateTestPdf(['', '']); // 2 empty pages with no digital text
  fs.writeFileSync(scannedPdfPath, scannedBytes);
  const jobScanned: ProcessingJob = {
    fileId: 'f_scanned_pdf',
    roomId: roomId1,
    fileName: 'scanned_archive.pdf',
    filePath: scannedPdfPath,
    fileType: 'PDF',
    totalPages: 2,
    processedPages: 0,
    status: 'processing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await pamphletProcessor.processDocument(jobScanned);
  assert(getJob('f_scanned_pdf')?.status === 'ready', 'Test 4: Scanned PDF fallback executed safely');

  // 6. TXT document processing & pagination
  const txtPath = path.join(testDir, 'biology_notes.txt');
  let txtContent = '';
  for (let i = 1; i <= 6; i++) {
    txtContent += `فصل ${i}: مباحث ژنتیک و ساختار DNA و همانندسازی در سلول‌های پروکاریوت و یوکاریوت.\n\n` + 'توضیحات تکمیلی درس زیست شناسی.\n'.repeat(30) + '\n\n';
  }
  fs.writeFileSync(txtPath, txtContent, 'utf-8');
  const jobTxt: ProcessingJob = {
    fileId: 'f_txt_doc',
    roomId: roomId1,
    fileName: 'biology_notes.txt',
    filePath: txtPath,
    fileType: 'TXT',
    totalPages: 0,
    processedPages: 0,
    status: 'processing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await pamphletProcessor.processDocument(jobTxt);
  const chunksTxt = loadChunksForFile(roomId1, 'f_txt_doc');
  assert(chunksTxt.length > 0 && chunksTxt.some(c => c.text.includes('ژنتیک')), 'Test 5: TXT document paginated and chunked with Persian text');

  // 7. Corrupted file handling
  const corruptPath = path.join(testDir, 'corrupt.pdf');
  fs.writeFileSync(corruptPath, 'This is definitely not a real PDF file! Corrupted bytes %%%');
  const jobCorrupt: ProcessingJob = {
    fileId: 'f_corrupt_pdf',
    roomId: roomId1,
    fileName: 'corrupt.pdf',
    filePath: corruptPath,
    fileType: 'PDF',
    totalPages: 0,
    processedPages: 0,
    status: 'processing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  let corruptCaught = false;
  try {
    await pamphletProcessor.processDocument(jobCorrupt);
  } catch {
    corruptCaught = true;
  }
  assert(corruptCaught && getJob('f_corrupt_pdf')?.status === 'error', 'Test 6: Corrupted file handled gracefully with error status');

  // 8. Resumable Processing Test
  const resumePages: string[] = [];
  for (let i = 1; i <= 20; i++) {
    resumePages.push(`Resume Lecture Page ${i} on Quantum Physics`);
  }
  const resumePdfPath = path.join(testDir, 'resumable.pdf');
  const resumeBytes = await generateTestPdf(resumePages);
  fs.writeFileSync(resumePdfPath, resumeBytes);

  // Simulate partial run: 7 chunks already saved
  const simulatedExistingChunks = resumePages.slice(0, 7).map((txt, idx) => ({
    id: `f_resume_pdf-p${idx + 1}-c0`,
    roomId: roomId1,
    fileId: 'f_resume_pdf',
    fileName: 'resumable.pdf',
    pageNumber: idx + 1,
    chunkIndex: 0,
    text: txt,
  }));
  const chunksFileDir = path.resolve(process.cwd(), '.data/chunks', roomId1);
  if (!fs.existsSync(chunksFileDir)) fs.mkdirSync(chunksFileDir, { recursive: true });
  fs.writeFileSync(path.join(chunksFileDir, 'f_resume_pdf.json'), JSON.stringify(simulatedExistingChunks));

  const jobResume: ProcessingJob = {
    fileId: 'f_resume_pdf',
    roomId: roomId1,
    fileName: 'resumable.pdf',
    filePath: resumePdfPath,
    fileType: 'PDF',
    totalPages: 20,
    processedPages: 7,
    status: 'processing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveJobCheckpoint(jobResume);

  // Resume processing
  await pamphletProcessor.processDocument(jobResume);
  const allResumedChunks = loadChunksForFile(roomId1, 'f_resume_pdf');
  assert(allResumedChunks.length === 20, 'Test 7: Resumed processing from page 8 to 20 without duplicating first 7 pages');

  // 9. Specific Page Query Retrieval
  const searchPage3 = pamphletProcessor.searchRelevantChunks(roomId1, 'در صفحه ۳ چه فرمول‌هایی آمده است؟', 3);
  assert(searchPage3.length > 0 && searchPage3[0].chunk.pageNumber === 3, 'Test 8: Explicit page question ("صفحه ۳") prioritized page 3 chunk as top result');

  // 10. Multi-page Topic Query Retrieval
  const searchLimits = pamphletProcessor.searchRelevantChunks(roomId1, 'Derivatives and Chain Rule formulas', 4);
  assert(searchLimits.some(r => r.chunk.text.includes('Chain Rule')), 'Test 9: Topic search accurately retrieved relevant conceptual chunk');

  // 11. Room Isolation: Create distinct document in ROOM 2
  const room2TxtPath = path.join(testDir, 'history.txt');
  fs.writeFileSync(room2TxtPath, 'تاریخ معاصر ایران: قرارداد دارسی و ملی شدن صنعت نفت به رهبری دکتر مصدق در سال ۱۳۲۹ شمسی.', 'utf-8');
  const jobRoom2: ProcessingJob = {
    fileId: 'f_room2_history',
    roomId: roomId2,
    fileName: 'history.txt',
    filePath: room2TxtPath,
    fileType: 'TXT',
    totalPages: 1,
    processedPages: 0,
    status: 'processing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await pamphletProcessor.processDocument(jobRoom2);

  // Search in Room 2: should find oil nationalization
  const room2Search = pamphletProcessor.searchRelevantChunks(roomId2, 'ملی شدن صنعت نفت', 5);
  assert(room2Search.length > 0 && room2Search[0].chunk.text.includes('مصدق'), 'Test 10: Room 2 has its own isolated pamphlet and retrieves it');

  // ZERO CONTEXT LEAKAGE: Search in Room 2 for Room 1's content
  const leakTest1 = pamphletProcessor.searchRelevantChunks(roomId2, 'Calculus Integration by parts', 5);
  assert(leakTest1.length === 0, 'Test 11: Zero leakage! Calculus (Room 1) is completely invisible in Room 2');

  // Search in Room 1 for Room 2's content
  const leakTest2 = pamphletProcessor.searchRelevantChunks(roomId1, 'قرارداد دارسی و صنعت نفت', 5);
  assert(leakTest2.length === 0, 'Test 12: Zero leakage! History (Room 2) is completely invisible in Room 1');

  console.log('\n====================================================');
  console.log(`   ALL TESTS COMPLETED: ${passed}/${total} PASSED   `);
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
