import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import History from '../views/History.vue'
import Assets from '../views/Assets.vue'
import Storyboard from '../views/Storyboard.vue'
import Stitch from '../views/Stitch.vue'
import Settings from '../views/Settings.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/history', component: History },
    { path: '/assets', component: Assets },
    { path: '/storyboard', component: Storyboard },
    { path: '/stitch', component: Stitch },
    { path: '/settings', component: Settings }
  ]
})

export default router
