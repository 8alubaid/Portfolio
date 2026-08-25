# resume/

Drop your exported resume here as **`faris-balubaid-resume.pdf`**.

`index.html` references it directly from both "Download Resume" buttons (hero + contact). The
buttons are hidden by default — `js/main.js` does a `HEAD` request for this file on page load
and only reveals them once it actually exists. Nothing to uncomment, no code to touch: replace
this file with the same name, and the live site picks it up on the next visit.

## Updating from Overleaf

**Simple (works today):** In Overleaf, Menu → Download PDF. Rename it to
`faris-balubaid-resume.pdf` and overwrite this file. Push/redeploy. The link on the site never
changes, so this is the only step required each time the resume is revised.

**Fully automatic (optional, no manual export ever again):** Overleaf can sync your project's
`.tex` source to a GitHub repo on every "Sync → GitHub." Add a GitHub Action to that repo (e.g.
[`xu-cheng/latex-action`](https://github.com/xu-cheng/latex-action)) that compiles the `.tex` to
PDF on every push and publishes it at a fixed URL — then point the site's `href` at that URL
instead of this local file. Editing in Overleaf and hitting sync becomes the only step; the PDF
rebuilds and republishes itself. Overleaf's GitHub sync is normally a paid feature, but it's
included free via the GitHub Student Developer Pack.
