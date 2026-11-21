import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSaleTotals, processSale, recordReceipt } from './core-v3.js';

test('sale totals calculate revenue, cost of goods and net margin after discount', () => {
  const totals = calculateSaleTotals([
    { productId:'p1', quantity:2, unitPrice:150, unitCost:90 },
    { productId:'p2', quantity:1, unitPrice:300, unitCost:180 }
  ], 50);
  assert.deepEqual(totals, {
    subtotal:600, discount:50, revenue:550, costOfGoods:360, grossProfit:190
  });
});

test('multi-item sale decreases stock and posts only received cash to cashbox', () => {
  const initial = {
    products:[
      {id:'p1',name:'Case',qty:5,buy:90,sell:150},
      {id:'p2',name:'Cable',qty:3,buy:180,sell:300}
    ],
    customers:[{id:'c1',name:'Customer',balance:0}],
    sales:[], cashbox:1000, cashMovements:[], activities:[]
  };
  const result = processSale(initial, {
    id:'s1', customerId:'c1', paidAmount:200, discount:50, date:'2026-11-22',
    items:[{productId:'p1',quantity:2},{productId:'p2',quantity:1}]
  });
  assert.equal(result.state.products.find(p=>p.id==='p1').qty,3);
  assert.equal(result.state.products.find(p=>p.id==='p2').qty,2);
  assert.equal(result.state.cashbox,1200);
  assert.equal(result.sale.revenue,550);
  assert.equal(result.sale.costOfGoods,360);
  assert.equal(result.sale.profit,190);
  assert.equal(result.state.customers[0].balance,350);
  assert.equal(result.state.cashMovements.length,1);
});

test('sale rejects insufficient stock without mutating original state', () => {
  const initial = {products:[{id:'p1',qty:1,buy:10,sell:20}],customers:[],sales:[],cashbox:0,cashMovements:[],activities:[]};
  assert.throws(() => processSale(initial,{items:[{productId:'p1',quantity:2}],paidAmount:0}), /موجودی کافی/);
  assert.equal(initial.products[0].qty,1);
  assert.equal(initial.sales.length,0);
});

test('customer receipt moves receivable into cash without adding sales revenue again', () => {
  const initial = {customers:[{id:'c1',name:'Customer',balance:350}],cashbox:200,cashMovements:[],activities:[]};
  const result = recordReceipt(initial,{customerId:'c1',amount:100,date:'2026-11-22'});
  assert.equal(result.customers[0].balance,250);
  assert.equal(result.cashbox,300);
  assert.equal(result.cashMovements[0].type,'receipt');
});


test('purchase increases stock, reduces cash by paid amount and records supplier payable', async () => {
  const { recordPurchase } = await import('./core-v3.js');
  const initial = {products:[{id:'p1',name:'Case',qty:2,buy:50,sell:100}],suppliers:[{id:'s1',name:'Supplier',balance:0}],purchases:[],cashbox:500,cashMovements:[],activities:[]};
  const result = recordPurchase(initial,{productId:'p1',supplierId:'s1',quantity:4,unitCost:60,paidAmount:150,date:'2026-11-22'});
  assert.equal(result.products[0].qty,6);
  assert.equal(result.cashbox,350);
  assert.equal(result.suppliers[0].balance,90);
  assert.equal(result.purchases[0].total,240);
  assert.equal(result.cashMovements[0].direction,'out');
});

test('supplier payment reduces payable and cash without changing sales profit', async () => {
  const { recordSupplierPayment } = await import('./core-v3.js');
  const initial = {suppliers:[{id:'s1',name:'Supplier',balance:200}],cashbox:500,cashMovements:[],activities:[],transactions:[]};
  const result = recordSupplierPayment(initial,{supplierId:'s1',amount:80,date:'2026-11-22'});
  assert.equal(result.suppliers[0].balance,120);
  assert.equal(result.cashbox,420);
  assert.equal(result.transactions.length,0);
  assert.equal(result.cashMovements[0].direction,'out');
});

test('expense is posted once to cash and operating expenses', async () => {
  const { recordExpense } = await import('./core-v3.js');
  const initial = {cashbox:100,cashMovements:[],activities:[],transactions:[]};
  const result = recordExpense(initial,{title:'Rent',amount:30,date:'2026-11-22'});
  assert.equal(result.cashbox,70);
  assert.equal(result.transactions.length,1);
  assert.equal(result.cashMovements.length,1);
  assert.equal(result.cashMovements[0].direction,'out');
});

test('purchase and supplier payment reject invalid cash or payable amounts without mutating input', async () => {
  const { recordPurchase, recordSupplierPayment } = await import('./core-v3.js');
  const state={products:[{id:'p1',qty:0,buy:10}],suppliers:[{id:'s1',balance:20}],purchases:[],cashbox:5,cashMovements:[],activities:[]};
  assert.throws(()=>recordPurchase(state,{productId:'p1',supplierId:'s1',quantity:1,unitCost:10,paidAmount:6}),/صندوق/);
  assert.throws(()=>recordSupplierPayment(state,{supplierId:'s1',amount:21}),/بدهی/);
  assert.equal(state.products[0].qty,0);
  assert.equal(state.suppliers[0].balance,20);
});


test('duplicate product lines are aggregated before stock validation', () => {
  const initial={products:[{id:'p1',name:'Case',qty:3,buy:10,sell:20}],customers:[],sales:[],cashbox:0,cashMovements:[],activities:[]};
  assert.throws(()=>processSale(initial,{paidAmount:40,items:[{productId:'p1',quantity:2},{productId:'p1',quantity:2}]}),/موجودی کافی/);
  assert.equal(initial.products[0].qty,3);
});

test('purchase uses weighted average cost for remaining inventory', async () => {
  const { recordPurchase } = await import('./core-v3.js');
  const initial={products:[{id:'p1',name:'Case',qty:2,buy:50,sell:100}],suppliers:[],purchases:[],cashbox:1000,cashMovements:[],activities:[]};
  const result=recordPurchase(initial,{productId:'p1',quantity:2,unitCost:100,paidAmount:200});
  assert.equal(result.products[0].buy,75);
});
