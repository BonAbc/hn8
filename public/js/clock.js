function updateClock() {
  const secondHand = document.getElementById("second");
  const minuteHand = document.getElementById("minute");
  const hourHand = document.getElementById("hour");

  if (!secondHand || !minuteHand || !hourHand) {
    return;
  }

  // Chicago time
  const now = luxon.DateTime.now().setZone("America/Chicago");

  // Smooth movement
  const seconds = now.second + now.millisecond / 1000;
  const minutes = now.minute + seconds / 60;
  const hours = (now.hour % 12) + minutes / 60;

  // Second hand
  secondHand.style.transform = `translateX(-50%) rotate(${seconds * 6}deg)`;

  // Minute hand
  minuteHand.style.transform = `translateX(-50%) rotate(${minutes * 6}deg)`;

  // Hour hand
  hourHand.style.transform = `translateX(-50%) rotate(${hours * 30}deg)`;
}

// Start clock
updateClock();

// Update smoothly
setInterval(updateClock, 50);
