import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, validateTransaction, calculateStock } from './core.js';

test('summarize separates barber and mobile revenue and subtracts expenses and cost of goods', () => {
  const rows = [
    {type:'income', section:'barber', amount:500, cost:0},
    {type:'income', section:'mobile', amount:900, cost:600},
    {type:'expense', section:'general', amount:100, cost:0}
  ];
  assert.deepEqual(summarize(rows), {barberRevenue:500,mobileRevenue:900,expenses:100,costOfGoods:600,totalRevenue:1400,netProfit:700});
});

test('validateTransaction rejects missing or non-positive amounts', () => {
  assert.equal(validateTransaction({type:'income',amount:0}), 'مبلغ باید بیشتر از صفر باشد.');
  assert.equal(validateTransaction({type:'income',amount:10}), 'بخش فعالیت را انتخاب کنید.');
  assert.equal(validateTransaction({type:'income',amount:10,section:'barber'}), null);
});

test('calculateStock uses stock-in minus stock-out', () => {
  assert.equal(calculateStock([{type:'in',quantity:10},{type:'out',quantity:3}]), 7);
});

test('normalizeProfile keeps editable public contact fields with safe defaults', async () => {
  const { normalizeProfile } = await import('./core.js');
  assert.deepEqual(normalizeProfile({ name: 'Tavaana', phone: '', email: '' }), {
    name: 'Tavaana', phone: '', email: '', title: 'مدیر کسب‌وکار', address: ''
  });
});

test('normalizeTheme only accepts supported accent colors', async () => {
  const { normalizeTheme } = await import('./core.js');
  assert.equal(normalizeTheme('blue'), 'blue');
  assert.equal(normalizeTheme('unknown'), 'green');
});
