// ========== НАСТРОЙКИ ==========
const SUPABASE_URL = 'https://dwfapqhigqabentacdnw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xpzny5LK3MiVYMS7XBIZoQ_Yt7fiS8p';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== ОБЩЕЕ СОСТОЯНИЕ ПРИЛОЖЕНИЯ ==========
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
    groupEnabled: localStorage.getItem('files-group-enabled') !== '0',
  },
  schedule: {
    even: {},
    odd: {},
  },
};

// ========== ИМЕНА ПОЛЬЗОВАТЕЛЕЙ ==========
const USER_NAMES = {
  'user01': 'Мария',
  'user02': 'Вера',
  'user03': 'Анастасия',
  'user04': 'Елизавета',
  'user05': 'Ксения',
};

function displayName(login) {
  if (!login) return '';
  return USER_NAMES[login] || login;
}