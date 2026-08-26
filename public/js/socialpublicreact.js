// ============================================================
// SOCIAL PUBLIC REACT
// Front-end JavaScript
//
// Used by:
//     social-public-react.ejs
//
// Public visitors do NOT need to log in.
//
// Visitor identity is handled by the backend using:
//     publicVisitorId
//
// Public reactions are stored separately in:
//     social_public_reactions
//
// Existing logged-in social reactions remain untouched.
// ============================================================

// ============================================================
// SET POST IMAGE RATIO
// ============================================================

function socialPublicReactSetPostImageRatio(post) {
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

function socialPublicReactInitializePost(post) {
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
      socialPublicReactSetPostImageRatio(post);

      return;
    }

    // --------------------------------------------------------
    // Wait for image
    // --------------------------------------------------------

    image.addEventListener(
      "load",
      () => {
        socialPublicReactSetPostImageRatio(post);
      },
      {
        once: true,
      },
    );
  });
}

// ============================================================
// PUBLIC REACTION
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
// ============================================================

async function socialPublicReact(button) {
  if (!button) {
    return;
  }

  // ----------------------------------------------------------
  // Find reaction container
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

  if (!postId || !reactionType) {
    console.error("PUBLIC REACTION: missing postId or reactionType");

    return;
  }

  // ----------------------------------------------------------
  // Prevent duplicate clicks while request is running
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
    // --------------------------------------------------------

    const response = await fetch("/public/post/react", {
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
      console.error("PUBLIC REACTION: invalid server response", jsonError);
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
    // Reload page so reaction counts come directly
    // from PostgreSQL.
    // --------------------------------------------------------

    window.location.reload();
  } catch (error) {
    console.error("PUBLIC REACTION ERROR:", error);

    alert(error.message || "Unable to save reaction.");

    button.disabled = false;

    button.classList.remove("social-public-reaction-loading");
  }
}

// ============================================================
// PUBLIC REACTION CLICK HANDLER
//
// Event delegation.
// No separate listener is needed for every button.
// ============================================================

function socialPublicReactInitializeReactions() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".social-public-reaction-btn");

    if (!button) {
      return;
    }

    socialPublicReact(button);
  });
}

// ============================================================
// INITIALIZE PUBLIC REACTION PAGE
// ============================================================

function socialPublicReactInitialize() {
  // ----------------------------------------------------------
  // Initialize posts / image ratios
  // ----------------------------------------------------------

  const posts = document.querySelectorAll(
    ".social-public-page .social-public-post",
  );

  posts.forEach((post) => {
    socialPublicReactInitializePost(post);
  });

  // ----------------------------------------------------------
  // Initialize public reaction buttons
  // ----------------------------------------------------------

  socialPublicReactInitializeReactions();
}

// ============================================================
// DOM READY
// ============================================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", socialPublicReactInitialize, {
    once: true,
  });
} else {
  socialPublicReactInitialize();
}
