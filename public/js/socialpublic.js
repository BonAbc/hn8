function socialPublicSetPostImageRatio(post) {
  if (!post) {
    return;
  }

  const mediaContainer = post.querySelector(".social-post-media");

  if (!mediaContainer) {
    return;
  }

  const images = Array.from(
    mediaContainer.querySelectorAll(".social-post-image"),
  );

  if (images.length <= 1) {
    mediaContainer.style.removeProperty("--social-average-image-ratio");

    return;
  }

  const ratios = images
    .filter((image) => image.naturalWidth > 0 && image.naturalHeight > 0)
    .map((image) => image.naturalWidth / image.naturalHeight);

  if (!ratios.length) {
    return;
  }

  const averageRatio =
    ratios.reduce((total, ratio) => total + ratio, 0) / ratios.length;

  mediaContainer.style.setProperty(
    "--social-average-image-ratio",
    averageRatio,
  );
}

function socialPublicInitializePost(post) {
  if (!post) {
    return;
  }

  const images = post.querySelectorAll(".social-post-image");

  if (!images.length) {
    return;
  }

  images.forEach((image) => {
    if (image.complete) {
      socialPublicSetPostImageRatio(post);

      return;
    }

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

function socialPublicInitialize() {
  const posts = document.querySelectorAll(
    ".social-public-page .social-public-post",
  );

  posts.forEach((post) => {
    socialPublicInitializePost(post);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", socialPublicInitialize, {
    once: true,
  });
} else {
  socialPublicInitialize();
}
