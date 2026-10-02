import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3000';

async function runTests() {
  console.log('===========================================================');
  console.log('   RUNNING STUDYROOM R2 MULTIPART UPLOAD PIPELINE TESTS    ');
  console.log('===========================================================\n');

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

  // 1. Create a test room first
  const roomRes = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'اتاق تست آپلود ابری',
      category: 'مهندسی',
      ownerName: 'تستر سامانه',
    }),
  });
  const room = await roomRes.json();
  const roomId = room.id;
  assert(Boolean(roomId), `Test 1: Created test room with id=${roomId}`);

  // Create another room to test Room Isolation
  const room2Res = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'اتاق ایزوله دوم',
      category: 'پزشکی',
      ownerName: 'تستر دو',
    }),
  });
  const room2 = await room2Res.json();
  const roomId2 = room2.id;
  assert(Boolean(roomId2), `Test 1b: Created second room for isolation tests with id=${roomId2}`);

  // 2. Test 10MB Multipart Init
  const fileSize10MB = 10 * 1024 * 1024;
  const initRes = await fetch(`${API_BASE}/api/uploads/multipart/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId,
      fileName: 'physics_notes_10mb.txt',
      fileSize: fileSize10MB,
      mimeType: 'text/plain',
      partSize: 8 * 1024 * 1024,
      totalParts: 2,
    }),
  });

  assert(initRes.status === 200, 'Test 2: POST /api/uploads/multipart/init returned 200 OK');
  const initData = await initRes.json();
  assert(Boolean(initData.uploadId), 'Test 2b: Received valid uploadId');
  assert(Boolean(initData.fileId), 'Test 2c: Received valid fileId');
  assert(initData.key.startsWith(`studyroom/${roomId}/`), 'Test 2d: Object key is scoped strictly to roomId');

  // 3. Test Signing Parts
  const signRes = await fetch(`${API_BASE}/api/uploads/multipart/sign-parts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId,
      uploadId: initData.uploadId,
      key: initData.key,
      partNumbers: [1, 2],
    }),
  });
  assert(signRes.status === 200, 'Test 3: POST /api/uploads/multipart/sign-parts returned 200 OK');
  const signData = await signRes.json();
  assert(Boolean(signData.urls && signData.urls[1] && signData.urls[2]), 'Test 3b: Received presigned URLs for parts 1 and 2');

  // 4. Test Room Isolation: Room 2 attempting to sign URLs for Room 1's key must be forbidden (403)
  const forbiddenSignRes = await fetch(`${API_BASE}/api/uploads/multipart/sign-parts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: roomId2, // Room 2
      uploadId: initData.uploadId,
      key: initData.key, // Key belongs to Room 1
      partNumbers: [1],
    }),
  });
  assert(forbiddenSignRes.status === 403, 'Test 4: Room Isolation! Room 2 cannot sign URLs for Room 1 files (403 Forbidden)');

  // 5. Test Direct Upload of Parts
  const dummyPart1 = Buffer.alloc(8 * 1024 * 1024, 'A');
  const dummyPart2 = Buffer.alloc(2 * 1024 * 1024, 'B');

  const part1Url = signData.urls[1].startsWith('http') ? signData.urls[1] : `${API_BASE}${signData.urls[1]}`;
  const part2Url = signData.urls[2].startsWith('http') ? signData.urls[2] : `${API_BASE}${signData.urls[2]}`;

  const put1Res = await fetch(part1Url, {
    method: 'PUT',
    body: dummyPart1,
  });
  assert(put1Res.status >= 200 && put1Res.status < 300, 'Test 5: Direct PUT part 1 succeeded with 200 OK');
  const etag1 = put1Res.headers.get('ETag') || '"etag_part_1"';

  const put2Res = await fetch(part2Url, {
    method: 'PUT',
    body: dummyPart2,
  });
  assert(put2Res.status >= 200 && put2Res.status < 300, 'Test 5b: Direct PUT part 2 succeeded with 200 OK');
  const etag2 = put2Res.headers.get('ETag') || '"etag_part_2"';

  // 6. Test Complete Multipart Upload
  const completeRes = await fetch(`${API_BASE}/api/uploads/multipart/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId,
      uploadId: initData.uploadId,
      fileId: initData.fileId,
      key: initData.key,
      fileName: 'physics_notes_10mb.txt',
      fileSize: fileSize10MB,
      fileType: 'TXT',
      uploadedBy: 'تستر سامانه',
      parts: [
        { PartNumber: 1, ETag: etag1 },
        { PartNumber: 2, ETag: etag2 },
      ],
    }),
  });
  assert(completeRes.status === 201, 'Test 6: POST /api/uploads/multipart/complete finalized with 201 Created');
  const completedPamphlet = await completeRes.json();
  assert(completedPamphlet.id === initData.fileId, 'Test 6b: Created pamphlet matches fileId');
  assert(completedPamphlet.roomId === roomId, 'Test 6c: Pamphlet is registered strictly to roomId');

  // 7. Verify Pamphlet retrieval for Room 1
  const getPamphletsRes = await fetch(`${API_BASE}/api/rooms/${roomId}/pamphlets`);
  const pamphletsRoom1 = await getPamphletsRes.json();
  assert(
    pamphletsRoom1.some((p: any) => p.id === initData.fileId),
    'Test 7: Room 1 lists the newly completed pamphlet'
  );

  // 8. Verify Zero Leakage: Room 2 does NOT see Room 1 pamphlet!
  const getPamphletsRoom2Res = await fetch(`${API_BASE}/api/rooms/${roomId2}/pamphlets`);
  const pamphletsRoom2 = await getPamphletsRoom2Res.json();
  assert(
    !pamphletsRoom2.some((p: any) => p.id === initData.fileId),
    'Test 8: Zero Leakage! Room 2 has zero access or visibility to Room 1 pamphlet'
  );

  // 9. Test Abort / Cancel Upload
  const abortInitRes = await fetch(`${API_BASE}/api/uploads/multipart/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId,
      fileName: 'cancelled_file_80mb.pdf',
      fileSize: 80 * 1024 * 1024,
      mimeType: 'application/pdf',
      partSize: 16 * 1024 * 1024,
      totalParts: 5,
    }),
  });
  const abortInitData = await abortInitRes.json();

  const abortRes = await fetch(`${API_BASE}/api/uploads/multipart/abort`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId,
      uploadId: abortInitData.uploadId,
      key: abortInitData.key,
    }),
  });
  assert(abortRes.status === 200, 'Test 9: Abort upload succeeded with 200 OK without orphaned storage');

  // 10. Test Delete Pamphlet
  const deleteRes = await fetch(`${API_BASE}/api/rooms/${roomId}/pamphlets/${initData.fileId}`, {
    method: 'DELETE',
  });
  assert(deleteRes.status === 200, 'Test 10: DELETE pamphlet cleaned up file, chunks, and metadata');

  const afterDeleteRes = await fetch(`${API_BASE}/api/rooms/${roomId}/pamphlets`);
  const afterDeleteList = await afterDeleteRes.json();
  assert(!afterDeleteList.some((p: any) => p.id === initData.fileId), 'Test 10b: File confirmed removed from room list');

  console.log(`\n===========================================================`);
  console.log(`   TEST RESULTS: ${passed}/${total} PASSED`);
  console.log(`===========================================================\n`);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
