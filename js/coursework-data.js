/* ══════════════════════════════════════════════════════════════
   COURSEWORK DATA — the one file you edit to add a project to
   coursework.html. Nothing else needs touching.

   categories: each one becomes a "drawer" in the cabinet. A drawer only
     appears once at least one project is filed in it, so you can list
     categories here before you have anything for them.
   projects: shown in this order (newest-first reads best).

   A project:
     {
       title:    'Name of the project',            // required
       category: 'electronics',                    // required — one of the ids below
       summary:  'One or two sentences.',          // required
       tags:     ['Altium Designer', 'PCB Design'],// optional
       course:   'ECEN 4610',                      // optional — shown under the title
       term:     'Fall 2025',                      // optional
       page:     'project-3.html',                 // optional — a write-up page in this site
       github:   'https://github.com/8alubaid/…',  // optional — must be under github.com/8alubaid/
     }
   ══════════════════════════════════════════════════════════════ */
window.COURSEWORK = {
  categories: [
    { id: 'electronics', name: 'Electronics & PCB',    blurb: 'Circuit design, board layout, bench validation' },
    { id: 'embedded',    name: 'Embedded & Arduino',   blurb: 'Microcontrollers, sensors, firmware' },
    { id: 'software',    name: 'Software & Web',       blurb: 'Full-stack apps, databases, containers' },
    { id: 'systems',     name: 'Systems & Networking', blurb: 'Linux administration, networks, operating systems' },
  ],

  projects: [
    {
      title: 'Golden Arduino PCB',
      category: 'electronics',
      summary: 'A custom Arduino-compatible board designed in Altium with USB programming and Uno R3 shield compatibility, laid out for signal integrity and benchmarked against a commercial Arduino with an oscilloscope.',
      tags: ['Altium Designer', 'PCB Design'],
      page: 'project-3.html',
    },
    {
      title: 'DemoSat RadTest',
      category: 'embedded',
      summary: 'An Arduino shield PCB prototype and sensor-integration work for the Colorado Space Grant high-altitude balloon payload, sponsored by NASA: hardware validation, data-acquisition firmware, system testing and radiation-protection recommendations.',
      tags: ['Hardware Sensor Integration', 'C++ Programming'],
      page: 'project-1.html',
    },
    {
      title: 'Dockerized Message Board',
      category: 'software',
      summary: 'A full-stack forum built as a team: Express.js routes for authentication, boards and posts, PostgreSQL for users and comments, bcrypt hashing with sessions, all containerized with Docker Compose.',
      tags: ['Node.js', 'PostgreSQL', 'Docker'],
      page: 'project-2.html',
    },
  ],
};
