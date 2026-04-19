<template>
  <div class="p-8 max-w-3xl mx-auto h-full flex flex-col">
    <header class="mb-10">
      <h2 class="text-3xl font-bold bg-gradient-to-r from-zinc-900 to-zinc-600 bg-clip-text text-transparent">Settings</h2>
      <p class="text-zinc-500 mt-2">Configure API credentials and application preferences.</p>
    </header>

    <div class="space-y-8 flex-1">
      <section class="space-y-4 bg-white border border-zinc-200 rounded-2xl p-6 relative overflow-hidden group shadow-sm">
        <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <h3 class="text-lg font-semibold text-zinc-900 flex items-center gap-2 relative z-10">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          VolcEngine API Credentials
        </h3>
        
        <div class="space-y-4 relative z-10">
          <div>
            <label class="block text-sm font-medium text-zinc-500 mb-1.5">Access Key</label>
            <input type="password" placeholder="AKLT****************" class="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 text-zinc-900 placeholder-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-mono text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-zinc-500 mb-1.5">Secret Key</label>
            <input type="password" placeholder="********************************" class="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 text-zinc-900 placeholder-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-mono text-sm" />
          </div>
        </div>
      </section>

      <section class="space-y-4 bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-zinc-900 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          Storage Configuration
        </h3>
        
        <div>
          <label class="block text-sm font-medium text-zinc-500 mb-1.5">Output Directory</label>
          <div class="flex gap-2">
            <input type="text" readonly value="D:\Cinecho\Outputs" class="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 text-zinc-600 focus:outline-none cursor-default font-mono text-sm" />
            <button class="px-4 py-2.5 bg-white hover:bg-zinc-50 text-zinc-700 rounded-lg font-medium transition-all border border-zinc-200 whitespace-nowrap shadow-sm">
              Browse
            </button>
          </div>
        </div>
      </section>

      <section class="space-y-4 bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-zinc-900 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-sky-500"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          Appearance
        </h3>
        
        <div>
          <label class="block text-sm font-medium text-zinc-500 mb-2">Theme Preference</label>
          <div class="flex gap-2">
            <button class="flex-1 py-2.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700 font-medium text-sm flex justify-center items-center gap-2 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              Dark Theme
            </button>
            <button class="flex-1 py-2.5 rounded-lg border border-zinc-200 bg-zinc-900 text-white font-medium text-sm flex justify-center items-center gap-2 disabled:opacity-100 disabled:cursor-default shadow-lg shadow-zinc-200" disabled>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              Light Theme
            </button>
          </div>
        </div>
      </section>

      <div class="pt-6 flex justify-end">
        <button class="px-6 py-2.5 rounded-lg bg-zinc-900 hover:bg-black text-white font-semibold transition-all shadow-lg shadow-zinc-200 text-sm">
          Save Changes
        </button>
      </div>
    </div>
  </div>
</template>
