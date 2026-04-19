<template>
  <div class="flex flex-col h-screen w-full overflow-hidden bg-[#0c0c0e] text-zinc-300">
    <!-- Header -->
    <header class="w-full h-[52px] border-b border-[#222225] bg-[#141417]/80 backdrop-blur-xl flex items-center justify-between px-4 shadow-sm shrink-0 z-10 relative">
      <div class="flex items-center gap-3">
        <div class="w-7 h-7 rounded bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20"></div>
        <h1 class="text-base font-bold tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">Cinecho 1.0</h1>
      </div>
      <div class="text-[10px] uppercase font-bold tracking-wider text-zinc-500 flex items-center gap-2 bg-[#1a1a1d]/80 px-2.5 py-1 rounded border border-[#2a2a30] shadow-inner">
        <span>Engine</span>
        <span class="flex h-1.5 w-1.5 relative">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
        </span>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 relative overflow-hidden z-0 bg-[#0c0c0e]">
      <!-- Background pattern layers -->
      <div class="absolute inset-0 bg-grid-zinc-800/10 [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none"></div>
      <div class="absolute inset-0 bg-gradient-to-br from-transparent via-[#0c0c0e]/40 to-black/30 pointer-events-none"></div>
      
      <!-- Content wrapper -->
      <div class="relative h-full overflow-auto">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>

    <!-- Bottom Navigation -->
    <nav class="w-full border-t border-[#222225] bg-[#141417]/80 backdrop-blur-xl flex items-center justify-around px-2 py-1.5 shadow-[0_-4px_15px_-1px_rgba(0,0,0,0.4)] shrink-0 z-10 relative">
      <router-link to="/assets" class="flex flex-col items-center gap-1 p-2 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-[#1a1a1d]/80 transition-all duration-200 min-w-[4rem]" active-class="text-blue-400 bg-blue-500/10 shadow-sm border border-blue-500/20">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 22H4a2 2 0 0 1-2-2V6"/><path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18"/><circle cx="12" cy="8" r="2"/><rect width="16" height="16" x="6" y="2" rx="2"/></svg>
        <span class="font-medium text-[9px] uppercase tracking-wider">Library</span>
      </router-link>
      <router-link to="/" class="flex flex-col items-center gap-1 p-2 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-[#1a1a1d]/80 transition-all duration-200 min-w-[4rem]" active-class="text-blue-400 bg-blue-500/10 shadow-sm border border-blue-500/20">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span class="font-medium text-[9px] uppercase tracking-wider">创作 Creation</span>
      </router-link>
      <router-link to="/stitch" class="flex flex-col items-center gap-1 p-2 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-[#1a1a1d]/80 transition-all duration-200 min-w-[4rem]" active-class="text-blue-400 bg-blue-500/10 shadow-sm border border-blue-500/20">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg>
        <span class="font-medium text-[9px] uppercase tracking-wider">拼接 Stitch</span>
      </router-link>
      <router-link to="/settings" class="flex flex-col items-center gap-1 p-2 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-[#1a1a1d]/80 transition-all duration-200 min-w-[4rem]" active-class="text-blue-400 bg-blue-500/10 shadow-sm border border-blue-500/20">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        <span class="font-medium text-[9px] uppercase tracking-wider">Settings</span>
      </router-link>
    </nav>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
