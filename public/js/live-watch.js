document.addEventListener("DOMContentLoaded", () => {
  // ============================================================
  // ELEMENTS
  // ============================================================

  const video = document.getElementById("liveVideo");

  const audio = document.getElementById("liveAudio");

  const statusBox = document.getElementById("liveConnectionStatus");

  const placeholder = document.getElementById("liveVideoPlaceholder");

  const mediaPlaceholder = document.getElementById("liveMediaPlaceholder");

  const broadcastStatusBox = document.getElementById("liveBroadcastStatus");

  const viewerCount = document.getElementById("viewerCount");

  const controls = document.getElementById("liveBroadcastControls");

  const startButton = document.getElementById("startLiveBroadcast");

  const pauseButton = document.getElementById("pauseLiveBroadcast");

  const resumeButton = document.getElementById("resumeLiveBroadcast");

  const endButton = document.getElementById("endLiveBroadcast");

  const chatForm = document.getElementById("chatForm");

  const chatInput = document.getElementById("chatMessage");

  const chatMessages = document.getElementById("chatMessages");

  // ============================================================
  // BROADCAST DATA
  // ============================================================

  const data = window.liveBroadcastData || {};

  const broadcastId = String(data.id || "").trim();

  const broadcastMode = String(data.mode || "both")
    .trim()
    .toLowerCase();

  const broadcastStatus = String(data.status || "scheduled")
    .trim()
    .toLowerCase();

  const canControlLive = data.canControlLive === true;

  // ============================================================
  // DEBUG
  // ============================================================

  console.log("==========================================");

  console.log("LIVE WATCH START");

  console.log("Broadcast ID:", broadcastId);

  console.log("Broadcast mode:", broadcastMode);

  console.log("Broadcast status:", broadcastStatus);

  console.log("Can control:", canControlLive);

  console.log("Controls:", controls);

  console.log("Start button:", startButton);

  console.log("Pause button:", pauseButton);

  console.log("Resume button:", resumeButton);

  console.log("End button:", endButton);

  console.log("==========================================");

  // ============================================================
  // VALIDATION
  // ============================================================

  if (!broadcastId) {
    console.error("LIVE WATCH: Broadcast ID is missing.");

    if (controls) {
      controls.style.display = "none";
    }

    return;
  }

  // ============================================================
  // STATE
  // ============================================================

  let liveStatus = broadcastStatus;

  let socket = null;

  let localStream = null;

  let startingLive = false;

  let pausingLive = false;

  let resumingLive = false;

  let endingLive = false;

  let cleaningUp = false;

  // ============================================================
  // RECORDING STATE
  // ============================================================

  let mediaRecorder = null;

  let recordedChunks = [];

  let recordingPromise = null;

  // ============================================================
  // PEER STATE
  // ============================================================

  const peerConnections = new Map();

  const pendingIceCandidates = new Map();

  // ============================================================
  // RTC
  // ============================================================

  const rtcConfiguration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  };

  // ============================================================
  // STATUS
  // ============================================================

  function setStatus(message, type = "default") {
    if (!statusBox) {
      return;
    }

    statusBox.textContent = message;

    statusBox.className = "mt-3 live-watch-connection-status";

    if (type === "success") {
      statusBox.classList.add("live-watch-connection-status-success");
    }

    if (type === "warning") {
      statusBox.classList.add("live-watch-connection-status-warning");
    }

    if (type === "error") {
      statusBox.classList.add("live-watch-connection-status-error");
    }
  }

  // ============================================================
  // BROADCAST STATUS
  // ============================================================

  function updateBroadcastStatus(status) {
    liveStatus = String(status || "")
      .trim()
      .toLowerCase();

    console.log("LIVE WATCH: Status:", liveStatus);

    if (broadcastStatusBox) {
      if (liveStatus === "scheduled") {
        broadcastStatusBox.textContent = "⏰ Scheduled";
      } else if (liveStatus === "live") {
        broadcastStatusBox.textContent = "🔴 LIVE";
      } else if (liveStatus === "paused") {
        broadcastStatusBox.textContent = "⏸ Paused";
      } else if (liveStatus === "ended") {
        broadcastStatusBox.textContent = "⛔ Ended";
      } else {
        broadcastStatusBox.textContent = liveStatus;
      }
    }

    updateMediaMessage();

    updateControlButtons();
  }

  // ============================================================
  // MEDIA MESSAGE
  // ============================================================

  function updateMediaMessage() {
    if (!mediaPlaceholder) {
      return;
    }

    if (liveStatus === "scheduled") {
      mediaPlaceholder.textContent = canControlLive
        ? "Your broadcast is scheduled. Click Start Live when ready."
        : "This live broadcast is scheduled.";
    } else if (liveStatus === "live") {
      mediaPlaceholder.textContent = canControlLive
        ? "Your broadcast is currently live."
        : "Waiting for the broadcaster...";
    } else if (liveStatus === "paused") {
      mediaPlaceholder.textContent = canControlLive
        ? "Your broadcast is currently paused."
        : "The broadcaster has paused the live broadcast.";
    } else if (liveStatus === "ended") {
      mediaPlaceholder.textContent = "This broadcast has ended.";
    }
  }

  // ============================================================
  // ESCAPE HTML
  // ============================================================

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ============================================================
  // PLACEHOLDER
  // ============================================================

  function showPlaceholder(message, title = "LIVE VIDEO") {
    if (!placeholder) {
      return;
    }

    placeholder.innerHTML = `
      <div class="p-4 text-center">

        <div style="font-size:40px;">
          🔴
        </div>

        <h3>
          ${escapeHtml(title)}
        </h3>

        <p class="mb-0">
          ${escapeHtml(message)}
        </p>

      </div>
    `;

    placeholder.style.display = "block";
  }

  function showAudioPlaceholder(message = "Waiting for the broadcaster...") {
    if (!placeholder) {
      return;
    }

    placeholder.innerHTML = `
      <div class="p-4 text-center">

        <div style="font-size:40px;">
          🎤
        </div>

        <h3>
          LIVE AUDIO
        </h3>

        <p class="mb-0">
          ${escapeHtml(message)}
        </p>

      </div>
    `;

    placeholder.style.display = "block";
  }

  function hidePlaceholder() {
    if (!placeholder) {
      return;
    }

    placeholder.style.display = "none";
  }

  // ============================================================
  // CONTROL BUTTONS
  // ============================================================

  function updateControlButtons() {
    console.log("LIVE WATCH: Updating controls", {
      canControlLive,
      liveStatus,
    });

    if (!controls) {
      console.warn("LIVE WATCH: Controls element missing.");

      return;
    }

    if (!canControlLive) {
      controls.style.display = "none";

      return;
    }

    controls.style.display = "block";

    if (startButton) {
      startButton.style.display =
        liveStatus === "scheduled" ? "inline-block" : "none";

      startButton.disabled = startingLive;

      startButton.textContent = startingLive ? "Starting..." : "🔴 Start Live";
    }

    if (pauseButton) {
      pauseButton.style.display =
        liveStatus === "live" ? "inline-block" : "none";

      pauseButton.disabled = pausingLive;

      pauseButton.textContent = pausingLive ? "Pausing..." : "⏸ Pause";
    }

    if (resumeButton) {
      resumeButton.style.display =
        liveStatus === "paused" ? "inline-block" : "none";

      resumeButton.disabled = resumingLive;

      resumeButton.textContent = resumingLive ? "Resuming..." : "▶ Resume";
    }

    if (endButton) {
      endButton.style.display =
        liveStatus !== "ended" ? "inline-block" : "none";

      endButton.disabled = endingLive;

      endButton.textContent = endingLive ? "Ending..." : "⛔ End Live";
    }
  }

  // ============================================================
  // CSRF
  // ============================================================

  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');

    if (meta && meta.content) {
      return meta.content;
    }

    const input = document.querySelector('input[name="_csrf"]');

    if (input && input.value) {
      return input.value;
    }

    return null;
  }

  function getPostHeaders() {
    const headers = {
      Accept: "application/json",
    };

    const csrfToken = getCsrfToken();

    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }

    return headers;
  }

  // ============================================================
  // SERVER RESPONSE
  // ============================================================

  async function readServerResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return response.json().catch(() => ({}));
    }

    const text = await response.text().catch(() => "");

    return {
      success: false,
      message: text || `Server returned HTTP ${response.status}.`,
    };
  }

  // ============================================================
  // GET MEDIA
  // ============================================================

  async function getBroadcasterMedia() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        "Camera and microphone access is not supported by this browser.",
      );
    }

    let videoConstraints = false;

    let audioConstraints = false;

    if (broadcastMode === "camera") {
      videoConstraints = true;
    }

    if (broadcastMode === "microphone") {
      audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
        sampleSize: 16,
      };
    }

    if (broadcastMode === "both") {
      videoConstraints = true;

      audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
        sampleSize: 16,
      };
    }

    return navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: audioConstraints,
    });
  }

  // ============================================================
  // LOCAL MEDIA
  // ============================================================

  async function displayLocalMedia() {
    if (!localStream) {
      return;
    }

    if (broadcastMode === "microphone") {
      if (video) {
        try {
          video.pause();
        } catch {}

        video.srcObject = null;

        video.style.display = "none";
      }

      if (audio) {
        try {
          audio.pause();
        } catch {}

        audio.srcObject = null;
        audio.muted = true;
        audio.volume = 0;
        audio.style.display = "none";
      }

      showAudioPlaceholder("🎤 Your microphone is LIVE — speaking now.");
      return;
    }

    if (audio) {
      try {
        audio.pause();
      } catch {}

      audio.srcObject = null;

      audio.style.display = "none";
    }

    if (video) {
      video.srcObject = localStream;

      video.muted = true;

      video.volume = 0;

      video.style.display = "block";

      hidePlaceholder();

      try {
        await video.play();
      } catch {}
    }
  }

  // ============================================================
  // REMOTE MEDIA
  // ============================================================

  async function displayRemoteStream(remoteStream) {
    if (!remoteStream) {
      return;
    }

    if (liveStatus === "ended") {
      return;
    }

    if (broadcastMode === "microphone") {
      if (video) {
        try {
          video.pause();
        } catch {}

        video.srcObject = null;

        video.style.display = "none";
      }

      if (audio) {
        audio.srcObject = remoteStream;

        audio.muted = false;

        audio.volume = 1;

        audio.style.display = "block";

        showAudioPlaceholder("Live microphone audio is connected.");

        try {
          await audio.play();

          setStatus("Connected to LIVE broadcast.", "success");
        } catch {
          setStatus("LIVE connected. Click Play to listen.", "warning");
        }
      }

      return;
    }

    if (audio) {
      try {
        audio.pause();
      } catch {}

      audio.srcObject = null;

      audio.style.display = "none";
    }

    if (video) {
      video.srcObject = remoteStream;

      video.muted = false;

      video.volume = 1;

      video.style.display = "block";

      hidePlaceholder();

      try {
        await video.play();

        setStatus("Connected to LIVE broadcast.", "success");
      } catch {
        setStatus("LIVE connected. Click Play to watch.", "warning");
      }
    }
  }

  // ============================================================
  // RECORDING
  // ============================================================

  function getRecordingMimeType() {
    if (broadcastMode === "microphone") {
      const audioTypes = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ];

      for (const type of audioTypes) {
        if (
          window.MediaRecorder &&
          typeof MediaRecorder.isTypeSupported === "function" &&
          MediaRecorder.isTypeSupported(type)
        ) {
          return type;
        }
      }

      return "";
    }

    const videoTypes = [
      "video/mp4;codecs=h264,aac",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];

    for (const type of videoTypes) {
      if (
        window.MediaRecorder &&
        typeof MediaRecorder.isTypeSupported === "function" &&
        MediaRecorder.isTypeSupported(type)
      ) {
        return type;
      }
    }

    return "";
  }

  function startRecording() {
    if (!canControlLive || !localStream) {
      return;
    }

    if (!window.MediaRecorder) {
      console.warn("MediaRecorder is not supported by this browser.");

      return;
    }

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      console.log("LIVE RECORDING: Already recording.");

      return;
    }

    recordedChunks = [];

    const mimeType = getRecordingMimeType();

    try {
      mediaRecorder = mimeType
        ? new MediaRecorder(localStream, {
            mimeType,
            audioBitsPerSecond: 128000,
          })
        : new MediaRecorder(localStream, {
            audioBitsPerSecond: 128000,
          });
    } catch (error) {
      console.error("MEDIA RECORDER ERROR:", error);

      mediaRecorder = null;

      return;
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    recordingPromise = new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        resolve();
      };
    });

    mediaRecorder.onerror = (event) => {
      console.error("MEDIA RECORDER ERROR:", event.error);
    };

    mediaRecorder.start(1000);

    console.log(
      "LIVE RECORDING STARTED:",
      broadcastMode,
      mediaRecorder.mimeType,
    );
  }

  // ============================================================
  // SAFARI / IPHONE SAVE HELPERS
  // ============================================================

  function isIPhoneOrIPad() {
    const userAgent = navigator.userAgent || "";

    return (
      /iPad|iPhone|iPod/.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }

  function getRecordingExtension(mimeType) {
    const type = String(mimeType || "").toLowerCase();

    if (type.includes("mp4")) {
      return "mp4";
    }

    if (type.includes("ogg")) {
      return "ogg";
    }

    return "webm";
  }

  function getRecordingFileName(mimeType) {
    return `live-${broadcastId}.${getRecordingExtension(mimeType)}`;
  }

  function saveRecordingForSafari(recordingBlob, mimeType) {
    if (!recordingBlob || !recordingBlob.size) {
      return false;
    }

    const fileName = getRecordingFileName(mimeType);

    // ----------------------------------------------------------
    // iPhone / iPad Safari
    //
    // Safari can handle a Blob URL through a temporary anchor,
    // but it may open the media instead of downloading it.
    //
    // Using a File object and Web Share when available lets the
    // user use "Save to Files" / Share Sheet on iPhone.
    // ----------------------------------------------------------

    if (isIPhoneOrIPad()) {
      try {
        if (
          typeof File !== "undefined" &&
          navigator.share &&
          navigator.canShare
        ) {
          const file = new File([recordingBlob], fileName, {
            type: mimeType || recordingBlob.type || "application/octet-stream",
          });

          if (navigator.canShare({ files: [file] })) {
            navigator
              .share({
                files: [file],
                title: "Live Recording",
              })
              .then(() => {
                console.log("SAFARI: Recording shared/saved.");
              })
              .catch((error) => {
                // User cancellation is not an application error.
                if (error?.name !== "AbortError") {
                  console.warn("SAFARI SHARE ERROR:", error);
                  fallbackBrowserDownload(recordingBlob, fileName);
                }
              });

            return true;
          }
        }
      } catch (error) {
        console.warn("SAFARI FILE SHARE ERROR:", error);
      }
    }

    return fallbackBrowserDownload(recordingBlob, fileName);
  }

  function fallbackBrowserDownload(recordingBlob, fileName) {
    try {
      const blobUrl = URL.createObjectURL(recordingBlob);

      const link = document.createElement("a");

      link.href = blobUrl;

      link.download = fileName;

      link.rel = "noopener";

      link.style.display = "none";

      document.body.appendChild(link);

      link.click();

      link.remove();

      // Keep the URL alive briefly because Safari may need time
      // to begin opening the Blob.
      setTimeout(() => {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {}
      }, 60000);

      console.log("RECORDING: Browser save/download triggered.");

      return true;
    } catch (error) {
      console.error("RECORDING DOWNLOAD ERROR:", error);

      return false;
    }
  }

  async function stopAndUploadRecording() {
    if (!mediaRecorder) {
      console.log("LIVE RECORDING: No recorder to stop.");

      return null;
    }

    if (mediaRecorder.state === "inactive") {
      console.log("LIVE RECORDING: Recorder already inactive.");

      return null;
    }

    setStatus("Finishing live recording...", "warning");

    console.log("LIVE RECORDING: Stopping recorder...");

    mediaRecorder.stop();

    if (recordingPromise) {
      await recordingPromise;
    }

    const mimeType = mediaRecorder.mimeType || getRecordingMimeType();

    const recordingBlob = new Blob(recordedChunks, {
      type: mimeType,
    });

    console.log("LIVE RECORDING: Blob created:", recordingBlob.size, mimeType);

    recordedChunks = [];

    mediaRecorder = null;

    recordingPromise = null;

    if (!recordingBlob.size) {
      console.warn("LIVE RECORDING: Empty recording.");

      return null;
    }

    // ==========================================================
    // RECORDING
    // ==========================================================

    const formData = new FormData();

    const extension =
      mimeType.startsWith("video/mp4") || mimeType.startsWith("audio/mp4")
        ? "mp4"
        : "webm";

    formData.append(
      "recording",
      recordingBlob,
      `live-${broadcastId}.${extension}`,
    );

    console.log("LIVE RECORDING: Uploading...");

    const response = await fetch(
      `/live/${encodeURIComponent(broadcastId)}/recording`,
      {
        method: "POST",

        body: formData,

        credentials: "same-origin",

        headers: getPostHeaders(),
      },
    );

    const result = await readServerResponse(response);

    console.log("RECORDING UPLOAD:", response.status, result);

    if (!response.ok || result.success !== true) {
      throw new Error(
        result.message ||
          `Unable to save live recording. HTTP ${response.status}`,
      );
    }

    console.log("LIVE RECORDING SAVED:", result);

    // ==========================================================
    // SAFARI / IPHONE LOCAL SAVE
    //
    // IMPORTANT:
    // This is intentionally AFTER the existing server upload.
    // Therefore the original server-save behavior remains intact.
    // ==========================================================

    try {
      if (isIPhoneOrIPad()) {
        saveRecordingForSafari(recordingBlob, mimeType);
      }
    } catch (saveError) {
      console.warn("SAFARI LOCAL SAVE ERROR:", saveError);
      // Do NOT fail the broadcast because local browser saving
      // was unavailable.
    }

    return result;
  }

  // ============================================================
  // START
  // ============================================================

  async function startLiveBroadcast() {
    if (!canControlLive || liveStatus !== "scheduled" || startingLive) {
      return;
    }

    startingLive = true;

    updateControlButtons();

    setStatus("Starting live broadcast...", "warning");

    try {
      if (!localStream) {
        localStream = await getBroadcasterMedia();
      }

      const response = await fetch(
        `/live/${encodeURIComponent(broadcastId)}/start`,
        {
          method: "POST",

          headers: getPostHeaders(),

          credentials: "same-origin",
        },
      );

      const result = await readServerResponse(response);

      console.log("START:", response.status, result);

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.message ||
            `Unable to start live broadcast. HTTP ${response.status}`,
        );
      }

      updateBroadcastStatus("live");

      localStream.getTracks().forEach((track) => {
        track.enabled = true;
      });

      await displayLocalMedia();

      startRecording();

      console.log("RECORDING STATE AFTER START:", {
        recorder: mediaRecorder,
        state: mediaRecorder?.state,
        chunks: recordedChunks.length,
      });

      setStatus(
        broadcastMode === "microphone"
          ? "You are LIVE. Waiting for listeners..."
          : "You are LIVE. Waiting for viewers...",
        "success",
      );

      connectSocket();
    } catch (error) {
      console.error("START ERROR:", error);

      setStatus(error?.message || "Unable to start live broadcast.", "error");
    } finally {
      startingLive = false;

      updateControlButtons();
    }
  }

  // ============================================================
  // PAUSE
  // ============================================================

  async function pauseLiveBroadcast() {
    if (!canControlLive || liveStatus !== "live" || pausingLive) {
      return;
    }

    if (!window.confirm("Pause this live broadcast?")) {
      return;
    }

    pausingLive = true;

    updateControlButtons();

    setStatus("Pausing live broadcast...", "warning");

    try {
      const response = await fetch(
        `/live/${encodeURIComponent(broadcastId)}/pause`,
        {
          method: "POST",

          headers: getPostHeaders(),

          credentials: "same-origin",
        },
      );

      const result = await readServerResponse(response);

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.message ||
            `Unable to pause live broadcast. HTTP ${response.status}`,
        );
      }

      updateBroadcastStatus("paused");

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          track.enabled = false;
        });
      }

      setStatus("Live broadcast paused.", "warning");
    } catch (error) {
      console.error("PAUSE ERROR:", error);

      setStatus(error?.message || "Unable to pause live broadcast.", "error");
    } finally {
      pausingLive = false;

      updateControlButtons();
    }
  }

  // ============================================================
  // RESUME
  // ============================================================

  async function resumeLiveBroadcast() {
    if (!canControlLive || liveStatus !== "paused" || resumingLive) {
      return;
    }

    resumingLive = true;

    updateControlButtons();

    setStatus("Resuming live broadcast...", "warning");

    try {
      const response = await fetch(
        `/live/${encodeURIComponent(broadcastId)}/resume`,
        {
          method: "POST",

          headers: getPostHeaders(),

          credentials: "same-origin",
        },
      );

      const result = await readServerResponse(response);

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.message ||
            `Unable to resume live broadcast. HTTP ${response.status}`,
        );
      }

      if (!localStream) {
        localStream = await getBroadcasterMedia();
      }

      localStream.getTracks().forEach((track) => {
        track.enabled = true;
      });

      updateBroadcastStatus("live");

      await displayLocalMedia();

      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        startRecording();
      }

      setStatus("You are LIVE.", "success");

      connectSocket();
    } catch (error) {
      console.error("RESUME ERROR:", error);

      setStatus(error?.message || "Unable to resume live broadcast.", "error");
    } finally {
      resumingLive = false;

      updateControlButtons();
    }
  }

  // ============================================================
  // END
  // ============================================================

  async function endBroadcast() {
    if (!canControlLive || liveStatus === "ended" || endingLive) {
      return;
    }

    if (!window.confirm("Are you sure you want to end this live broadcast?")) {
      return;
    }

    endingLive = true;

    updateControlButtons();

    setStatus("Saving live recording...", "warning");

    try {
      // ========================================================
      // 1. STOP + UPLOAD RECORDING FIRST
      // ========================================================

      try {
        await stopAndUploadRecording();

        console.log("✅ LIVE RECORDING UPLOAD COMPLETE.");
      } catch (recordingError) {
        console.error("❌ LIVE RECORDING SAVE ERROR:", recordingError);

        throw new Error(
          recordingError?.message ||
            "The live recording could not be saved. The broadcast was not ended.",
        );
      }

      // ========================================================
      // 2. END LIVE ON SERVER
      // ========================================================

      setStatus("Ending live broadcast...", "warning");

      const response = await fetch(
        `/live/${encodeURIComponent(broadcastId)}/end`,
        {
          method: "POST",
          headers: getPostHeaders(),
          credentials: "same-origin",
        },
      );

      const result = await readServerResponse(response);

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.message ||
            `Unable to end live broadcast. HTTP ${response.status}`,
        );
      }

      console.log("✅ LIVE BROADCAST ENDED:", result);

      liveStatus = "ended";

      updateControlButtons();

      setStatus("Live broadcast ended and recording saved.", "success");
    } catch (error) {
      console.error("❌ END BROADCAST ERROR:", error);

      setStatus(error?.message || "Unable to end live broadcast.", "error");

      endingLive = false;

      updateControlButtons();
    }
  }

  // ============================================================
  // ENDED
  // ============================================================

  function handleBroadcastEnded(message = "This live broadcast has ended.") {
    updateBroadcastStatus("ended");

    startingLive = false;

    pausingLive = false;

    resumingLive = false;

    endingLive = false;

    closeAllPeerConnections();

    stopLocalMedia();

    if (video) {
      try {
        video.pause();
      } catch {}

      video.srcObject = null;

      video.muted = true;

      video.style.display = "none";
    }

    if (audio) {
      try {
        audio.pause();
      } catch {}

      audio.srcObject = null;

      audio.style.display = "none";
    }

    showPlaceholder(message, "LIVE ENDED");

    setStatus(message, "error");

    updateControlButtons();
  }

  // ============================================================
  // PEER CONNECTION
  // ============================================================

  function createPeerConnection(remoteSocketId) {
    if (!remoteSocketId) {
      return null;
    }

    const existing = peerConnections.get(remoteSocketId);

    if (existing) {
      return existing;
    }

    const pc = new RTCPeerConnection(rtcConfiguration);

    if (canControlLive && localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      if (!socket || !socket.connected || liveStatus === "ended") {
        return;
      }

      socket.emit("live:ice-candidate", {
        roomId: broadcastId,

        candidate: event.candidate,

        targetSocketId: remoteSocketId,
      });
    };

    pc.ontrack = (event) => {
      if (canControlLive || liveStatus === "ended") {
        return;
      }

      let remoteStream = event.streams?.[0];

      if (!remoteStream) {
        remoteStream = new MediaStream();

        remoteStream.addTrack(event.track);
      }

      displayRemoteStream(remoteStream);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;

      console.log("PEER:", remoteSocketId, state);

      if (state === "connected") {
        if (!canControlLive) {
          setStatus("Connected to LIVE broadcast.", "success");
        }
      }

      if (state === "failed" || state === "closed") {
        closePeerConnection(remoteSocketId);

        if (!canControlLive && liveStatus !== "ended") {
          setStatus("Connection to LIVE broadcast failed.", "error");
        }
      }
    };

    peerConnections.set(remoteSocketId, pc);

    return pc;
  }

  // ============================================================
  // OFFER
  // ============================================================

  async function createOfferForViewer(viewerSocketId) {
    if (
      !canControlLive ||
      liveStatus !== "live" ||
      !localStream ||
      !socket ||
      !socket.connected
    ) {
      return;
    }

    try {
      closePeerConnection(viewerSocketId);

      const pc = createPeerConnection(viewerSocketId);

      if (!pc) {
        return;
      }

      const offer = await pc.createOffer();

      await pc.setLocalDescription(offer);

      socket.emit("live:offer", {
        roomId: broadcastId,

        offer: pc.localDescription,

        targetSocketId: viewerSocketId,
      });
    } catch (error) {
      console.error("OFFER ERROR:", error);

      closePeerConnection(viewerSocketId);
    }
  }

  // ============================================================
  // HANDLE OFFER
  // ============================================================

  async function handleOffer(offer, broadcasterSocketId) {
    if (
      canControlLive ||
      liveStatus !== "live" ||
      !offer ||
      !broadcasterSocketId
    ) {
      return;
    }

    try {
      closePeerConnection(broadcasterSocketId);

      const pc = createPeerConnection(broadcasterSocketId);

      if (!pc) {
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      await applyPendingIceCandidates(broadcasterSocketId, pc);

      const answer = await pc.createAnswer();

      await pc.setLocalDescription(answer);

      if (!socket || !socket.connected) {
        return;
      }

      socket.emit("live:answer", {
        roomId: broadcastId,

        answer: pc.localDescription,

        targetSocketId: broadcasterSocketId,
      });

      setStatus("Connecting to LIVE broadcast...", "warning");
    } catch (error) {
      console.error("HANDLE OFFER ERROR:", error);

      closePeerConnection(broadcasterSocketId);

      setStatus("Unable to connect to LIVE broadcast.", "error");
    }
  }

  // ============================================================
  // ANSWER
  // ============================================================

  async function handleAnswer(answer, viewerSocketId) {
    if (
      !canControlLive ||
      liveStatus === "ended" ||
      !answer ||
      !viewerSocketId
    ) {
      return;
    }

    const pc = peerConnections.get(viewerSocketId);

    if (!pc) {
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      await applyPendingIceCandidates(viewerSocketId, pc);
    } catch (error) {
      console.error("ANSWER ERROR:", error);

      closePeerConnection(viewerSocketId);
    }
  }

  // ============================================================
  // ICE
  // ============================================================

  async function handleIceCandidate(candidate, senderSocketId) {
    if (!candidate || !senderSocketId || liveStatus === "ended") {
      return;
    }

    const pc = peerConnections.get(senderSocketId);

    if (!pc) {
      queueIceCandidate(senderSocketId, candidate);

      return;
    }

    try {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        queueIceCandidate(senderSocketId, candidate);
      }
    } catch (error) {
      console.error("ICE ERROR:", error);
    }
  }

  function queueIceCandidate(socketId, candidate) {
    if (!pendingIceCandidates.has(socketId)) {
      pendingIceCandidates.set(socketId, []);
    }

    pendingIceCandidates.get(socketId).push(candidate);
  }

  async function applyPendingIceCandidates(socketId, pc) {
    const candidates = pendingIceCandidates.get(socketId);

    if (!candidates || candidates.length === 0) {
      return;
    }

    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("QUEUED ICE ERROR:", error);
      }
    }

    pendingIceCandidates.delete(socketId);
  }

  // ============================================================
  // CLOSE PEERS
  // ============================================================

  function closePeerConnection(socketId) {
    const pc = peerConnections.get(socketId);

    if (pc) {
      try {
        pc.ontrack = null;

        pc.onicecandidate = null;

        pc.close();
      } catch {}

      peerConnections.delete(socketId);
    }

    pendingIceCandidates.delete(socketId);
  }

  function closeAllPeerConnections() {
    peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });

    peerConnections.clear();

    pendingIceCandidates.clear();
  }

  // ============================================================
  // LOCAL MEDIA STOP
  // ============================================================

  function stopLocalMedia() {
    if (!localStream) {
      return;
    }

    localStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {}
    });

    localStream = null;
  }

  // ============================================================
  // REQUEST OFFER
  // ============================================================

  function requestNewOffer() {
    if (
      canControlLive ||
      liveStatus !== "live" ||
      !socket ||
      !socket.connected
    ) {
      return;
    }

    socket.emit("live:request-offer", {
      roomId: broadcastId,
    });
  }

  // ============================================================
  // CHAT
  // ============================================================

  function appendChatMessage(data) {
    if (!data || !chatMessages) {
      return;
    }

    if (data.roomId && String(data.roomId) !== String(broadcastId)) {
      return;
    }

    const message = String(data.message || "").trim();

    if (!message) {
      return;
    }

    const messageElement = document.createElement("div");

    messageElement.className = "border-bottom py-2 live-chat-message";

    const username = document.createElement("strong");

    username.textContent =
      data.username || data.user?.username || data.user?.name || "User";

    const text = document.createElement("span");

    text.textContent = message;

    messageElement.appendChild(username);

    messageElement.appendChild(document.createTextNode(": "));

    messageElement.appendChild(text);

    chatMessages.appendChild(messageElement);

    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function setupChat() {
    if (!chatForm || !chatInput || !chatMessages) {
      console.warn("LIVE WATCH: Chat elements missing.", {
        chatForm,
        chatInput,
        chatMessages,
      });

      return;
    }

    if (chatForm.dataset.ready === "true") {
      return;
    }

    chatForm.dataset.ready = "true";

    // ----------------------------------------------------------
    // SEND MESSAGE
    // ----------------------------------------------------------

    chatForm.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!socket || !socket.connected) {
        console.warn("CHAT: Socket is not connected.");

        setStatus("Chat connection is not ready.", "warning");

        return;
      }

      if (liveStatus === "ended") {
        console.warn("CHAT: Broadcast has ended.");

        return;
      }

      const message = chatInput.value.trim();

      if (!message) {
        return;
      }

      if (message.length > 500) {
        alert("Chat message is too long.");

        return;
      }

      console.log("CHAT: Sending message:", message);

      let acknowledged = false;

      const finishSend = (ack) => {
        if (acknowledged) {
          return;
        }

        acknowledged = true;

        console.log("CHAT: Server acknowledgment:", ack);

        if (ack && ack.success === false) {
          console.error("CHAT: Server rejected message:", ack);

          setStatus(ack.message || "Unable to send chat message.", "error");

          return;
        }

        chatInput.value = "";
        chatInput.focus();
      };

      try {
        socket.emit(
          "live:chat-message",
          {
            roomId: broadcastId,
            message,
          },
          finishSend,
        );
      } catch (error) {
        console.error("CHAT SEND ERROR:", error);

        setStatus("Unable to send chat message.", "error");

        return;
      }

      // --------------------------------------------------------
      // Some Socket.IO/server versions do not return an ack.
      //
      // Do not leave the input stuck forever in that case.
      // The message itself is still sent exactly once.
      // --------------------------------------------------------

      setTimeout(() => {
        if (!acknowledged) {
          chatInput.value = "";
          chatInput.focus();
        }
      }, 1500);
    });

    // ----------------------------------------------------------
    // RECEIVE MESSAGE
    // ----------------------------------------------------------

    socket.on("live:chat-message", (data) => {
      console.log("CHAT: Received message:", data);

      appendChatMessage(data);
    });

    // ----------------------------------------------------------
    // CHAT ERROR
    // ----------------------------------------------------------

    socket.on("live:chat-error", (data) => {
      console.error("CHAT ERROR:", data);

      setStatus(data?.message || "Chat error.", "error");
    });

    console.log("CHAT: Socket chat handlers initialized.");
  }

  // ============================================================
  // SOCKET
  // ============================================================

  function connectSocket() {
    if (socket) {
      return;
    }

    if (typeof io !== "function") {
      console.error("LIVE WATCH: Socket.IO client not loaded.");

      setStatus("Unable to connect to live service.", "error");

      return;
    }

    if (liveStatus === "ended") {
      return;
    }

    socket = io({
      transports: ["websocket", "polling"],
    });

    setupChat();

    // CONNECT

    socket.on("connect", () => {
      console.log("SOCKET CONNECTED:", socket.id);

      socket.emit("live:join", broadcastId);

      if (canControlLive) {
        setStatus(
          liveStatus === "paused"
            ? "Live is paused."
            : "You are LIVE. Waiting for viewers...",
          liveStatus === "paused" ? "warning" : "success",
        );
      } else {
        setStatus(
          liveStatus === "live"
            ? "Connected. Waiting for LIVE broadcast..."
            : "Connected to live service.",
          "warning",
        );
      }
    });

    // USER JOINED

    socket.on("live:user-joined", async ({ socketId } = {}) => {
      if (
        !canControlLive ||
        liveStatus !== "live" ||
        !socketId ||
        !localStream
      ) {
        return;
      }

      await createOfferForViewer(socketId);
    });

    // REQUEST OFFER

    socket.on("live:request-offer", async ({ socketId } = {}) => {
      if (
        !canControlLive ||
        liveStatus !== "live" ||
        !socketId ||
        !localStream
      ) {
        return;
      }

      await createOfferForViewer(socketId);
    });

    // OFFER

    socket.on("live:offer", async ({ offer, senderSocketId } = {}) => {
      if (
        canControlLive ||
        liveStatus !== "live" ||
        !offer ||
        !senderSocketId
      ) {
        return;
      }

      await handleOffer(offer, senderSocketId);
    });

    // ANSWER

    socket.on("live:answer", async ({ answer, senderSocketId } = {}) => {
      if (!canControlLive || !answer || !senderSocketId) {
        return;
      }

      await handleAnswer(answer, senderSocketId);
    });

    // ICE

    socket.on(
      "live:ice-candidate",
      async ({ candidate, senderSocketId } = {}) => {
        if (!candidate || !senderSocketId) {
          return;
        }

        await handleIceCandidate(candidate, senderSocketId);
      },
    );

    // USER LEFT

    socket.on("live:user-left", ({ socketId } = {}) => {
      if (!socketId) {
        return;
      }

      closePeerConnection(socketId);
    });

    // VIEWER COUNT

    socket.on("live:viewer-count", ({ count } = {}) => {
      if (!viewerCount) {
        return;
      }

      viewerCount.textContent = Math.max(0, Number(count) || 0);
    });

    // STARTED

    socket.on("live:broadcast-started", (data) => {
      if (String(data?.broadcastId) !== String(broadcastId)) {
        return;
      }

      updateBroadcastStatus("live");

      if (!canControlLive) {
        setStatus("LIVE broadcast has started. Connecting...", "success");

        requestNewOffer();
      }
    });

    // PAUSED

    socket.on("live:broadcast-paused", (data) => {
      if (String(data?.broadcastId) !== String(broadcastId)) {
        return;
      }

      updateBroadcastStatus("paused");

      if (!canControlLive) {
        closeAllPeerConnections();

        if (video) {
          try {
            video.pause();
          } catch {}

          video.srcObject = null;
        }

        if (audio) {
          try {
            audio.pause();
          } catch {}

          audio.srcObject = null;
        }

        showPlaceholder(
          "The broadcaster has paused the live broadcast.",
          "LIVE PAUSED",
        );

        setStatus("LIVE broadcast is paused.", "warning");
      }
    });

    // RESUMED

    socket.on("live:broadcast-resumed", (data) => {
      if (String(data?.broadcastId) !== String(broadcastId)) {
        return;
      }

      updateBroadcastStatus("live");

      if (!canControlLive) {
        setStatus("LIVE broadcast resumed. Connecting...", "success");

        requestNewOffer();
      }
    });

    // ENDED

    socket.on("live:broadcast-ended", (data) => {
      if (
        data?.broadcastId &&
        String(data.broadcastId) !== String(broadcastId)
      ) {
        return;
      }

      handleBroadcastEnded(data?.message || "This live broadcast has ended.");
    });

    // ROOM CLOSED

    socket.on("live:room-closed", (data) => {
      if (
        data?.broadcastId &&
        String(data.broadcastId) !== String(broadcastId)
      ) {
        return;
      }

      handleBroadcastEnded(data?.message || "This live broadcast has ended.");
    });

    // DISCONNECT

    socket.on("disconnect", () => {
      if (cleaningUp || liveStatus === "ended") {
        return;
      }

      setStatus(
        canControlLive
          ? "Live connection disconnected."
          : "Connection to live broadcast lost.",
        "error",
      );
    });

    // ERROR

    socket.on("connect_error", (error) => {
      console.error("SOCKET ERROR:", error);

      if (liveStatus !== "ended") {
        setStatus("Unable to connect to live broadcast.", "error");
      }
    });
  }

  // ============================================================
  // EXISTING BROADCASTER
  // ============================================================

  async function initializeAlreadyLiveBroadcaster() {
    if (!canControlLive || !["live", "paused"].includes(liveStatus)) {
      return;
    }

    setStatus("Requesting camera/microphone permission...", "warning");

    try {
      if (!localStream) {
        localStream = await getBroadcasterMedia();
      }

      localStream.getTracks().forEach((track) => {
        track.enabled = liveStatus === "live";
      });

      await displayLocalMedia();

      if (liveStatus === "live") {
        startRecording();
      }

      setStatus(
        liveStatus === "paused"
          ? "Live broadcast is paused."
          : "You are LIVE. Waiting for viewers...",
        liveStatus === "paused" ? "warning" : "success",
      );

      connectSocket();

      updateControlButtons();
    } catch (error) {
      console.error("EXISTING MEDIA ERROR:", error);

      let message = error?.message || "Unable to access your live devices.";

      if (error?.name === "NotAllowedError") {
        message =
          "Camera/microphone permission was denied. Allow access to continue broadcasting.";
      }

      if (error?.name === "NotFoundError") {
        message = "No camera or microphone was found.";
      }

      if (error?.name === "NotReadableError") {
        message =
          "Your camera or microphone is already being used by another application.";
      }

      setStatus(message, "error");

      showPlaceholder(message, "LIVE DEVICE ERROR");
    }
  }

  // ============================================================
  // SHARE
  // ============================================================

  function setupShareButton() {
    const shareButton = document.getElementById("shareLiveBroadcast");

    if (!shareButton) {
      return;
    }

    if (shareButton.dataset.ready === "true") {
      return;
    }

    shareButton.dataset.ready = "true";

    shareButton.addEventListener("click", async () => {
      const url = window.location.href;

      try {
        if (navigator.share) {
          await navigator.share({
            title: document.title || "LIVE Broadcast",

            url,
          });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);

          const oldText = shareButton.textContent;

          shareButton.textContent = "Copied!";

          setTimeout(() => {
            shareButton.textContent = oldText;
          }, 1500);
        }
      } catch (error) {
        console.warn("SHARE ERROR:", error);
      }
    });
  }

  // ============================================================
  // BUTTON SETUP
  // ============================================================

  function setupControlButtons() {
    if (startButton) {
      startButton.addEventListener("click", startLiveBroadcast);
    }

    if (pauseButton) {
      pauseButton.addEventListener("click", pauseLiveBroadcast);
    }

    if (resumeButton) {
      resumeButton.addEventListener("click", resumeLiveBroadcast);
    }

    if (endButton) {
      endButton.addEventListener("click", endBroadcast);
    }

    updateControlButtons();
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  function cleanup() {
    if (cleaningUp) {
      return;
    }

    cleaningUp = true;

    if (socket && socket.connected) {
      try {
        socket.emit("live:leave", broadcastId);
      } catch {}
    }

    closeAllPeerConnections();

    stopLocalMedia();

    if (video) {
      try {
        video.pause();
      } catch {}

      video.srcObject = null;
    }

    if (audio) {
      try {
        audio.pause();
      } catch {}

      audio.srcObject = null;
    }

    if (socket) {
      try {
        socket.disconnect();
      } catch {}
    }
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  setupControlButtons();

  setupShareButton();

  updateBroadcastStatus(broadcastStatus);

  // ENDED

  if (liveStatus === "ended") {
    handleBroadcastEnded();

    return;
  }

  // ============================================================
  // BROADCASTER — SCHEDULED
  // ============================================================

  if (canControlLive && liveStatus === "scheduled") {
    if (broadcastMode === "microphone") {
      showAudioPlaceholder(
        "Your broadcast is scheduled. Click Start Live when ready.",
      );
    } else {
      showPlaceholder(
        "Your broadcast is scheduled. Click Start Live when ready.",
        "READY TO GO LIVE",
      );
    }

    setStatus("Scheduled. Click Start Live when you are ready.", "warning");

    updateControlButtons();

    return;
  }

  // ============================================================
  // BROADCASTER — LIVE / PAUSED
  // ============================================================

  if (canControlLive && ["live", "paused"].includes(liveStatus)) {
    initializeAlreadyLiveBroadcaster();

    return;
  }

  // ============================================================
  // VIEWER — LIVE
  // ============================================================

  if (!canControlLive && liveStatus === "live") {
    if (broadcastMode === "microphone") {
      showAudioPlaceholder("Waiting for the broadcaster...");
    } else {
      showPlaceholder("Waiting for the broadcaster...");
    }

    setStatus("Waiting for LIVE broadcast...", "warning");

    connectSocket();

    return;
  }

  // ============================================================
  // VIEWER — PAUSED
  // ============================================================

  if (!canControlLive && liveStatus === "paused") {
    showPlaceholder(
      "The broadcaster has paused the live broadcast.",
      "LIVE PAUSED",
    );

    setStatus("LIVE broadcast is paused.", "warning");

    connectSocket();

    return;
  }

  // ============================================================
  // VIEWER — SCHEDULED
  // ============================================================

  if (!canControlLive && liveStatus === "scheduled") {
    if (broadcastMode === "microphone") {
      showAudioPlaceholder("This live broadcast is scheduled.");
    } else {
      showPlaceholder("This live broadcast is scheduled.", "SCHEDULED LIVE");
    }

    setStatus("This broadcast has not started yet.", "warning");

    connectSocket();

    return;
  }

  // ============================================================
  // UNKNOWN
  // ============================================================

  setStatus(`Broadcast status: ${liveStatus}`, "warning");

  // ============================================================
  // BEFORE UNLOAD
  // ============================================================

  window.addEventListener("beforeunload", cleanup);
});
