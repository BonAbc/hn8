document.addEventListener("DOMContentLoaded", () => {
  // ============================================================
  // ELEMENTS
  // ============================================================

  const video = document.getElementById("liveCameraPreview");
  const placeholder = document.getElementById("liveCameraPlaceholder");

  const cameraSelect = document.getElementById("liveCamera");
  const microphoneSelect = document.getElementById("liveMicrophone");
  const liveModeSelect = document.getElementById("liveMode");

  const statusBox = document.getElementById("liveDeviceStatus");

  const enableDevicesBtn = document.getElementById("enableLiveCamera");

  // IMPORTANT:
  // This is the SCHEDULE button.
  // It is NOT the START button.
  const scheduleBtn = document.getElementById("scheduleLiveBroadcast");

  const titleInput = document.getElementById("liveTitle");

  // Optional scheduled date/time field.
  // If your EJS does not have this field, the code will use current time.
  const scheduledAtInput = document.getElementById("liveScheduledAt");

  // ============================================================
  // REQUIRED ELEMENT CHECK
  // ============================================================

  if (
    !video ||
    !placeholder ||
    !cameraSelect ||
    !microphoneSelect ||
    !liveModeSelect ||
    !statusBox ||
    !enableDevicesBtn ||
    !scheduleBtn ||
    !titleInput
  ) {
    console.error("LIVE CREATE: Required elements are missing.", {
      video: !!video,
      placeholder: !!placeholder,
      cameraSelect: !!cameraSelect,
      microphoneSelect: !!microphoneSelect,
      liveModeSelect: !!liveModeSelect,
      statusBox: !!statusBox,
      enableDevicesBtn: !!enableDevicesBtn,
      scheduleBtn: !!scheduleBtn,
      titleInput: !!titleInput,
    });

    return;
  }

  // ============================================================
  // STATE
  // ============================================================

  let currentStream = null;
  let isScheduling = false;

  // ============================================================
  // STATUS
  // ============================================================

  function setStatus(message, type = "default") {
    statusBox.textContent = message;

    statusBox.className = "live-create-status";

    if (type === "success") {
      statusBox.classList.add("live-create-status-success");
    }

    if (type === "warning") {
      statusBox.classList.add("live-create-status-warning");
    }

    if (type === "error") {
      statusBox.classList.add("live-create-status-error");
    }
  }

  // ============================================================
  // LIVE MODE
  // ============================================================

  function getLiveMode() {
    const mode = String(liveModeSelect.value || "both")
      .trim()
      .toLowerCase();

    if (!["camera", "microphone", "both"].includes(mode)) {
      return "both";
    }

    return mode;
  }

  // ============================================================
  // STOP CURRENT STREAM
  // ============================================================

  function stopCurrentStream() {
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (error) {
          console.warn("LIVE CREATE: Track stop warning:", error);
        }
      });
    }

    currentStream = null;

    try {
      video.pause();
    } catch {}

    video.srcObject = null;
  }

  // ============================================================
  // RESET PREVIEW
  // ============================================================

  function resetPreview() {
    try {
      video.pause();
    } catch {}

    video.srcObject = null;
    video.style.display = "none";

    placeholder.innerHTML = `
      <div class="live-create-placeholder-icon">
        📷
      </div>

      <h3>LIVE PREVIEW</h3>

      <p class="mb-0">
        Enable your camera or microphone to begin.
      </p>
    `;

    placeholder.style.display = "flex";
  }

  // ============================================================
  // DEVICE BUTTON
  // ============================================================

  function resetDeviceButton() {
    enableDevicesBtn.disabled = false;

    enableDevicesBtn.textContent = "🎥 Enable Devices";

    enableDevicesBtn.classList.remove("btn-success");

    enableDevicesBtn.classList.add("btn-outline-dark");
  }

  function setDevicesReady() {
    enableDevicesBtn.disabled = false;

    enableDevicesBtn.textContent = "✓ Devices Ready";

    enableDevicesBtn.classList.remove("btn-outline-dark");

    enableDevicesBtn.classList.add("btn-success");
  }

  // ============================================================
  // SCHEDULE BUTTON
  // ============================================================

  function resetScheduleButton() {
    scheduleBtn.disabled = true;

    scheduleBtn.textContent = "📅 Schedule Live";
  }

  function setScheduleButtonReady() {
    scheduleBtn.disabled = false;

    scheduleBtn.textContent = "📅 Schedule Live";
  }

  // ============================================================
  // UPDATE MODE UI
  // ============================================================

  function updateModeUI() {
    const mode = getLiveMode();

    // ----------------------------------------------------------
    // CAMERA ONLY
    // ----------------------------------------------------------

    if (mode === "camera") {
      cameraSelect.disabled = false;
      microphoneSelect.disabled = true;

      placeholder.innerHTML = `
        <div class="live-create-placeholder-icon">
          📷
        </div>

        <h3>
          CAMERA ONLY
        </h3>

        <p class="mb-0">
          Camera will be used for this live.
        </p>
      `;

      placeholder.style.display = "flex";
      video.style.display = "none";

      setStatus("Camera only selected.");

      return;
    }

    // ----------------------------------------------------------
    // MICROPHONE ONLY
    // ----------------------------------------------------------

    if (mode === "microphone") {
      cameraSelect.disabled = true;
      microphoneSelect.disabled = false;

      placeholder.innerHTML = `
        <div class="live-create-placeholder-icon">
          🎤
        </div>

        <h3>
          MICROPHONE ONLY
        </h3>

        <p class="mb-0">
          Microphone will be used for this live.
        </p>
      `;

      placeholder.style.display = "flex";
      video.style.display = "none";

      setStatus("Microphone only selected.");

      return;
    }

    // ----------------------------------------------------------
    // CAMERA + MICROPHONE
    // ----------------------------------------------------------

    cameraSelect.disabled = false;
    microphoneSelect.disabled = false;

    placeholder.innerHTML = `
      <div class="live-create-placeholder-icon">
        📷
      </div>

      <h3>
        CAMERA + MICROPHONE
      </h3>

      <p class="mb-0">
        Camera and microphone will be used.
      </p>
    `;

    placeholder.style.display = "flex";
    video.style.display = "none";

    setStatus("Camera and microphone selected.");
  }

  // ============================================================
  // LOAD DEVICES
  // ============================================================

  async function loadDevices() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        setStatus(
          "Your browser does not support camera and microphone selection.",
          "error",
        );

        return;
      }

      const selectedCamera = cameraSelect.value;

      const selectedMicrophone = microphoneSelect.value;

      const devices = await navigator.mediaDevices.enumerateDevices();

      cameraSelect.innerHTML = "";
      microphoneSelect.innerHTML = "";

      // --------------------------------------------------------
      // DEFAULT CAMERA
      // --------------------------------------------------------

      const defaultCameraOption = document.createElement("option");

      defaultCameraOption.value = "";
      defaultCameraOption.textContent = "Default Camera";

      cameraSelect.appendChild(defaultCameraOption);

      // --------------------------------------------------------
      // DEFAULT MICROPHONE
      // --------------------------------------------------------

      const defaultMicrophoneOption = document.createElement("option");

      defaultMicrophoneOption.value = "";
      defaultMicrophoneOption.textContent = "Default Microphone";

      microphoneSelect.appendChild(defaultMicrophoneOption);

      let cameraNumber = 1;
      let microphoneNumber = 1;

      // --------------------------------------------------------
      // DEVICES
      // --------------------------------------------------------

      devices.forEach((device) => {
        if (device.kind === "videoinput") {
          const option = document.createElement("option");

          option.value = device.deviceId;

          option.textContent = device.label || `Camera ${cameraNumber}`;

          cameraSelect.appendChild(option);

          cameraNumber++;
        }

        if (device.kind === "audioinput") {
          const option = document.createElement("option");

          option.value = device.deviceId;

          option.textContent = device.label || `Microphone ${microphoneNumber}`;

          microphoneSelect.appendChild(option);

          microphoneNumber++;
        }
      });

      // --------------------------------------------------------
      // RESTORE CAMERA
      // --------------------------------------------------------

      if (
        selectedCamera &&
        [...cameraSelect.options].some(
          (option) => option.value === selectedCamera,
        )
      ) {
        cameraSelect.value = selectedCamera;
      }

      // --------------------------------------------------------
      // RESTORE MICROPHONE
      // --------------------------------------------------------

      if (
        selectedMicrophone &&
        [...microphoneSelect.options].some(
          (option) => option.value === selectedMicrophone,
        )
      ) {
        microphoneSelect.value = selectedMicrophone;
      }

      updateModeUI();
    } catch (error) {
      console.error("LIVE DEVICE LIST ERROR:", error);

      setStatus("Unable to load camera and microphone devices.", "error");
    }
  }

  // ============================================================
  // MEDIA CONSTRAINTS
  // ============================================================

  function getMediaConstraints() {
    const mode = getLiveMode();

    const cameraId = cameraSelect.value;

    const microphoneId = microphoneSelect.value;

    let videoConstraints = false;
    let audioConstraints = false;

    // ----------------------------------------------------------
    // CAMERA
    // ----------------------------------------------------------

    if (mode === "camera" || mode === "both") {
      videoConstraints = cameraId
        ? {
            deviceId: {
              exact: cameraId,
            },
          }
        : true;
    }

    // ----------------------------------------------------------
    // MICROPHONE
    // ----------------------------------------------------------

    if (mode === "microphone" || mode === "both") {
      audioConstraints = microphoneId
        ? {
            deviceId: {
              exact: microphoneId,
            },
          }
        : true;
    }

    return {
      video: videoConstraints,
      audio: audioConstraints,
    };
  }

  // ============================================================
  // START PREVIEW / REQUEST PERMISSION
  // ============================================================

  async function startPreview() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus(
          "Your browser does not support camera and microphone access.",
          "error",
        );

        return;
      }

      // --------------------------------------------------------
      // STOP PREVIOUS STREAM
      // --------------------------------------------------------

      stopCurrentStream();

      const mode = getLiveMode();

      const constraints = getMediaConstraints();

      // --------------------------------------------------------
      // VALIDATE
      // --------------------------------------------------------

      if (constraints.video === false && constraints.audio === false) {
        setStatus("Please select a camera, microphone, or both.", "warning");

        return;
      }

      // --------------------------------------------------------
      // STATUS
      // --------------------------------------------------------

      if (mode === "camera") {
        setStatus("Requesting camera access...", "warning");
      } else if (mode === "microphone") {
        setStatus("Requesting microphone access...", "warning");
      } else {
        setStatus("Requesting camera and microphone access...", "warning");
      }

      // --------------------------------------------------------
      // GET USER MEDIA
      // --------------------------------------------------------

      currentStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!currentStream) {
        throw new Error("Unable to access your selected device.");
      }

      console.log("LIVE CREATE: Media stream ready.", currentStream);

      // --------------------------------------------------------
      // MICROPHONE ONLY
      // --------------------------------------------------------

      if (mode === "microphone") {
        try {
          video.pause();
        } catch {}

        video.srcObject = null;
        video.style.display = "none";

        placeholder.innerHTML = `
          <div class="live-create-placeholder-icon">
            🎤
          </div>

          <h3>
            MICROPHONE READY
          </h3>

          <p class="mb-0">
            Your microphone is ready.
          </p>
        `;

        placeholder.style.display = "flex";
      }

      // --------------------------------------------------------
      // CAMERA / BOTH
      // --------------------------------------------------------
      else {
        video.srcObject = currentStream;

        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;

        video.style.display = "block";

        placeholder.style.display = "none";

        try {
          await video.play();
        } catch (error) {
          console.warn("LIVE CREATE: Preview play warning:", error);
        }
      }

      // --------------------------------------------------------
      // REFRESH DEVICE LABELS
      // --------------------------------------------------------

      await loadDevices();

      // --------------------------------------------------------
      // READY STATUS
      // --------------------------------------------------------

      if (mode === "camera") {
        setStatus("Camera ready. You can schedule this live.", "success");
      } else if (mode === "microphone") {
        setStatus("Microphone ready. You can schedule this live.", "success");
      } else {
        setStatus(
          "Camera and microphone ready. You can schedule this live.",
          "success",
        );
      }

      setDevicesReady();
      setScheduleButtonReady();
    } catch (error) {
      console.error("LIVE DEVICE ERROR:", error);

      currentStream = null;

      video.srcObject = null;

      resetScheduleButton();
      resetDeviceButton();

      if (error?.name === "NotAllowedError") {
        setStatus(
          "Permission was denied. Allow camera/microphone access and try again.",
          "error",
        );
      } else if (error?.name === "NotFoundError") {
        setStatus(
          "The selected camera or microphone could not be found.",
          "error",
        );
      } else if (error?.name === "NotReadableError") {
        setStatus(
          "The camera or microphone is already being used by another application.",
          "error",
        );
      } else if (error?.name === "SecurityError") {
        setStatus(
          "Camera/microphone access requires HTTPS or localhost.",
          "error",
        );
      } else if (error?.name === "OverconstrainedError") {
        setStatus(
          "The selected camera or microphone is no longer available. Please select another device.",
          "error",
        );
      } else {
        setStatus(
          error?.message || "Unable to access the selected device.",
          "error",
        );
      }
    }
  }

  // ============================================================
  // MODE CHANGE
  // ============================================================

  liveModeSelect.addEventListener("change", () => {
    stopCurrentStream();

    resetPreview();

    resetScheduleButton();
    resetDeviceButton();

    updateModeUI();
  });

  // ============================================================
  // ENABLE DEVICES
  // ============================================================

  enableDevicesBtn.addEventListener("click", async () => {
    await startPreview();
  });

  // ============================================================
  // CAMERA CHANGE
  // ============================================================

  cameraSelect.addEventListener("change", async () => {
    if (!currentStream) {
      return;
    }

    if (getLiveMode() === "microphone") {
      return;
    }

    await startPreview();
  });

  // ============================================================
  // MICROPHONE CHANGE
  // ============================================================

  microphoneSelect.addEventListener("change", async () => {
    if (!currentStream) {
      return;
    }

    if (getLiveMode() === "camera") {
      return;
    }

    await startPreview();
  });

  // ============================================================
  // SCHEDULE LIVE
  // ============================================================
  //
  // THIS BUTTON ONLY SCHEDULES.
  //
  // It does NOT call /live/:id/start.
  //
  // Flow:
  //
  // /live/create
  //       ↓
  // Schedule Live
  //       ↓
  // POST /live/schedule
  //       ↓
  // INSERT scheduled broadcast
  //       ↓
  // receive broadcast ID
  //       ↓
  // /live/:id
  //
  // START LIVE happens later on live-watch.ejs.
  //
  // ============================================================

  scheduleBtn.addEventListener("click", async () => {
    if (isScheduling) {
      return;
    }

    // --------------------------------------------------------
    // TITLE
    // --------------------------------------------------------

    const title = titleInput.value.trim();

    if (!title) {
      setStatus("Please enter a title for your live broadcast.", "warning");

      titleInput.focus();

      return;
    }

    if (title.length > 200) {
      setStatus("Live title is too long.", "warning");

      titleInput.focus();

      return;
    }

    // --------------------------------------------------------
    // DEVICE
    // --------------------------------------------------------

    if (!currentStream) {
      setStatus("Please enable your selected device first.", "warning");

      return;
    }

    const mode = getLiveMode();

    // --------------------------------------------------------
    // SCHEDULED TIME
    // --------------------------------------------------------

    let scheduledAt;

    if (scheduledAtInput && scheduledAtInput.value) {
      const localDate = new Date(scheduledAtInput.value);

      if (Number.isNaN(localDate.getTime())) {
        setStatus("Please enter a valid schedule date and time.", "warning");

        scheduledAtInput.focus();

        return;
      }

      scheduledAt = localDate.toISOString();
    } else {
      // If there is no date/time field,
      // schedule immediately as a scheduled broadcast.
      scheduledAt = new Date().toISOString();
    }

    // --------------------------------------------------------
    // LOCK UI
    // --------------------------------------------------------

    isScheduling = true;

    scheduleBtn.disabled = true;

    scheduleBtn.textContent = "Saving Schedule...";

    enableDevicesBtn.disabled = true;

    cameraSelect.disabled = true;

    microphoneSelect.disabled = true;

    liveModeSelect.disabled = true;

    titleInput.disabled = true;

    if (scheduledAtInput) {
      scheduledAtInput.disabled = true;
    }

    setStatus("Saving your live schedule...", "warning");

    try {
      // ======================================================
      // CREATE SCHEDULE
      // ======================================================

      const response = await fetch("/live/schedule", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        credentials: "same-origin",

        body: JSON.stringify({
          title,
          mode,
          scheduledAt,
        }),
      });

      const data = await response.json().catch(() => ({}));

      console.log("LIVE CREATE: Schedule response:", response.status, data);

      // ------------------------------------------------------
      // ERROR
      // ------------------------------------------------------

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to schedule live broadcast.");
      }

      // ------------------------------------------------------
      // BROADCAST ID
      // ------------------------------------------------------

      const broadcastId = String(data.broadcastId || "").trim();

      if (!broadcastId || !/^\d+$/.test(broadcastId)) {
        throw new Error(
          "Live was scheduled, but no valid broadcast ID was returned.",
        );
      }

      console.log("LIVE CREATE: Broadcast scheduled:", broadcastId);

      // ------------------------------------------------------
      // STOP PREVIEW
      // ------------------------------------------------------

      stopCurrentStream();

      // ------------------------------------------------------
      // REDIRECT TO LIVE WATCH
      // ------------------------------------------------------

      const redirect =
        data.redirect || `/live/${encodeURIComponent(broadcastId)}`;

      setStatus("Live scheduled. Opening your live page...", "success");

      console.log("LIVE CREATE: Redirecting:", redirect);

      window.location.href = redirect;
    } catch (error) {
      // ======================================================
      // SCHEDULE ERROR
      // ======================================================

      console.error("SCHEDULE LIVE ERROR:", error);

      isScheduling = false;

      scheduleBtn.disabled = false;

      scheduleBtn.textContent = "📅 Schedule Live";

      enableDevicesBtn.disabled = false;

      cameraSelect.disabled = getLiveMode() === "microphone";

      microphoneSelect.disabled = getLiveMode() === "camera";

      liveModeSelect.disabled = false;

      titleInput.disabled = false;

      if (scheduledAtInput) {
        scheduledAtInput.disabled = false;
      }

      setStatus(
        error?.message || "Unable to schedule live broadcast.",
        "error",
      );
    }
  });

  // ============================================================
  // PAGE CLEANUP
  // ============================================================

  window.addEventListener("beforeunload", () => {
    stopCurrentStream();
  });

  // ============================================================
  // INITIAL UI
  // ============================================================

  resetScheduleButton();

  updateModeUI();

  loadDevices();
});
