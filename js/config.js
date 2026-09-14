// ================== SUPABASE ==================
const SUPABASE_URL = 'https://dwfapqhigqabentacdnw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xpzny5LK3MiVYMS7XBIZoQ_Yt7fiS8p';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ================== СОСТОЯНИЕ ПРИЛОЖЕНИЯ ==================
const state = {
  currentUser: null,
  currentUserId: null,
  hwRealtimeChannel: null,
  weekOffset: 0,
  currentView: 'even',
  previousScheduleView: null,
  mobileDate: null,
  avatar: {
    currentAvatarUrl: null,
    objectUrl: null,
    timer: null,
  },
  hw: {
    items: [],
    loading: false,
    expandedSubjects: new Set(),
  },
  files: {
    items: [],
    loading: false,
    expandedSubjects: new Set(
      JSON.parse(localStorage.getItem('files-expanded-subjects') || '[]')
    ),
    searchQuery: '',
    groupMode: localStorage.getItem('files-group-mode') || 'subject',
  },
  schedule: {
    even: {},
    odd: {},
  },
};
