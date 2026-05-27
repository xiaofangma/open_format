# CLAUDE.md

## Overview

React/TypeScript web app for converting Markdown to Xiaohongshu (小红书) long-images or WeChat article format. Deployed to GitHub Pages.

## Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — TypeScript type-check + Vite build → `dist/`
- `npm run lint` — ESLint
- `npm run preview` — Vite preview server

## Stack

- React 19, Vite 8, Tailwind CSS 4, TypeScript 6
- Key deps: `react-markdown`, `remark-gfm`, `rehype-raw`, `html-to-image`, `lucide-react`

## Project Structure

- `src/main.tsx` — Entry point, renders `<App />` into `#root`
- `src/App.tsx` — Main component: split-pane UI with Markdown editor (left) and preview tabs (right: Xiaohongshu / WeChat)
- Features: file import, drag-and-drop image embedding (base64), AI image prompt generation, author info for Xiaohongshu, download images, copy rich text for WeChat

## Deployment

Auto-deploys `dist/` to GitHub Pages on push to `main` via `.github/workflows/deploy.yml`.
