// Browser entry for the prerendered static homepage: its stylesheet plus the
// small vanilla enhancer. No React, no Supabase client — the page is already
// rendered, this only wires up the toggle, the form and the reveals.
import './marketing.css'
import { enhance } from './enhance.js'

enhance(document.querySelector('.mk'))
