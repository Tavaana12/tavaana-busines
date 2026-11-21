export function summarize(rows = []) {
  const result = { barberRevenue:0, mobileRevenue:0, expenses:0, costOfGoods:0, totalRevenue:0, netProfit:0 };
  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    if (row.type === 'income') {
      result.totalRevenue += amount;
      if (row.section === 'barber') result.barberRevenue += amount;
      if (row.section === 'mobile') {
        result.mobileRevenue += amount;
        result.costOfGoods += Number(row.cost) || 0;
      }
    } else if (row.type === 'expense') result.expenses += amount;
  }
  result.netProfit = result.totalRevenue - result.expenses - result.costOfGoods;
  return result;
}

export function validateTransaction(row) {
  if (!Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0) return 'مبلغ باید بیشتر از صفر باشد.';
  if (!row.section) return 'بخش فعالیت را انتخاب کنید.';
  if (row.type === 'income' && !['barber','mobile','other'].includes(row.section)) return 'بخش درآمد معتبر نیست.';
  if (row.type === 'expense' && !['general','barber','mobile'].includes(row.section)) return 'بخش هزینه معتبر نیست.';
  return null;
}

export function calculateStock(movements = []) {
  return movements.reduce((sum, item) => sum + (item.type === 'in' ? Number(item.quantity) : -Number(item.quantity)), 0);
}

export function normalizeProfile(profile = {}) {
  return {
    name: String(profile.name || 'Mohammad Ali Tavaana').trim(),
    phone: String(profile.phone || '').trim(),
    email: String(profile.email || '').trim(),
    title: String(profile.title || 'مدیر کسب‌وکار').trim(),
    address: String(profile.address || '').trim()
  };
}

export function normalizeTheme(theme) {
  return ['green', 'blue', 'purple', 'orange'].includes(theme) ? theme : 'green';
}
