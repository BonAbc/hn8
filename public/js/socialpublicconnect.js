function socialPublicConnectSetPostImageRatio(post) {
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

function socialPublicConnectInitializePost(post) {
  if (!post) {
    return;
  }

  const images = post.querySelectorAll(".social-post-image");

  if (!images.length) {
    return;
  }

  images.forEach((image) => {
    if (image.complete) {
      socialPublicConnectSetPostImageRatio(post);

      return;
    }

    image.addEventListener(
      "load",
      () => {
        socialPublicConnectSetPostImageRatio(post);
      },
      {
        once: true,
      },
    );
  });
}

async function socialPublicConnect(button) {
  if (!button) {
    return;
  }

  const reactionContainer = button.closest(".social-public-reactions");

  if (!reactionContainer) {
    return;
  }

  const postId = reactionContainer.dataset.postId;

  const reactionType = button.dataset.reaction;

  if (!postId || !reactionType) {
    console.error("PUBLIC CONNECT: missing postId or reactionType", {
      postId,
      reactionType,
    });

    return;
  }

  if (button.disabled) {
    return;
  }

  button.disabled = true;

  button.classList.add("social-public-reaction-loading");

  try {
    const response = await fetch("/public/post/connect", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "same-origin",

      body: JSON.stringify({
        postId,
        reactionType,
      }),
    });

    let data = null;

    try {
      data = await response.json();
    } catch (jsonError) {
      console.error("PUBLIC CONNECT: invalid server response", jsonError);
    }

    if (!response.ok || !data?.success) {
      throw new Error(
        data?.error || `Unable to save reaction (${response.status}).`,
      );
    }

    window.location.reload();
  } catch (error) {
    console.error("PUBLIC CONNECT ERROR:", error);

    alert(error.message || "Unable to save reaction.");

    button.disabled = false;

    button.classList.remove("social-public-reaction-loading");
  }
}

function socialPublicConnectInitializeReactions() {
  if (window.socialPublicConnectClickHandlerInitialized) {
    return;
  }

  window.socialPublicConnectClickHandlerInitialized = true;

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".social-public-reaction-btn");

    if (!button) {
      return;
    }

    event.preventDefault();

    if (button.disabled) {
      return;
    }

    socialPublicConnect(button);
  });
}

function socialPublicConnectInitialize() {
  const posts = document.querySelectorAll(
    ".social-public-page .social-public-post",
  );

  posts.forEach((post) => {
    socialPublicConnectInitializePost(post);
  });

  socialPublicConnectInitializeReactions();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", socialPublicConnectInitialize, {
    once: true,
  });
} else {
  socialPublicConnectInitialize();
}
