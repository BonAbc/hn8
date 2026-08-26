// ============================================================
// SOCIAL PUBLIC CONNECT
// Front-end JavaScript
//
// Used by:
//     social-public-connect.ejs
//
// Public visitors do NOT need to log in.
//
// Visitor identity is handled by the backend using:
//     publicVisitorId
//
// Public reactions are stored separately in:
//     social_public_reactions
//
// CONNECT ENDPOINT:
//     POST /public/post/connect
//
// Existing logged-in social reactions remain untouched.
// ============================================================

// ============================================================
// SET POST IMAGE RATIO
// ============================================================

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

// ============================================================
// INITIALIZE ONE POST
// ============================================================

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

// ============================================================
// PUBLIC CONNECT REACTION
//
// Public visitors do NOT need to log in.
//
// Backend identifies visitor with:
//
//     publicVisitorId
//
// Reaction is saved into:
//
//     social_public_reactions
//
// NOT:
//
//     social_reactions
//
// CONNECT ENDPOINT:
//
//     POST /public/post/connect
// ============================================================

async function socialPublicConnect(button) {
  if (!button) {
    return;
  }

  // ----------------------------------------------------------
  // Find connect/reaction container
  // ----------------------------------------------------------

  const reactionContainer = button.closest(".social-public-reactions");

  if (!reactionContainer) {
    return;
  }

  // ----------------------------------------------------------
  // Get post ID
  // ----------------------------------------------------------

  const postId = reactionContainer.dataset.postId;

  // ----------------------------------------------------------
  // Get reaction type
  // ----------------------------------------------------------

  const reactionType = button.dataset.reaction;

  // ----------------------------------------------------------
  // Validate
  // ----------------------------------------------------------

  if (!postId || !reactionType) {
    console.error("PUBLIC CONNECT: missing postId or reactionType", {
      postId,
      reactionType,
    });

    return;
  }

  // ----------------------------------------------------------
  // Prevent duplicate clicks
  // ----------------------------------------------------------

  if (button.disabled) {
    return;
  }

  button.disabled = true;

  // ----------------------------------------------------------
  // Visual loading state
  // ----------------------------------------------------------

  button.classList.add("social-public-reaction-loading");

  try {
    // --------------------------------------------------------
    // SAVE PUBLIC REACTION
    //
    // CONNECT ENDPOINT
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Read response safely
    // --------------------------------------------------------

    let data = null;

    try {
      data = await response.json();
    } catch (jsonError) {
      console.error("PUBLIC CONNECT: invalid server response", jsonError);
    }

    // --------------------------------------------------------
    // Server error
    // --------------------------------------------------------

    if (!response.ok || !data?.success) {
      throw new Error(
        data?.error || `Unable to save reaction (${response.status}).`,
      );
    }

    // --------------------------------------------------------
    // Successful reaction
    //
    // Reload page so counts come from PostgreSQL.
    // --------------------------------------------------------

    window.location.reload();
  } catch (error) {
    console.error("PUBLIC CONNECT ERROR:", error);

    alert(error.message || "Unable to save reaction.");

    button.disabled = false;

    button.classList.remove("social-public-reaction-loading");
  }
}

// ============================================================
// PUBLIC CONNECT CLICK HANDLER
//
// Event delegation.
//
// IMPORTANT:
// Only one document listener is registered.
// ============================================================

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

// ============================================================
// INITIALIZE PUBLIC CONNECT PAGE
// ============================================================

function socialPublicConnectInitialize() {
  const posts = document.querySelectorAll(
    ".social-public-page .social-public-post",
  );

  posts.forEach((post) => {
    socialPublicConnectInitializePost(post);
  });

  socialPublicConnectInitializeReactions();
}

// ============================================================
// DOM READY
// ============================================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", socialPublicConnectInitialize, {
    once: true,
  });
} else {
  socialPublicConnectInitialize();
}
