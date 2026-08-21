// ============================================================
// SOCIAL PUBLIC
// ============================================================

// ============================================================
// CALCULATE IMAGE RATIO FOR ONE POST
// ============================================================

function socialPublicSetPostImageRatio(post) {
  if (!post) {
    return;
  }

  const mediaContainer = post.querySelector(".social-post-media");

  if (!mediaContainer) {
    return;
  }

  // ----------------------------------------------------------
  // Get images belonging ONLY to this post
  // ----------------------------------------------------------

  const images = Array.from(
    mediaContainer.querySelectorAll(".social-post-image"),
  );

  // ----------------------------------------------------------
  // One image
  //
  // Leave it alone.
  //
  // This preserves the normal social.ejs behavior.
  // ----------------------------------------------------------

  if (images.length <= 1) {
    mediaContainer.style.removeProperty("--social-average-image-ratio");

    return;
  }

  // ----------------------------------------------------------
  // Get valid natural image ratios
  // ----------------------------------------------------------

  const ratios = images
    .filter((image) => image.naturalWidth > 0 && image.naturalHeight > 0)
    .map((image) => image.naturalWidth / image.naturalHeight);

  if (!ratios.length) {
    return;
  }

  // ----------------------------------------------------------
  // Average ratio
  // ----------------------------------------------------------

  const averageRatio =
    ratios.reduce((total, ratio) => total + ratio, 0) / ratios.length;

  // ----------------------------------------------------------
  // Store ratio ONLY on this post's media container
  // ----------------------------------------------------------

  mediaContainer.style.setProperty(
    "--social-average-image-ratio",
    averageRatio,
  );
}

// ============================================================
// INITIALIZE ONE POST
// ============================================================

function socialPublicInitializePost(post) {
  if (!post) {
    return;
  }

  const images = post.querySelectorAll(".social-post-image");

  if (!images.length) {
    return;
  }

  images.forEach((image) => {
    // --------------------------------------------------------
    // Image already loaded
    // --------------------------------------------------------

    if (image.complete) {
      socialPublicSetPostImageRatio(post);

      return;
    }

    // --------------------------------------------------------
    // Wait for image
    // --------------------------------------------------------

    image.addEventListener(
      "load",
      () => {
        socialPublicSetPostImageRatio(post);
      },
      {
        once: true,
      },
    );
  });
}

// ============================================================
// INITIALIZE PUBLIC FEED
// ============================================================

function socialPublicInitialize() {
  const posts = document.querySelectorAll(
    ".social-public-page .social-public-post",
  );

  posts.forEach((post) => {
    socialPublicInitializePost(post);
  });
}

// ============================================================
// DOM READY
// ============================================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", socialPublicInitialize, {
    once: true,
  });
} else {
  socialPublicInitialize();
}
