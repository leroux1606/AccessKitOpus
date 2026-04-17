import type { EffortLevel } from "@prisma/client";

type FixEntry = {
  fix: string;
  effort: EffortLevel;
};

const FIXES: Record<string, FixEntry> = {
  "image-alt": {
    fix: `Add a descriptive alt attribute to the image. Use alt="" for purely decorative images.

Before: <img src="photo.jpg">
After:  <img src="photo.jpg" alt="Two colleagues reviewing accessibility audit results">
Decorative: <img src="divider.svg" alt="" role="presentation">`,
    effort: "LOW",
  },
  "image-redundant-alt": {
    fix: `The alt text duplicates adjacent visible text. Use alt="" to avoid announcing the image twice.

Before: <img alt="Company logo" src="logo.png"> Company logo
After:  <img alt="" src="logo.png" role="presentation"> Company logo`,
    effort: "LOW",
  },
  label: {
    fix: `Associate a visible label with every form control using the for/id pair, or wrap the control in a <label>.

Before: <input type="text" id="email" placeholder="Email">
After:  <label for="email">Email address</label>
        <input type="text" id="email" placeholder="name@example.com">`,
    effort: "LOW",
  },
  "label-title-only": {
    fix: `Replace title-only labeling with a visible <label>. The title attribute is not reliably announced.

Before: <input title="Search">
After:  <label for="search">Search</label><input id="search">`,
    effort: "LOW",
  },
  "label-content-name-mismatch": {
    fix: `Ensure the accessible name of the interactive element matches (or starts with) its visible label text.`,
    effort: "LOW",
  },
  "color-contrast": {
    fix: `Ensure text has a contrast ratio of at least 4.5:1 (3:1 for large text ≥18pt or ≥14pt bold).
Use a contrast checker at https://webaim.org/resources/contrastchecker/ to verify.

Common fix: darken the text color or lighten the background.
Example: change color: #999 on white to color: #767676 (minimum AA compliant).`,
    effort: "MEDIUM",
  },
  "color-contrast-enhanced": {
    fix: `Enhanced contrast (WCAG AAA) requires 7:1 for normal text, 4.5:1 for large text.`,
    effort: "MEDIUM",
  },
  "link-name": {
    fix: `Add descriptive text to the link so screen reader users know its destination.

Before: <a href="/report"><img src="pdf.svg"></a>
After:  <a href="/report"><img src="pdf.svg" alt="Download accessibility report (PDF)"></a>
Or:     <a href="/report" aria-label="Download accessibility report">...</a>`,
    effort: "LOW",
  },
  "button-name": {
    fix: `Add visible text content or an aria-label to the button.

Before: <button><svg>...</svg></button>
After:  <button><svg aria-hidden="true">...</svg> Save changes</button>
Or:     <button aria-label="Close dialog"><svg aria-hidden="true">...</svg></button>`,
    effort: "LOW",
  },
  "document-title": {
    fix: `Add a descriptive <title> element inside <head>. Use the format "Page Name | Site Name".

After: <title>Accessibility Report — AccessKit</title>`,
    effort: "LOW",
  },
  "html-has-lang": {
    fix: `Add a lang attribute to the <html> element.

After: <html lang="en">`,
    effort: "LOW",
  },
  "html-lang-valid": {
    fix: `Use a valid BCP 47 language tag. Common values: en, fr, de, es, ja, zh, ar.

Before: <html lang="english">
After:  <html lang="en">`,
    effort: "LOW",
  },
  "landmark-one-main": {
    fix: `Wrap your primary page content in a <main> landmark element.

After: <main id="main-content">...page content...</main>`,
    effort: "LOW",
  },
  "region": {
    fix: `Ensure all page content is contained within a landmark region (main, nav, header, footer, aside, section with aria-label).

Wrap orphaned content: <main>...content...</main>`,
    effort: "MEDIUM",
  },
  "heading-order": {
    fix: `Fix the heading hierarchy so levels are not skipped. Start with h1, then h2, then h3.

Before: <h1>Page title</h1> ... <h3>Section</h3>
After:  <h1>Page title</h1> ... <h2>Section</h2>`,
    effort: "MEDIUM",
  },
  "page-has-heading-one": {
    fix: `Every page should have exactly one <h1> describing its main topic.

After: <h1>Accessibility Dashboard</h1>`,
    effort: "LOW",
  },
  list: {
    fix: `Ensure list markup is correct: <ul> and <ol> must contain only <li> elements (and <script>/<template>).

Before: <ul><div>Item</div></ul>
After:  <ul><li>Item</li></ul>`,
    effort: "LOW",
  },
  listitem: {
    fix: `<li> elements must be direct children of <ul> or <ol>.

Before: <div><li>Item</li></div>
After:  <ul><li>Item</li></ul>`,
    effort: "LOW",
  },
  "aria-required-attr": {
    fix: `Add the required ARIA attributes for the element's role. Check https://www.w3.org/TR/wai-aria/ for required attributes per role.

Example for role="combobox": add aria-expanded and aria-controls.`,
    effort: "LOW",
  },
  "aria-required-children": {
    fix: `Elements with certain ARIA roles require specific child roles. Ensure the required owned elements are present.

Example: role="list" requires children with role="listitem".`,
    effort: "MEDIUM",
  },
  "aria-required-parent": {
    fix: `This element's role requires it to be contained within a specific parent role.

Example: role="listitem" must be inside role="list" or a <ul>/<ol>.`,
    effort: "LOW",
  },
  "aria-valid-attr": {
    fix: `Remove ARIA attributes that are not valid. Check https://www.w3.org/TR/wai-aria/ for valid attributes.

Common mistake: aria-labeledby (typo) → aria-labelledby (correct)`,
    effort: "LOW",
  },
  "aria-valid-attr-value": {
    fix: `Ensure the ARIA attribute value is valid for that attribute type.

Example: aria-expanded must be "true" or "false", not "yes".`,
    effort: "LOW",
  },
  "aria-allowed-attr": {
    fix: `Remove ARIA attributes not allowed for the element's current role.

Example: aria-checked is not valid on an element with role="button".`,
    effort: "LOW",
  },
  "aria-hidden-focus": {
    fix: `Do not use aria-hidden on elements that are or contain focusable elements.

Before: <div aria-hidden="true"><button>Close</button></div>
After:  Remove aria-hidden, or add tabindex="-1" and inert to prevent focus.`,
    effort: "MEDIUM",
  },
  "aria-hidden-body": {
    fix: `Remove aria-hidden from the <body> element. This hides all content from assistive technologies.`,
    effort: "LOW",
  },
  "aria-roles": {
    fix: `Use a valid WAI-ARIA role. Check https://www.w3.org/TR/wai-aria/#role_definitions for valid roles.

Common mistake: role="button " (trailing space) → role="button"`,
    effort: "LOW",
  },
  "keyboard": {
    fix: `Ensure all interactive functionality is operable via keyboard alone.
- All controls must be focusable (tabindex="0" for custom elements)
- Enter/Space must activate buttons; Enter must follow links
- Escape should close modals/menus`,
    effort: "HIGH",
  },
  "focus-trap": {
    fix: `Modal dialogs must trap focus within them while open. Use a focus trap library or implement manually.

Resources: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/`,
    effort: "HIGH",
  },
  "scrollable-region-focusable": {
    fix: `Make scrollable regions keyboard accessible by adding tabindex="0".

Before: <div style="overflow:auto">...long content...</div>
After:  <div style="overflow:auto" tabindex="0" role="region" aria-label="Results list">...long content...</div>`,
    effort: "LOW",
  },
  "tabindex": {
    fix: `Do not use positive tabindex values (tabindex="1", "2", etc.). They disrupt the natural tab order.

Use tabindex="0" to include an element in tab order, tabindex="-1" to allow programmatic focus only.`,
    effort: "LOW",
  },
  "skip-link": {
    fix: `Add a "Skip to main content" link as the first interactive element on the page.

<a class="skip-link" href="#main-content">Skip to main content</a>
<main id="main-content">...

CSS: .skip-link { position: absolute; transform: translateY(-100%); }
     .skip-link:focus { transform: translateY(0); }`,
    effort: "LOW",
  },
  "meta-viewport": {
    fix: `Do not disable user scaling in the viewport meta tag. Remove user-scalable=no or maximum-scale=1.

Before: <meta name="viewport" content="width=device-width, user-scalable=no">
After:  <meta name="viewport" content="width=device-width, initial-scale=1">`,
    effort: "LOW",
  },
  "meta-refresh": {
    fix: `Do not use auto-refreshing meta tags. They can disorient users relying on assistive technology.

Before: <meta http-equiv="refresh" content="30">
After:  Remove or replace with a user-controlled refresh button.`,
    effort: "MEDIUM",
  },
  "td-headers-attr": {
    fix: `Ensure all IDs referenced in td headers attributes exist in the table.

Before: <td headers="col1 col2">Data</td>  <!-- col2 doesn't exist -->
After:  Add <th id="col2"> or remove the non-existent ID from headers.`,
    effort: "LOW",
  },
  "th-has-data-cells": {
    fix: `Table header cells (<th>) must correspond to data cells. Use scope attribute to clarify.

<th scope="col">Name</th>  <!-- column header -->
<th scope="row">Item 1</th>  <!-- row header -->`,
    effort: "LOW",
  },
  "table-duplicate-name": {
    fix: `The table caption and summary contain the same text. Remove one or make them complementary.`,
    effort: "LOW",
  },
  "frame-title": {
    fix: `Add a title attribute to every <iframe> describing its content.

Before: <iframe src="map.html"></iframe>
After:  <iframe src="map.html" title="Office location map"></iframe>`,
    effort: "LOW",
  },
  "frame-focusable-content": {
    fix: `If an iframe contains focusable elements, the iframe itself must not have tabindex="-1".`,
    effort: "LOW",
  },
  "input-image-alt": {
    fix: `Add an alt attribute to <input type="image"> describing the button's action.

Before: <input type="image" src="search.png">
After:  <input type="image" src="search.png" alt="Search">`,
    effort: "LOW",
  },
  "select-name": {
    fix: `Associate a visible label with the <select> element.

Before: <select id="lang"><option>English</option></select>
After:  <label for="lang">Language</label>
        <select id="lang"><option>English</option></select>`,
    effort: "LOW",
  },
  "object-alt": {
    fix: `Provide alternative text for <object> elements.

Before: <object data="chart.swf"></object>
After:  <object data="chart.swf">Bar chart showing sales by quarter: Q1: 40%, Q2: 35%...</object>`,
    effort: "MEDIUM",
  },
  "video-caption": {
    fix: `Add closed captions to all video content with audio.

Use a <track> element with kind="captions":
<video controls>
  <source src="video.mp4">
  <track kind="captions" src="captions.vtt" srclang="en" label="English">
</video>`,
    effort: "HIGH",
  },
  "audio-caption": {
    fix: `Provide captions or a transcript for all audio content.

Use a <track> element or provide a linked transcript below the audio player.`,
    effort: "HIGH",
  },
  "definition-list": {
    fix: `Fix definition list markup: <dl> must contain <dt> and <dd> pairs, not arbitrary elements.

Before: <dl><li>Term</li></dl>
After:  <dl><dt>Term</dt><dd>Definition</dd></dl>`,
    effort: "LOW",
  },
  "dlitem": {
    fix: `<dt> and <dd> elements must be direct children of <dl>.`,
    effort: "LOW",
  },
  "form-field-multiple-labels": {
    fix: `Each form field should have only one label. Remove duplicate labels or merge them.`,
    effort: "LOW",
  },
  "autocomplete-valid": {
    fix: `Use a valid autocomplete attribute value. See https://html.spec.whatwg.org/#autofill for valid values.

Common examples:
- autocomplete="name" for full name
- autocomplete="email" for email address
- autocomplete="current-password" for password fields`,
    effort: "LOW",
  },
  "p-as-heading": {
    fix: `Do not use bold/large <p> tags as headings. Use actual <h1>–<h6> elements.

Before: <p><strong>Section Title</strong></p>
After:  <h2>Section Title</h2>`,
    effort: "LOW",
  },
  "identical-links-same-purpose": {
    fix: `Links with the same visible text should go to the same destination, or have different accessible names.

Before: Two "Read more" links going to different articles
After:  <a href="/article-1">Read more about accessibility</a>
        <a href="/article-2">Read more about WCAG</a>
Or use aria-label to differentiate.`,
    effort: "MEDIUM",
  },
  "link-in-text-block": {
    fix: `Links within blocks of text must be distinguishable from surrounding text without relying on color alone.

Add an underline: text-decoration: underline (do not remove underlines from inline links).
Or add another visual indicator (border, icon, etc.).`,
    effort: "MEDIUM",
  },
  "duplicate-id": {
    fix: `All id attributes must be unique within a page. Duplicate IDs break label associations and ARIA references.

Check your HTML for repeated id values and rename them to be unique.`,
    effort: "LOW",
  },
  "duplicate-id-active": {
    fix: `Interactive elements (buttons, inputs, links) must have unique IDs. Fix by ensuring no two active elements share the same id.`,
    effort: "LOW",
  },
  "duplicate-id-aria": {
    fix: `Elements referenced by aria-labelledby, aria-describedby, or aria-controls must have unique IDs.`,
    effort: "LOW",
  },
};

export function generateFixSuggestion(ruleId: string): string | undefined {
  return FIXES[ruleId]?.fix;
}

export function estimateEffort(ruleId: string): EffortLevel {
  return FIXES[ruleId]?.effort ?? "MEDIUM";
}
