# dylenq.github.io

Personal portfolio site for Dylen Quyn, served by GitHub Pages at <https://dylenq.github.io/>.

Plain HTML, CSS and JavaScript. No build step: edit the files and push.

## Editing

- `index.html` holds every section.
- `css/style.css` starts with the color and font tokens; both light and dark themes live there.
- `js/main.js` handles the theme toggle, the copy-email button, the live GitHub star and release counts, and the interactive EQ curve in the hero.
- `assets/` holds resized screenshots copied from the project repos.

## Preview locally

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.
