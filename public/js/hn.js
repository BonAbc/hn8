document.addEventListener("DOMContentLoaded", () => {
  // Get references to the video and buttons
  const video = document.getElementById("sapVideo");
  const playBtn = document.getElementById("playBtn");
  const pauseBtn = document.getElementById("pauseBtn");

  // Play button: start the video
  playBtn.addEventListener("click", () => {
    video.play(); // Play the video
  });

  // Pause button: stop the video
  pauseBtn.addEventListener("click", () => {
    video.pause(); // Pause the video
  });

  // Optional: automatically pause video when it ends
  video.addEventListener("ended", () => {
    video.pause();
  });
});
