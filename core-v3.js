const clone = value => structuredClone(value);

export function calculateSaleTotals(items = [], discount = 0) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('حداقل یک قلم کالا انتخاب کنید.');
  const subtotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity), unitPrice = Number(item.unitPrice), unitCost = Number(item.unitCost);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(unitCost) || unitCost < 0) {
      throw new Error('مقادیر کالا معتبر نیست.');
    }
    return sum + quantity * unitPrice;
  }, 0);
  const costOfGoods = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost), 0);
  const discountValue = Number(discount);
  if (!Number.isFinite(discountValue) || discountValue < 0 || discountValue > subtotal) throw new Error('تخفیف معتبر نیست.');
  const revenue = subtotal - discountValue;
  return { subtotal, discount: discountValue, revenue, costOfGoods, grossProfit: revenue - costOfGoods };
}

export function processSale(state, input) {
  const next = clone(state);
  next.products ??= []; next.customers ??= []; next.sales ??= [];
  next.cashMovements ??= []; next.activities ??= [];
  const lines = (input.items || []).map(line => {
    const product = next.products.find(p => p.id === line.productId);
    if (!product) throw new Error('کالا در انبار پیدا نشد.');
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('تعداد کالا باید عدد صحیح و بیشتر از صفر باشد.');
    if (Number(product.qty) < quantity) throw new Error('موجودی کافی نیست: ' + (product.name || 'کالا'));
    return { productId: product.id, name: product.name, quantity, unitPrice: Number(product.sell), unitCost: Number(product.buy) };
  });
  const totals = calculateSaleTotals(lines, input.discount || 0);
  const paidAmount = Number(input.paidAmount || 0);
  if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > totals.revenue) throw new Error('مبلغ پرداختی معتبر نیست.');
  let customer = null;
  if (input.customerId) {
    customer = next.customers.find(c => c.id === input.customerId);
    if (!customer) throw new Error('مشتری انتخاب‌شده پیدا نشد.');
  }
  const outstanding = totals.revenue - paidAmount;
  if (outstanding > 0 && !customer) throw new Error('برای فروش نسیه، مشتری را انتخاب کنید.');
  for (const line of lines) {
    const product = next.products.find(p => p.id === line.productId);
    product.qty = Number(product.qty) - line.quantity;
  }
  if (customer) customer.balance = Number(customer.balance || 0) + outstanding;
  next.cashbox = Number(next.cashbox || 0) + paidAmount;
  const sale = {
    id: input.id || makeId(), customerId: input.customerId || null, items: lines,
    subtotal: totals.subtotal, discount: totals.discount, revenue: totals.revenue,
    costOfGoods: totals.costOfGoods, profit: totals.grossProfit, paidAmount, outstanding,
    date: input.date || new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString()
  };
  next.sales.push(sale);
  if (paidAmount > 0) next.cashMovements.push({id:makeId(),type:'sale_receipt',direction:'in',kind:'دریافت فروش',description:'فاکتور فروش ' + sale.id,amount:paidAmount,saleId:sale.id,date:sale.date});
  next.activities.push({id:makeId(),type:'sale',entityId:sale.id,description:'ثبت فروش',createdAt:sale.createdAt});
  return { state: next, sale };
}

export function recordReceipt(state, input) {
  const next = clone(state);
  next.customers ??= []; next.cashMovements ??= []; next.activities ??= [];
  const customer = next.customers.find(c => c.id === input.customerId);
  if (!customer) throw new Error('مشتری پیدا نشد.');
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('مبلغ دریافتی باید بیشتر از صفر باشد.');
  if (amount > Number(customer.balance || 0)) throw new Error('مبلغ دریافتی از بدهی مشتری بیشتر است.');
  customer.balance = Number(customer.balance || 0) - amount;
  next.cashbox = Number(next.cashbox || 0) + amount;
  const date = input.date || new Date().toISOString().slice(0, 10);
  next.cashMovements.push({id:makeId(),type:'receipt',direction:'in',kind:'دریافت از مشتری',description:customer.name || 'مشتری',customerId:customer.id,amount,date});
  next.activities.push({id:makeId(),type:'receipt',description:'دریافت از مشتری',createdAt:new Date().toISOString()});
  return next;
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
