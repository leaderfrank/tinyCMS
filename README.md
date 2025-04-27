# tinyCMS

![Alt Text](https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnppMDhpZjVmODd0bTJmODJmN2xmamgzdmczYnp2ZjRxaDc2eWhxNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/huV07d7bkLlORl98mw/giphy.gif)

tinyCMS is a simple **offline customer management system** built with **Nuxt**, **Nuxt UI**, **SQLite (compiled to WebAssembly)** for the frontend, and **Tauri** for the desktop backend.  
It allows you to manage customers efficiently both on the web and as a native desktop app.

## Tech Stack

- [Nuxt](https://nuxt.com/)
- [Nuxt UI](https://ui.nuxt.com/)
- [Tauri](https://tauri.app/)
- SQLite (via WebAssembly)

## Prerequisites

- [Node.js](https://nodejs.org/) (latest LTS version recommended)
- [Rust](https://www.rust-lang.org/tools/install) (required for Tauri)

## Setup

Install project dependencies:

```bash
npm install
```

> You can also use `pnpm`, `yarn`, or `bun` if preferred.

## Development (Web Version)

Start the Nuxt development server:

```bash
npm run dev
```

This will launch the app at [http://localhost:3000](http://localhost:3000).

## Production (Web Version)

Build the app for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

For deployment, refer to the [Nuxt deployment documentation](https://nuxt.com/docs/getting-started/deployment).

## Tauri Desktop App Setup

To run tinyCMS as a desktop app:

1. Initialize Tauri:

```bash
npx tauri init
```

Follow the prompts to complete the setup.

2. Run the desktop app in development mode:

```bash
npx tauri dev
```

3. Build the desktop app for production:

```bash
npx tauri build
```

This will generate a native executable for your platform (e.g., `.exe`, `.dmg`, etc.).

## Learn More

- [Nuxt Documentation](https://nuxt.com/docs/getting-started/introduction)
- [Nuxt UI Documentation](https://ui.nuxt.com)
- [Tauri Documentation](https://tauri.app/v1/guides/)
