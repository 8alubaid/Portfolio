# img/

`my-photo.jpg` is the hero avatar headshot, referenced directly by `index.html`. To swap in a
new photo, replace it with another image at the same filename (square framing works best — the
avatar circle center-crops via `object-fit: cover`). If this file is ever missing, the hero
avatar gracefully falls back to an "FB" monogram instead of breaking.
