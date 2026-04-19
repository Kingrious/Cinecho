# Cinecho-demo Frontend Coding Guidelines

This document outlines the standard coding conventions, architectural decisions, and technology stack for the Cinecho-demo frontend application (`src/renderer`). It is designed to act as a definitive guide for AI agents and human developers alike.

## 1. Technology Stack

- **Core Framework**: Vue 3 (using the Composition API exclusively)
- **Language**: TypeScript (`.ts`, `.vue` files)
- **Styling**: Tailwind CSS (Utility-first styling approach)
- **Routing**: Vue Router
- **Icons**: `lucide-vue-next`
- **Build Tool**: `electron-vite` (Vite)
- **Desktop Wrapper**: Electron

## 2. Directory Structure

The frontend application code is located in `src/renderer/src`:

```
src/renderer/src
├── api/          # IPC wrappers and HTTP request handling
├── assets/       # Static assets and global CSS (index.css)
├── components/   # Reusable low-level Vue components (buttons, modals, inputs)
├── composables/  # Vue 3 reactive composables (React-like hooks)
├── layouts/      # High-level layout wrappers
├── router/       # Vue Router configuration
├── store/        # State management (if Pinia is introduced)
├── types/        # Global TypeScript interfaces and types
├── utils/        # Pure helper functions
├── views/        # Page-level route components
├── App.vue       # Root application component
└── main.ts       # Application entry point
```

## 3. Vue Component Standards

### Script Setup & Composition API
ALL new Vue components MUST use the script setup syntax with TypeScript:
```html
<script setup lang="ts">
import { ref, computed } from 'vue'
// Component logic goes here...
</script>
```
- Avoid using the Options API (`export default { data() {} }`).
- Treat props and emits clearly using `defineProps` and `defineEmits`.

### State Management
- For local state: Use `ref()` and `reactive()`.
- For reusable logic: Extract into functions under the `src/composables/` directory naming it `use[Feature].ts`.

## 4. UI & Styling Guidelines (Tailwind CSS)

### Pure Tailwind Approach
- Use Tailwind CSS utility classes directly in the `<template>` for all styling elements.
- **Do not** write custom CSS or use `<style scoped>` unless absolutely necessary (e.g., for specific generic Vue transition animations like `fade-enter-active`).

### Color Palette & Design Language (Light Theme)
The application uses a modern, premium **Light Theme**:
- **Backgrounds**: Use clean, bright backgrounds (`bg-zinc-50`, `bg-stone-50`, `bg-white`).
- **Text content**: Rely on high-contrast text constraints (`text-zinc-950`, `text-zinc-900` for titles; `text-zinc-600`, `text-zinc-500` for subtext).
- **Accents & Gradients**: Use `purple`, `indigo`, and `emerald` for action elements and statuses. Embellish headings using text gradients (`bg-gradient-to-r from-zinc-900 to-zinc-600`).
- **Surface Depth**: Use transparent overlays (`bg-white/80`, `backdrop-blur-xl`), soft borders (`border-zinc-200`), and shadows (`shadow-sm`, `shadow-lg`) for depth.
- **Micro-interactions**: Incorporate subtle hover transitions and transformations (`group-hover:text-purple-600`, `hover:shadow-xl`, `transition-all duration-200`).

### Icons
- Use SVGs directly when copying tailored design elements OR utilize `lucide-vue-next` for standardized UI icons.

## 5. Electron Integration & IPC

The Vue renderer must NEVER communicate directly with native Node.js APIs or the main process outside of predefined preload bridges.
- **Preload Isolation**: All IPC communications (`ipcRenderer.invoke`, `.send`, etc.) must be defined in the preload script (`src/preload/index.ts`).
- **API Wrapping**: Consume exposed preload APIs logically through wrapper functions in `src/renderer/src/api/` rather than calling `window.electron` directly inside components over and over.

## 6. TypeScript Best Practices

- Provide strict types for component props.
- Avoid the use of `any`. Create proper data interfaces in `src/renderer/src/types/` for repeated domain objects.
- Ensure all methods have predictable return types and variable signatures.

## 7. Command References

- **Start Dev Server**: `npm run dev`
- **Build App**: `npm run build`
- **Lint Codebase**: `npm run lint` (ESLint is configured to parse Vue & TS)
