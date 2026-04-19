<template>
  <div class="p-8 max-w-6xl mx-auto h-full flex flex-col">
    <header class="mb-8">
      <h2 class="text-3xl font-bold bg-gradient-to-r from-zinc-900 to-zinc-600 bg-clip-text text-transparent">Task History</h2>
      <p class="text-zinc-500 mt-2">View and manage your generated videos.</p>
    </header>

    <div class="flex-1 border border-zinc-200 bg-white rounded-2xl overflow-hidden shadow-sm">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-zinc-50 border-b border-zinc-200">
            <th class="py-4 px-6 text-xs font-semibold tracking-wider text-zinc-500 bg-transparent uppercase">Thumbnail</th>
            <th class="py-4 px-6 text-xs font-semibold tracking-wider text-zinc-500 bg-transparent uppercase">Prompt</th>
            <th class="py-4 px-6 text-xs font-semibold tracking-wider text-zinc-500 bg-transparent uppercase">Status</th>
            <th class="py-4 px-6 text-xs font-semibold tracking-wider text-zinc-500 bg-transparent uppercase">Created</th>
            <th class="py-4 px-6 text-xs font-semibold tracking-wider text-zinc-500 bg-transparent uppercase text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <!-- Mock Item 1 -->
          <tr class="border-b border-zinc-100 hover:bg-zinc-50/80 transition-colors">
            <td class="py-4 px-6 align-middle">
              <div class="w-20 h-12 bg-zinc-100 rounded bg-cover bg-center shadow-sm" style="background-image: url('https://images.unsplash.com/photo-1549298240-0d8e60513026?auto=format&fit=crop&w=200&q=80')"></div>
            </td>
            <td class="py-4 px-6 align-middle">
              <p class="text-zinc-700 text-sm line-clamp-2 w-72">A majestic golden retriever running through a lush green valley at sunset...</p>
            </td>
            <td class="py-4 px-6 align-middle">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                COMPLETED
              </span>
            </td>
            <td class="py-4 px-6 align-middle text-zinc-400 text-sm">Oct 24, 2023</td>
            <td class="py-4 px-6 align-middle text-right">
              <button class="px-3 py-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors text-sm font-medium inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                Download
              </button>
            </td>
          </tr>
          
          <!-- Mock Item 2 -->
          <tr class="border-b border-zinc-100 hover:bg-zinc-50/80 transition-colors">
            <td class="py-4 px-6 align-middle">
              <div class="w-20 h-12 bg-zinc-50 rounded flex items-center justify-center border border-zinc-100 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" x2="7" y1="2" y2="22"/><line x1="17" x2="17" y1="2" y2="22"/><line x1="2" x2="22" y1="12" y2="12"/><line x1="2" x2="7" y1="7" y2="7"/><line x1="2" x2="7" y1="17" y2="17"/><line x1="17" x2="22" y1="17" y2="17"/><line x1="17" x2="22" y1="7" y2="7"/></svg>
              </div>
            </td>
            <td class="py-4 px-6 align-middle">
              <p class="text-zinc-700 text-sm line-clamp-2 w-72">Cyberpunk city aerial flythrough, neon lights reflecting on wet streets...</p>
            </td>
            <td class="py-4 px-6 align-middle">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
                <svg class="animate-spin -ml-0.5 h-3 w-3 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                PROCESSING (45%)
              </span>
            </td>
            <td class="py-4 px-6 align-middle text-zinc-400 text-sm">Oct 24, 2023</td>
            <td class="py-4 px-6 align-middle text-right">
              <button disabled class="px-3 py-1.5 opacity-50 cursor-not-allowed rounded-md hover:bg-zinc-100 text-zinc-400 transition-colors text-sm font-medium inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                Cancel
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
