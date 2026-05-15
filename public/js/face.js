// ════════════════════════════════════════════════════
//  face.js  ─  face-api.js 래퍼
//  WebGL 없이도 CPU 백엔드로 동작
// ════════════════════════════════════════════════════
const FaceEngine = (() => {
  let modelsLoaded = false;
  let loadingPromise = null;
  const MODEL_URL = '/models';

  // ── 백엔드 초기화 (CPU 우선) ──────────────────────
  async function initBackend() {
    try {
      // WebGL 먼저 시도
      await faceapi.tf.setBackend('webgl');
      await faceapi.tf.ready();
      console.log('✅ WebGL 백엔드 사용');
      return true;
    } catch (e) {
      console.warn('⚠️ WebGL 실패, CPU 백엔드로 전환');
    }
    try {
      await faceapi.tf.setBackend('cpu');
      await faceapi.tf.ready();
      console.log('✅ CPU 백엔드 사용');
      return true;
    } catch (e) {
      console.error('❌ 백엔드 초기화 실패:', e);
      return false;
    }
  }

  // ── 모델 로드 ──────────────────────────────────────
  async function loadModels() {
    if (modelsLoaded) return true;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      try {
        const backendOk = await initBackend();
        if (!backendOk) return false;

        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        modelsLoaded = true;
        console.log('✅ Face-API 모델 로드 완료');
        return true;
      } catch (e) {
        console.error('❌ 모델 로드 실패:', e);
        loadingPromise = null;
        return false;
      }
    })();

    return loadingPromise;
  }

  // ── 웹캠 시작 ──────────────────────────────────────
  async function startCamera(videoEl) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false,
    });
    videoEl.srcObject = stream;
    await new Promise(r => { videoEl.onloadedmetadata = r; });
    await videoEl.play();
    return stream;
  }

  // ── 웹캠 중지 ──────────────────────────────────────
  function stopCamera(videoEl) {
    if (videoEl && videoEl.srcObject) {
      videoEl.srcObject.getTracks().forEach(t => t.stop());
      videoEl.srcObject = null;
    }
  }

  // ── 단일 프레임에서 descriptor 추출 ───────────────
  async function getDescriptor(videoEl) {
    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
    const result = await faceapi
      .detectSingleFace(videoEl, opts)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!result) return null;
    return { descriptor: Array.from(result.descriptor), detection: result.detection };
  }

  // ── 실시간 감지 루프 ───────────────────────────────
  function startDetectionLoop(videoEl, canvasEl, onResult) {
    let running = true;
    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });

    async function loop() {
      if (!running || !videoEl || videoEl.paused || videoEl.ended || !videoEl.srcObject) {
        if (running) setTimeout(loop, 200);
        return;
      }

      try {
        const result = await faceapi
          .detectSingleFace(videoEl, opts)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (canvasEl && videoEl.videoWidth > 0) {
          const dims = { width: videoEl.videoWidth, height: videoEl.videoHeight };
          faceapi.matchDimensions(canvasEl, dims);
          const ctx = canvasEl.getContext('2d');
          ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

          if (result) {
            const resized = faceapi.resizeResults(result, dims);
            const box = resized.detection.box;
            ctx.strokeStyle = '#00d4aa';
            ctx.lineWidth = 2;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
            faceapi.draw.drawFaceLandmarks(canvasEl, resized);
          }
        }

        if (result) {
          onResult({ found: true, descriptor: Array.from(result.descriptor), score: result.detection.score });
        } else {
          onResult({ found: false });
        }
      } catch (e) {
        onResult({ found: false });
      }

      if (running) setTimeout(loop, 150); // CPU 모드에서는 interval 늘림
    }

    loop();
    return () => { running = false; };
  }

  // ── 스냅샷 캡처 ────────────────────────────────────
  function captureSnapshot(videoEl, snapCanvas) {
    if (!videoEl || !snapCanvas) return;
    snapCanvas.width  = videoEl.videoWidth  || 120;
    snapCanvas.height = videoEl.videoHeight || 120;
    snapCanvas.getContext('2d').drawImage(videoEl, 0, 0, snapCanvas.width, snapCanvas.height);
  }

  return { loadModels, startCamera, stopCamera, getDescriptor, startDetectionLoop, captureSnapshot };
})();
