import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
    { path: '/', component: () => import('./views/MapView.vue') },
    { path: '/trips', component: () => import('./views/TripsView.vue') },
    { path: '/trips/new', component: () => import('./views/TripsView.vue') }, // 移动端整页发起 / 桌面弹窗
    { path: '/trip/:id', component: () => import('./views/TripDetailView.vue') },
    { path: '/profile', component: () => import('./views/ProfileView.vue') },
    { path: '/admin', component: () => import('./views/AdminView.vue') },
    { path: '/guestbook', component: () => import('./views/GuestbookView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

export default router;
