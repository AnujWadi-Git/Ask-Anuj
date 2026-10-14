# Adding Ask Anuj to anujwadi.com

The portfolio is a static `index.html`. Add this single line just before `</body>` (it is not applied yet):

```html
<script src="https://ask-anuj.pages.dev/embed.js" defer></script>
```

What it does / assumes about the site
* Waits for the site's own `content-loaded` body class (set after the "Welcome to my world" intro) before showing the launcher; falls back after 12 s. Override with `data-wait-for-class=""` to show immediately.
* Launcher is bottom-right, left of the existing back-to-top button; the top-right lamp-rope toggle is untouched.
* Follows the site's `body.light-mode` class for theme; uses the site's Times New Roman look.
* Lives in a Shadow DOM, so it neither inherits nor leaks CSS.
* Nothing is requested from the API, no audio is touched, and nothing is spoken until a visitor clicks the launcher.
* Make the intro mandatory: `<script ... data-intro-required="true">`.
* If you host the API on another origin: `data-api="https://..."`, and add the site origin to `allowedOrigins` in `functions/_lib/config.js`.

Rolling back = delete the line.
