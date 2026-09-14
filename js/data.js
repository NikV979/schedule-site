// ========== ЗАГРУЗКА РАСПИСАНИЯ ИЗ SUPABASE ==========
async function loadScheduleFromCloud() {
  const { data, error } = await supabaseClient
    .from('schedule')
    .select('week_type, day_key, pair_time, subject, lesson_type, teacher, room, position')
    .order('position', { ascending: true });

  if (error) {
    console.error('Ошибка загрузки расписания:', error);
    showToast('Не удалось загрузить расписание');
    return false;
  }

  state.schedule.even = {};
  state.schedule.odd = {};

  for (const row of data || []) {
    const wk = row.week_type;
    const dk = row.day_key;
    if (!state.schedule[wk][dk]) state.schedule[wk][dk] = [];
    state.schedule[wk][dk].push({
      time: row.pair_time,
      subject: row.subject,
      type: row.lesson_type,
      teacher: row.teacher || '',
      room: row.room || '',
    });
  }
  return true;
}