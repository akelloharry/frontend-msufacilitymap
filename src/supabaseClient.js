import { createClient } from '@supabase/supabase-js'

// Try Vite env first, then fall back to runtime globals (set on window).
// If neither is present, use explicit placeholders so you can temporarily
// hardcode your Supabase project values for testing on GitHub Pages.
// NOTE: temporarily using the values you provided for quick testing on gh-pages.
// Replace or remove these hardcoded values once testing is complete.
const url = import.meta.env.VITE_SUPABASE_URL || (typeof window !== 'undefined' && window.SUPABASE_URL) || 'https://zwqfyyxolnaauvagcvds.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (typeof window !== 'undefined' && window.SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cWZ5eXhvbG5hYXV2YWdjdmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTU2MzgsImV4cCI6MjA4OTgzMTYzOH0.S9qNAO3UJgWP_LUyTDfwQMqcAmPScjSHi_MNFL47kcE'

// IMPORTANT: Replace the placeholder strings above with your actual
// Supabase project URL and anon key for the site to load data.
export const supabase = (url && anonKey && !url.startsWith('https://REPLACE')) ? createClient(url, anonKey) : null

export default supabase
