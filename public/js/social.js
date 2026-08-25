// ============================================================
// SOCIAL COMMENT
// ============================================================

function socialFocusComment(postId) {
  const form = document.getElementById("social-comment-" + postId);

  if (!form) return;

  const input = form.querySelector("input[name='comment']");

  if (!input) return;

  input.focus();

  input.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

// ============================================================
// SOCIAL REPLY
// ============================================================

function socialShowReply(commentId, parentReplyId = null) {
  let form;

  if (!parentReplyId) {
    form = document.getElementById("social-reply-" + commentId);
  } else {
    form = document.getElementById("social-reply-to-" + parentReplyId);
  }

  if (!form) {
    console.log("FORM NOT FOUND", {
      commentId,
      parentReplyId,
    });

    return;
  }

  if (form.style.display === "none" || !form.style.display) {
    form.style.display = "flex";

    const input = form.querySelector("input[name='reply']");

    if (input) {
      input.focus();

      input.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  } else {
    form.style.display = "none";
  }
}

// ============================================================
// SOCIAL EDIT POST
// ============================================================

function socialEditPost(postId) {
  const content = prompt("Edit your post:");

  if (content === null) {
    return;
  }

  const trimmed = content.trim();

  if (!trimmed) {
    return;
  }

  if (trimmed.length > 5000) {
    alert("Your post is too long. Please keep it under 5000 characters.");
    return;
  }

  const form = document.createElement("form");

  form.method = "POST";
  form.action = "/social/post/edit";

  const id = document.createElement("input");

  id.type = "hidden";
  id.name = "id";
  id.value = postId;

  const text = document.createElement("input");

  text.type = "hidden";
  text.name = "content";
  text.value = trimmed;

  form.appendChild(id);
  form.appendChild(text);

  document.body.appendChild(form);

  form.submit();
}

// ============================================================
// SOCIAL SHARE
// ============================================================

document.addEventListener("click", async (event) => {
  const button = event.target.closest(".social-share-button");

  if (!button) {
    return;
  }

  const postId = button.dataset.postId;

  if (!postId) {
    return;
  }

  const originalHTML = button.innerHTML;

  try {
    button.disabled = true;

    button.innerHTML = "⏳ <span>Sharing...</span>";

    const response = await fetch("/social/post/share", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        postId: postId,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Unable to share post.");
    }

    if (navigator.share) {
      await navigator.share({
        title: "Social Post",
        text: "Check out this post",
        url: data.url,
      });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(data.url);

      button.innerHTML = "✓ <span>Link copied</span>";

      setTimeout(() => {
        button.innerHTML = originalHTML;
      }, 2000);

      return;
    }

    button.innerHTML = "✓ <span>Shared</span>";

    setTimeout(() => {
      button.innerHTML = originalHTML;
    }, 2000);
  } catch (err) {
    if (err.name === "AbortError") {
      button.innerHTML = originalHTML;
      return;
    }

    console.error("Share error:", err);

    button.innerHTML = "⚠️ <span>Share failed</span>";

    setTimeout(() => {
      button.innerHTML = originalHTML;
    }, 2000);
  } finally {
    button.disabled = false;
  }
});

// ============================================================
// SOCIAL POST CREATE
// ============================================================

const socialPostCreateComposer = document.getElementById(
  "socialPostCreateComposer",
);

const socialPostCreateContent = document.getElementById(
  "socialPostCreateContent",
);

const socialPostFilesInput = document.getElementById("socialPostFiles");

const socialPostFilesPreview = document.getElementById(
  "socialPostFilesPreview",
);

// IMPORTANT
// Get the form directly.
//
// Your HTML has:
//
// <form
//   id="socialCreatePostForm"
//   action="/social/post/create"
// >
//
// ============================================================

const socialPostCreateForm = document.getElementById("socialCreatePostForm");

// ============================================================
// POST BUTTON
//
// We find the submit button automatically.
// ============================================================

const socialPostCreateButton = socialPostCreateForm?.querySelector(
  'button[type="submit"], input[type="submit"]',
);

// ============================================================
// ATTACHMENTS
//
// Every attachment:
//
// {
//   file: File,
//   mediaText: "",
//   objectUrl: null
// }
// ============================================================

let socialPostAttachments = [];

// ============================================================
// POSTING STATE
// ============================================================

let socialPostIsSubmitting = false;

// ============================================================
// MAXIMUMS
// ============================================================

const SOCIAL_MAX_FILES = 10;

const SOCIAL_MAX_FILE_SIZE = 100 * 1024 * 1024;

const SOCIAL_MAX_CONTENT_LENGTH = 5000;

// ============================================================
// ALLOWED FILE TYPES
// ============================================================

const SOCIAL_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/pdf",
];

// ============================================================
// ADD ATTACHMENT
// ============================================================

function socialAddPostAttachment(file) {
  if (!file) {
    return false;
  }

  // ----------------------------------------------------------
  // MAX FILE COUNT
  // ----------------------------------------------------------

  if (socialPostAttachments.length >= SOCIAL_MAX_FILES) {
    alert(`You can upload a maximum of ${SOCIAL_MAX_FILES} files.`);

    return false;
  }

  // ----------------------------------------------------------
  // MAX FILE SIZE
  // ----------------------------------------------------------

  if (file.size > SOCIAL_MAX_FILE_SIZE) {
    alert(`${file.name} is too large. Maximum file size is 100 MB.`);

    return false;
  }

  // ----------------------------------------------------------
  // FILE TYPE
  // ----------------------------------------------------------

  if (!SOCIAL_ALLOWED_TYPES.includes(file.type)) {
    alert("Only JPG, PNG, WebP, GIF, MP4, WebM, and PDF files are allowed.");

    return false;
  }

  // ----------------------------------------------------------
  // ONLY ONE VIDEO
  // ----------------------------------------------------------

  if (file.type.startsWith("video/")) {
    const existingVideo = socialPostAttachments.some((attachment) =>
      attachment.file.type.startsWith("video/"),
    );

    if (existingVideo) {
      alert("You can upload only 1 video per post.");
      return false;
    }
  }

  // ----------------------------------------------------------
  // ADD
  // ----------------------------------------------------------

  console.log("ADDING ATTACHMENT:", {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  socialPostAttachments.push({
    file: file,
    mediaText: "",
    objectUrl: null,
  });

  socialRenderPostAttachments();

  return true;
}

// ============================================================
// SELECT FILES
// ============================================================

if (socialPostFilesInput) {
  socialPostFilesInput.addEventListener("change", () => {
    const files = Array.from(socialPostFilesInput.files || []);

    console.log("FILES SELECTED:", files);

    for (const file of files) {
      if (socialPostAttachments.length >= SOCIAL_MAX_FILES) {
        alert(`You can upload a maximum of ${SOCIAL_MAX_FILES} files.`);

        break;
      }

      socialAddPostAttachment(file);
    }

    // IMPORTANT:
    //
    // DO NOT DO:
    //
    // socialPostFilesInput.value = "";
    //
    // Keep the actual selected files available.
    //
    // We also have them inside
    // socialPostAttachments.
  });
}

// ============================================================
// PASTE IMAGE INTO SOCIAL POST
// ============================================================

if (socialPostCreateComposer) {
  socialPostCreateComposer.addEventListener("paste", (event) => {
    const clipboardItems = event.clipboardData?.items;

    if (!clipboardItems) {
      return;
    }

    let imageFound = false;

    for (const item of clipboardItems) {
      if (!item.type || !item.type.startsWith("image/")) {
        continue;
      }

      const file = item.getAsFile();

      if (!file) {
        continue;
      }

      imageFound = true;

      const extension =
        file.type === "image/jpeg"
          ? "jpg"
          : file.type === "image/webp"
            ? "webp"
            : file.type === "image/gif"
              ? "gif"
              : "png";

      const pastedFile = new File(
        [file],
        `pasted-image-${Date.now()}.${extension}`,
        {
          type: file.type,
        },
      );

      console.log("PASTED IMAGE:", {
        name: pastedFile.name,
        type: pastedFile.type,
        size: pastedFile.size,
      });

      socialAddPostAttachment(pastedFile);

      // Prevent image from being inserted
      // into contenteditable.
      event.preventDefault();

      break;
    }

    if (imageFound) {
      console.log("PASTE IMAGE CAPTURED");
    }
  });
}

// ============================================================
// RENDER ALL ATTACHMENTS
// ============================================================

function socialRenderPostAttachments() {
  if (!socialPostFilesPreview) {
    return;
  }

  socialPostFilesPreview.innerHTML = "";

  socialPostAttachments.forEach((attachment, index) => {
    // ------------------------------------------------------
    // MAIN WRAPPER
    // ------------------------------------------------------

    const wrapper = document.createElement("div");

    wrapper.className = "social-post-attachment";

    wrapper.dataset.index = index;

    // ------------------------------------------------------
    // IMAGE PREVIEW
    // ------------------------------------------------------

    if (attachment.file.type.startsWith("image/")) {
      const image = document.createElement("img");

      if (!attachment.objectUrl) {
        attachment.objectUrl = URL.createObjectURL(attachment.file);
      }

      image.src = attachment.objectUrl;

      image.alt = attachment.file.name;

      image.className = "social-post-create-pasted-image";

      wrapper.appendChild(image);
    }

    // ------------------------------------------------------
    // VIDEO PREVIEW
    // ------------------------------------------------------
    else if (attachment.file.type.startsWith("video/")) {
      if (!attachment.objectUrl) {
        attachment.objectUrl = URL.createObjectURL(attachment.file);
      }

      const video = document.createElement("video");

      video.src = attachment.objectUrl;

      video.className = "social-post-create-video";

      video.controls = true;

      video.preload = "metadata";

      video.playsInline = true;

      video.muted = true;

      wrapper.appendChild(video);
    }

    // ------------------------------------------------------
    // PDF PREVIEW
    // ------------------------------------------------------
    else if (attachment.file.type === "application/pdf") {
      const pdf = document.createElement("div");

      pdf.className = "social-post-pdf-preview";

      pdf.textContent = `📄 ${attachment.file.name}`;

      wrapper.appendChild(pdf);
    }

    // ------------------------------------------------------
    // FILE NAME
    // ------------------------------------------------------

    const fileName = document.createElement("div");

    fileName.className = "social-post-attachment-name";

    fileName.textContent = attachment.file.name;

    wrapper.appendChild(fileName);

    // ------------------------------------------------------
    // FILE SIZE
    // ------------------------------------------------------

    const fileSize = document.createElement("div");

    fileSize.className = "social-post-attachment-size";

    fileSize.textContent = socialFormatFileSize(attachment.file.size);

    wrapper.appendChild(fileSize);

    // ------------------------------------------------------
    // INDIVIDUAL MEDIA TEXT
    // ------------------------------------------------------

    const mediaText = document.createElement("textarea");

    mediaText.className = "social-post-media-text";

    mediaText.name = "media_text";

    mediaText.placeholder = "Add text for this image or file...";

    mediaText.value = attachment.mediaText;

    mediaText.maxLength = 5000;

    mediaText.addEventListener("input", () => {
      if (socialPostAttachments[index]) {
        socialPostAttachments[index].mediaText = mediaText.value;
      }
    });

    wrapper.appendChild(mediaText);

    // ------------------------------------------------------
    // REMOVE BUTTON
    // ------------------------------------------------------

    const removeButton = document.createElement("button");

    removeButton.type = "button";

    removeButton.className = "social-post-remove-file";

    removeButton.textContent = "Remove";

    removeButton.addEventListener("click", () => {
      const attachment = socialPostAttachments[index];

      if (attachment?.objectUrl) {
        URL.revokeObjectURL(attachment.objectUrl);
      }

      socialPostAttachments.splice(index, 1);

      socialRenderPostAttachments();
    });

    wrapper.appendChild(removeButton);

    // ------------------------------------------------------
    // ADD TO PREVIEW
    // ------------------------------------------------------

    socialPostFilesPreview.appendChild(wrapper);
  });
}

// ============================================================
// FILE SIZE
// ============================================================

function socialFormatFileSize(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];

  let size = bytes;

  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// ============================================================
// SET POST BUTTON STATE
// ============================================================

function socialSetPostButtonState(isPosting) {
  if (!socialPostCreateButton) {
    return;
  }

  if (isPosting) {
    socialPostCreateButton.disabled = true;

    if (socialPostCreateButton.tagName === "INPUT") {
      socialPostCreateButton.value = "⏳ Posting...";
    } else {
      socialPostCreateButton.innerHTML = "⏳ Posting...";
    }

    socialPostCreateButton.setAttribute("aria-busy", "true");
  } else {
    socialPostCreateButton.disabled = false;

    if (socialPostCreateButton.tagName === "INPUT") {
      socialPostCreateButton.value = "Post";
    } else {
      socialPostCreateButton.innerHTML = "Post";
    }

    socialPostCreateButton.removeAttribute("aria-busy");
  }
}

// ============================================================
// SUBMIT SOCIAL POST
// ============================================================

if (!socialPostCreateForm) {
  console.error("SOCIAL POST FORM NOT FOUND: #socialCreatePostForm");
} else {
  console.log("SOCIAL POST FORM FOUND:", socialPostCreateForm);

  socialPostCreateForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // ------------------------------------------------------
    // PREVENT DOUBLE SUBMIT
    // ------------------------------------------------------

    if (socialPostIsSubmitting) {
      console.log("POST ALREADY SUBMITTING");

      return;
    }

    socialPostIsSubmitting = true;

    socialSetPostButtonState(true);

    console.log("================================");

    console.log("POST BUTTON CLICKED");

    console.log("ATTACHMENTS:", socialPostAttachments);

    console.log("================================");

    try {
      // ----------------------------------------------------
      // MAIN POST CONTENT
      // ----------------------------------------------------

      const content = socialPostCreateComposer?.innerText.trim() || "";

      if (socialPostCreateContent) {
        socialPostCreateContent.value = content;
      }

      // ----------------------------------------------------
      // CHECK EMPTY POST
      // ----------------------------------------------------

      if (!content && socialPostAttachments.length === 0) {
        throw new Error("Post cannot be empty.");
      }

      // ----------------------------------------------------
      // MAX POST CONTENT
      // ----------------------------------------------------

      if (content.length > SOCIAL_MAX_CONTENT_LENGTH) {
        throw new Error(
          "Your post is too long. Please keep it under 5000 characters.",
        );
      }

      // ----------------------------------------------------
      // CHECK FILES AGAIN
      // ----------------------------------------------------

      for (const attachment of socialPostAttachments) {
        if (attachment.file.size > SOCIAL_MAX_FILE_SIZE) {
          throw new Error(
            `${attachment.file.name} is too large. Maximum file size is 100 MB.`,
          );
        }

        if (!SOCIAL_ALLOWED_TYPES.includes(attachment.file.type)) {
          throw new Error(`File type not allowed: ${attachment.file.name}`);
        }
      }

      // ----------------------------------------------------
      // CREATE FORM DATA
      // ----------------------------------------------------

      const formData = new FormData();

      // ----------------------------------------------------
      // CONTENT
      // ----------------------------------------------------

      formData.append("content", content);

      // ----------------------------------------------------
      // VISIBILITY
      // ----------------------------------------------------

      const visibility = socialPostCreateForm.querySelector(
        'input[name="visibility"]:checked',
      );

      formData.append("visibility", visibility?.value || "loggedin users");

      // ----------------------------------------------------
      // FILES
      // ----------------------------------------------------

      socialPostAttachments.forEach((attachment, index) => {
        console.log("ADDING FILE TO FORM DATA:", {
          index,
          name: attachment.file.name,
          type: attachment.file.type,
          size: attachment.file.size,
        });

        formData.append("files", attachment.file, attachment.file.name);

        // ------------------------------------------------
        // MEDIA TEXT
        // ------------------------------------------------

        formData.append("media_text", attachment.mediaText || "");
      });

      // ----------------------------------------------------
      // DEBUG FORM DATA
      // ----------------------------------------------------

      console.log("FORM DATA CONTENT:", content);

      console.log("FORM DATA FILE COUNT:", socialPostAttachments.length);

      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log("FORM DATA FILE:", {
            key,
            name: value.name,
            type: value.type,
            size: value.size,
          });
        } else {
          console.log("FORM DATA:", key, value);
        }
      }

      // ----------------------------------------------------
      // SHOW UPLOAD MESSAGE
      // ----------------------------------------------------

      const hasVideo = socialPostAttachments.some((attachment) =>
        attachment.file.type.startsWith("video/"),
      );

      if (hasVideo && socialPostCreateButton) {
        const uploadText = "⏳ Uploading video... 0%";

        if (socialPostCreateButton.tagName === "INPUT") {
          socialPostCreateButton.value = uploadText;
        } else {
          socialPostCreateButton.innerHTML = uploadText;
        }
      }

      // ----------------------------------------------------
      // SEND TO EXPRESS WITH UPLOAD PROGRESS
      // ----------------------------------------------------

      console.log("SENDING POST TO:", socialPostCreateForm.action);

      const response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open("POST", socialPostCreateForm.action, true);

        // -----------------------------------------------
        // UPLOAD PROGRESS + TIME REMAINING
        // -----------------------------------------------

        const uploadStartTime = Date.now();

        xhr.upload.addEventListener("progress", (event) => {
          if (!event.lengthComputable || !hasVideo) {
            return;
          }

          const percent = Math.round((event.loaded / event.total) * 100);

          const elapsedSeconds = (Date.now() - uploadStartTime) / 1000;

          const uploadSpeed =
            elapsedSeconds > 0 ? event.loaded / elapsedSeconds : 0;

          const remainingBytes = event.total - event.loaded;

          const remainingSeconds =
            uploadSpeed > 0 ? remainingBytes / uploadSpeed : 0;

          let timeText = "";

          if (remainingSeconds > 60) {
            timeText = ` — ~${Math.ceil(remainingSeconds / 60)} min left`;
          } else if (remainingSeconds > 0) {
            timeText = ` — ~${Math.ceil(remainingSeconds)} sec left`;
          }

          console.log(
            `UPLOAD PROGRESS: ${percent}% — ${Math.ceil(
              remainingSeconds,
            )} sec remaining`,
          );

          if (socialPostCreateButton) {
            const uploadText = `⏳ Uploading video... ${percent}%${timeText}`;

            if (socialPostCreateButton.tagName === "INPUT") {
              socialPostCreateButton.value = uploadText;
            } else {
              socialPostCreateButton.innerHTML = uploadText;
            }
          }
        });

        // SERVER RESPONSE
        xhr.addEventListener("load", () => {
          console.log("SERVER STATUS:", xhr.status);

          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            text: () => Promise.resolve(xhr.responseText),
          });
        });

        // NETWORK ERROR
        xhr.addEventListener("error", () => {
          reject(new Error("Network error while uploading the post."));
        });

        // ABORT
        xhr.addEventListener("abort", () => {
          reject(new Error("Upload was cancelled."));
        });

        xhr.send(formData);
      });

      // ----------------------------------------------------
      // READ RESPONSE SAFELY
      // ----------------------------------------------------

      const responseText = await response.text();

      console.log("SERVER RESPONSE:", responseText);

      let data;

      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        throw new Error(
          `Server returned an invalid response (${response.status}).`,
        );
      }

      console.log("CREATE POST RESPONSE:", data);

      // ----------------------------------------------------
      // SERVER ERROR
      // ----------------------------------------------------

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            `Unable to create post. Server returned ${response.status}.`,
        );
      }

      // ----------------------------------------------------
      // POST ID
      // ----------------------------------------------------

      if (!data.postId) {
        throw new Error("Post created but postId is missing.");
      }

      // ----------------------------------------------------
      // SUCCESS
      // ----------------------------------------------------

      const postUrl = `/social/post?postId=${encodeURIComponent(
        String(data.postId),
      )}`;

      console.log("POST CREATED:", data.postId);

      console.log("REDIRECTING TO:", postUrl);

      window.location.assign(postUrl);
    } catch (error) {
      console.error("CREATE SOCIAL POST ERROR:", error);

      alert(error.message || "Unable to create post.");

      // Allow another attempt.
      socialPostIsSubmitting = false;

      socialSetPostButtonState(false);
    }
  });
}

// ============================================================
// SAVED POSTS — DYNAMIC IMAGE RATIO
// ============================================================

function socialSetAverageImageRatio() {
  const mediaContainers = document.querySelectorAll(".social-post-media");

  mediaContainers.forEach((container) => {
    const images = Array.from(container.querySelectorAll(".social-post-image"));

    // 1 image = leave it as it is
    if (images.length <= 1) {
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

    container.style.setProperty("--social-average-image-ratio", averageRatio);
  });
}

// ============================================================
// RUN AFTER SAVED IMAGES LOAD
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".social-post-image").forEach((image) => {
    if (image.complete) {
      socialSetAverageImageRatio();
    } else {
      image.addEventListener("load", socialSetAverageImageRatio, {
        once: true,
      });
    }
  });
});

// ============================================================
// SOCIAL REPLY BUTTON
// ============================================================

document.addEventListener("click", (event) => {
  const button = event.target.closest(".social-reply-button");

  if (!button) {
    return;
  }

  const commentId = button.dataset.commentId;

  const parentReplyId = button.dataset.parentReplyId || null;

  socialShowReply(commentId, parentReplyId);
});
