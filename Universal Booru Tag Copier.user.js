// ==UserScript==
// @name         Universal Booru Tag Copier
// @namespace    http://tampermonkey.net/
// @version      1.01
// @description  Add a copy button to copy all non-meta tags from major booru sites
// @author       Zelest Carlyone
// @match        https://danbooru.donmai.us/*
// @match        https://safebooru.donmai.us/*
// @match        https://gelbooru.com/*
// @match        https://*.gelbooru.com/*
// @match        https://rule34.xxx/*
// @match        https://e621.net/*
// @match        https://e926.net/*
// @match        https://konachan.*/*
// @match        https://yande.re/*
// @match        https://*.zerochan.net/*
// @match        https://*.sankakucomplex.com/*
// @match        https://safebooru.org/*
// @match        https://booru.allthefallen.moe/*
// @grant        none
// @license      MIT
// @downloadURL https://update.sleazyfork.org/scripts/538319/Universal%20Booru%20Tag%20Copier.user.js
// @updateURL https://update.sleazyfork.org/scripts/538319/Universal%20Booru%20Tag%20Copier.meta.js
// ==/UserScript==

(function () {
    "use strict";

    function cleanTagName(tagName) {
        // List of face emoticons that should keep their underscores
        const emoticons = ["o_o", "0_0", "|_|", "._.", "^_^", ">_<", "@_@", ">_@", "+_+", "+_-", "=_=", "<o>_<o>", "<|>_<|>"];

        // If it's an emoticon, keep it as-is
        if (emoticons.includes(tagName)) {
            return tagName;
        }

        // Otherwise, replace underscores with spaces
        return tagName.replace(/_/g, " ");
    }

    // Detect which site we're on
    function detectSite() {
        const hostname = window.location.hostname.toLowerCase();

        // Danbooru family
        if (hostname.includes("danbooru") || hostname.includes("safebooru.donmai")) {
            return "danbooru";
        }
        // Gelbooru family (includes rule34.xxx, safebooru.org, etc.)
        else if (hostname.includes("gelbooru") || hostname.includes("rule34.xxx") || hostname.includes("safebooru.org")) {
            return "gelbooru";
        }
        // E621/E926 family
        else if (hostname.includes("e621") || hostname.includes("e926")) {
            return "e621";
        }
        // Moebooru family (Konachan, Yande.re, etc.)
        else if (hostname.includes("konachan") || hostname.includes("yande.re")) {
            return "moebooru";
        }
        // Sankaku family
        else if (hostname.includes("sankakucomplex")) {
            return "sankaku";
        }
        // Zerochan
        else if (hostname.includes("zerochan")) {
            return "zerochan";
        }

        return null;
    }

    // Get site-specific selectors
    function getSiteConfig(site) {
        if (site === "danbooru") {
            return {
                tagSection: "#tag-list",
                categories: [
                    { selector: "ul.general-tag-list li", name: "general" },
                    { selector: "ul.character-tag-list li", name: "character" },
                    { selector: "ul.copyright-tag-list li", name: "copyright" },
                    { selector: "ul.artist-tag-list li", name: "artist" },
                ],
                getTagName: (item) => {
                    // Try data-tag-name first
                    const dataName = item.getAttribute("data-tag-name");
                    if (dataName) return dataName;

                    // Fallback: try to get from search link
                    const searchLink = item.querySelector("a.search-tag");
                    if (searchLink) return searchLink.textContent?.trim();

                    return null;
                },
            };
        } else if (site === "gelbooru") {
            return {
                tagSection: "#tag-list, #tag-sidebar",
                categories: [
                    { selector: "li.tag-type-general", name: "general" },
                    { selector: "li.tag-type-character", name: "character" },
                    { selector: "li.tag-type-copyright", name: "copyright" },
                    { selector: "li.tag-type-artist", name: "artist" },
                ],
                getTagName: (item) => {
                    const link = item.querySelector('a[href*="tags="]');
                    return link ? link.textContent?.trim() : null;
                },
            };
        } else if (site === "e621") {
            return {
                tagSection: "#tag-list",
                categories: [
                    { selector: "ul.general-tag-list li.tag-list-item", name: "general" },
                    { selector: "ul.character-tag-list li.tag-list-item", name: "character" },
                    { selector: "ul.copyright-tag-list li.tag-list-item", name: "copyright" },
                    { selector: "ul.artist-tag-list li.tag-list-item", name: "artist" },
                ],
                getTagName: (item) => {
                    const nameAttr = item.getAttribute("data-name");
                    if (nameAttr) return nameAttr;
                    const nameSpan = item.querySelector(".tag-list-name");
                    return nameSpan ? nameSpan.textContent?.trim() : null;
                },
            };
        } else if (site === "moebooru") {
            return {
                tagSection: "#tag-sidebar",
                categories: [
                    { selector: "li.tag-type-general", name: "general" },
                    { selector: "li.tag-type-character", name: "character" },
                    { selector: "li.tag-type-copyright", name: "copyright" },
                    { selector: "li.tag-type-artist", name: "artist" },
                ],
                getTagName: (item) => {
                    const nameAttr = item.getAttribute("data-name");
                    if (nameAttr) return nameAttr;
                    const link = item.querySelector('a[href*="tags="]');
                    return link ? link.textContent?.trim() : null;
                },
            };
        } else if (site === "sankaku") {
            return {
                tagSection: "#tag-sidebar, .tag-sidebar",
                categories: [
                    { selector: 'li[class*="tag-type-general"]', name: "general" },
                    { selector: 'li[class*="tag-type-character"]', name: "character" },
                    { selector: 'li[class*="tag-type-copyright"]', name: "copyright" },
                    { selector: 'li[class*="tag-type-artist"]', name: "artist" },
                ],
                getTagName: (item) => {
                    const link = item.querySelector("a");
                    return link ? link.textContent?.trim() : null;
                },
            };
        } else if (site === "zerochan") {
            return {
                tagSection: "#tags, .tags",
                categories: [{ selector: 'a[href*="/"]', name: "general" }],
                getTagName: (item) => item.textContent?.trim(),
            };
        }

        return null;
    }

    // Wait for the page to load and add button
    function addCopyButton() {
        const site = detectSite();
        if (!site) {
            console.log("Tag Copier: Unsupported site");
            return;
        }

        console.log(`Tag Copier: Detected site: ${site}`);
        const config = getSiteConfig(site);

        console.log("Tag Copier: Looking for tag list...");

        // Try to find the tag list section
        const tagSection = document.querySelector(config.tagSection);
        if (!tagSection) {
            console.log("Tag Copier: No tag section found");
            return;
        }

        console.log("Tag Copier: Found tag section!");

        // Check if button already exists
        if (document.querySelector("#tag-copy-button")) {
            console.log("Tag Copier: Button already exists");
            return;
        }

        console.log("Tag Copier: Adding copy button...");

        // Create the copy button
        const copyButton = document.createElement("button");
        copyButton.id = "tag-copy-button";
        copyButton.innerHTML = "📋 Copy Tags";
        copyButton.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: #0073e6;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            z-index: 1000;
            font-family: sans-serif;
        `;

      // Add hover effect
      copyButton.addEventListener("mouseenter", () => {
          copyButton.style.background = "#005bb5";
      });
      copyButton.addEventListener("mouseleave", () => {
          copyButton.style.background = "#0073e6";
      });

      // Add click handler
      copyButton.addEventListener("click", () => copyTags(site));

      // Make tag section container relative positioned so button positions correctly
      tagSection.style.position = "relative";

      // Add button to the tag section
      tagSection.appendChild(copyButton);
      console.log("Tag Copier: Button added successfully!");
  }

    function copyTags(site) {
        console.log("Tag Copier: Copy button clicked!");
        const config = getSiteConfig(site);
        const tags = [];

        config.categories.forEach((category) => {
            console.log(`Tag Copier: Looking for ${category.name} tags...`);

            // Universal approach: just look for the selector and extract tags
            const tagItems = document.querySelectorAll(category.selector);
            console.log(`Tag Copier: Found ${tagItems.length} ${category.name} tags`);

            tagItems.forEach((item) => {
                const tagName = config.getTagName(item);
                if (tagName && tagName.length > 0) {
                    let cleanedTag = cleanTagName(tagName);

                    // Add "artist:" prefix for artist tags
                    if (category.name === "artist") {
                        cleanedTag = "artist:" + cleanedTag;
                    }

                    tags.push(cleanedTag);
                    console.log(`Tag Copier: Added tag: ${tagName} -> ${cleanedTag}`);
                }
            });
        });

        console.log(`Tag Copier: Total tags collected: ${tags.length}`);
        console.log("Tag Copier: Tags:", tags);

        // Join tags with commas and copy to clipboard
        const tagString = tags.join(", ");
        console.log("Tag Copier: Final tag string:", tagString);

        if (tagString.length === 0) {
            console.log("Tag Copier: No tags found to copy!");
            return;
        }

        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard
                .writeText(tagString)
                .then(() => {
                console.log("Tag Copier: Successfully copied to clipboard");
                showFeedback("✅ Copied!", "#28a745");
            })
                .catch((err) => {
                console.error("Tag Copier: Failed to copy tags:", err);
                fallbackCopy(tagString);
            });
        } else {
            console.log("Tag Copier: Using fallback copy method");
            fallbackCopy(tagString);
        }
    }

    function fallbackCopy(text) {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const result = document.execCommand("copy");
            if (result) {
                console.log("Tag Copier: Fallback copy successful");
                showFeedback("✅ Copied!", "#28a745");
            } else {
                console.log("Tag Copier: Fallback copy failed");
                showFeedback("❌ Copy failed", "#dc3545");
            }
        } catch (err) {
            console.error("Tag Copier: Fallback copy error:", err);
            showFeedback("❌ Copy failed", "#dc3545");
        }

        document.body.removeChild(textArea);
    }

    function showFeedback(message, color) {
        const button = document.querySelector("#tag-copy-button");
        if (!button) return;

        const originalText = button.innerHTML;
        const originalColor = button.style.background;

        button.innerHTML = message;
        button.style.background = color;

        setTimeout(() => {
            button.innerHTML = originalText;
            button.style.background = originalColor;
        }, 1500);
    }

    // Initialize when DOM is ready
    function initialize() {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", addCopyButton);
        } else {
            addCopyButton();
        }

        // Also run when navigating (for single-page app behavior)
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                setTimeout(addCopyButton, 500); // Small delay for content to load
            }
        }).observe(document, { subtree: true, childList: true });
    }

    // Start the script
    initialize();
})();
