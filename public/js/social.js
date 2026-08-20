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

  // Reply to COMMENT
  if (!parentReplyId) {
    form = document.getElementById("social-reply-" + commentId);
  }

  // Reply to REPLY
  else {
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

    // Native phone/browser share
    if (navigator.share) {
      await navigator.share({
        title: "Social Post",
        text: "Check out this post",
        url: data.url,
      });
    }

    // Clipboard fallback
    else if (navigator.clipboard) {
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
    // User closed native share dialog
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
// FILES + INDIVIDUAL MEDIA TEXT
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

const socialPostCreateForm = socialPostCreateComposer?.closest("form");

// ============================================================
// ATTACHMENTS
//
// Every attachment is:
//
// {
//   file: File,
//   mediaText: ""
// }
// ============================================================

let socialPostAttachments = [];

// ============================================================
// ADD ATTACHMENT
// ============================================================

function socialAddPostAttachment(file) {
  if (!file) {
    return false;
  }

  // Maximum 10 files
  if (socialPostAttachments.length >= 10) {
    alert("You can upload a maximum of 10 files.");

    return false;
  }

  // Maximum 10 MB per file
  if (file.size > 10 * 1024 * 1024) {
    alert(`${file.name} must be 10 MB or smaller.`);

    return false;
  }

  // Allowed MIME types
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ];

  if (!allowedTypes.includes(file.type)) {
    alert("Only JPG, PNG, WebP, GIF, and PDF files are allowed.");

    return false;
  }

  // Add file with its own media text
  socialPostAttachments.push({
    file: file,
    mediaText: "",
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

    for (const file of files) {
      if (socialPostAttachments.length >= 10) {
        alert("You can upload a maximum of 10 files.");

        break;
      }

      socialAddPostAttachment(file);
    }

    // Clear the real file input.
    //
    // Files are now stored in
    // socialPostAttachments.
    //
    // This also allows the user to
    // select the same file again.
    socialPostFilesInput.value = "";
  });
}

// ============================================================
// PASTE IMAGE
// ============================================================

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

      // Do not allow the browser to paste the image
      // into the contenteditable area.
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

      const objectUrl = URL.createObjectURL(attachment.file);

      image.src = objectUrl;

      image.alt = attachment.file.name;

      image.className = "social-post-create-pasted-image";

      image.dataset.objectUrl = objectUrl;

      wrapper.appendChild(image);
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
    // INDIVIDUAL TEXT FIELD
    // ------------------------------------------------------
    //
    // THIS BELONGS TO THIS FILE ONLY
    //
    // image 0 → mediaText 0
    // image 1 → mediaText 1
    // image 2 → mediaText 2
    // ------------------------------------------------------

    const mediaText = document.createElement("textarea");

    mediaText.className = "social-post-media-text";

    mediaText.name = "media_text";

    mediaText.placeholder = "Add text for this image or file...";

    mediaText.value = attachment.mediaText;

    mediaText.maxLength = 5000;

    mediaText.addEventListener("input", () => {
      socialPostAttachments[index].mediaText = mediaText.value;
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
      // Release image object URL
      const image = wrapper.querySelector("img[data-object-url]");

      if (image) {
        URL.revokeObjectURL(image.dataset.objectUrl);
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
// SUBMIT SOCIAL POST
// ============================================================

if (socialPostCreateForm) {
  socialPostCreateForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // ------------------------------------------------------
    // MAIN POST CONTENT
    // ------------------------------------------------------

    const content = socialPostCreateComposer?.innerText.trim() || "";

    if (socialPostCreateContent) {
      socialPostCreateContent.value = content;
    }

    // ------------------------------------------------------
    // CHECK EMPTY POST
    // ------------------------------------------------------

    if (!content && socialPostAttachments.length === 0) {
      return;
    }

    // ------------------------------------------------------
    // MAX POST CONTENT
    // ------------------------------------------------------

    if (content.length > 5000) {
      alert("Your post is too long. Please keep it under 5000 characters.");

      return;
    }

    // ------------------------------------------------------
    // FORM DATA
    // ------------------------------------------------------

    const formData = new FormData();

    // ------------------------------------------------------
    // MAIN CONTENT
    // ------------------------------------------------------

    formData.append("content", content);

    // ------------------------------------------------------
    // VISIBILITY
    // ------------------------------------------------------

    const visibility = socialPostCreateForm.querySelector(
      'input[name="visibility"]:checked',
    );

    formData.append("visibility", visibility?.value || "everyone");

    // ------------------------------------------------------
    // FILES + INDIVIDUAL MEDIA TEXT
    // ------------------------------------------------------
    //
    // IMPORTANT:
    //
    // files[0]      ↔ media_text[0]
    // files[1]      ↔ media_text[1]
    // files[2]      ↔ media_text[2]
    //
    // Multer receives the files.
    // Express receives media_text.
    // ------------------------------------------------------

    socialPostAttachments.forEach((attachment) => {
      formData.append("files", attachment.file, attachment.file.name);

      formData.append("media_text", attachment.mediaText || "");
    });

    // ------------------------------------------------------
    // SEND TO EXPRESS
    // ------------------------------------------------------
    try {
      const response = await fetch(socialPostCreateForm.action, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      console.log("CREATE POST RESPONSE:", data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to create post.");
      }

      if (!data.postId) {
        throw new Error("Post created but postId is missing.");
      }

      const postUrl = `/social/post?postId=${encodeURIComponent(String(data.postId))}`;

      console.log("REDIRECTING TO:", postUrl);

      window.location.assign(postUrl);
    } catch (error) {
      console.error("Create social post error:", error);

      alert(error.message || "Unable to create post.");
    }
  });
}
//

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
//
document.addEventListener("click", (event) => {
  const button = event.target.closest(".social-reply-button");

  if (!button) return;

  const commentId = button.dataset.commentId;
  const parentReplyId = button.dataset.parentReplyId || null;

  socialShowReply(commentId, parentReplyId);
});
//
