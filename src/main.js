import './assets/main.css'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js' // Popper.js included

document.body.setAttribute('data-bs-theme', 'dark') // Opraveno

import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
