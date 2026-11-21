const clone = value => structuredClone(value);
const id = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const dateNow = () => new Date().toISOString().slice(0, 10);
const amount = (value, label='مبلغ') => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(label + ' معتبر نیست.');
  return n;
};

export function calculateSaleTotals(items = [], discount = 0) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('حداقل یک قلم کالا انتخاب کنید.');
  const subtotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity), unitPrice = Number(item.unitPrice), unitCost = Number(item.unitCost);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(unitCost) || unitCost < 0) throw new Error('مقادیر کالا معتبر نیست.');
    return sum + quantity * unitPrice;
  }, 0);
  const costOfGoods = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost), 0);
  const discountValue = amount(discount, 'تخفیف');
  if (discountValue > subtotal) throw new Error('تخفیف نمی‌تواند از مجموع فروش بیشتر باشد.');
  const revenue = subtotal - discountValue;
  return { subtotal, discount: discountValue, revenue, costOfGoods, grossProfit: revenue - costOfGoods };
}

export function processSale(state, input) {
  const next = clone(state);
  next.products ??= []; next.customers ??= []; next.sales ??= [];
  next.cashMovements ??= []; next.activities ??= [];
  const requested = new Map();
  for (const line of (input.items || [])) {
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('تعداد کالا باید عدد صحیح و بیشتر از صفر باشد.');
    requested.set(line.productId, (requested.get(line.productId) || 0) + quantity);
  }
  const lines = [...requested.entries()].map(([productId, quantity]) => {
    const product = next.products.find(p => p.id === productId);
    if (!product) throw new Error('کالا در انبار پیدا نشد.');
    if (Number(product.qty) < quantity) throw new Error('موجودی کافی نیست: ' + (product.name || 'کالا'));
    return { productId: product.id, name: product.name, quantity, unitPrice: Number(product.sell), unitCost: Number(product.buy) };
  });
  const totals = calculateSaleTotals(lines, input.discount || 0);
  const paidAmount = amount(input.paidAmount || 0, 'مبلغ پرداختی');
  if (paidAmount > totals.revenue) throw new Error('مبلغ پرداختی نمی‌تواند از مبلغ فاکتور بیشتر باشد.');
  let customer = null;
  if (input.customerId) {
    customer = next.customers.find(c => c.id === input.customerId);
    if (!customer) throw new Error('مشتری انتخاب‌شده پیدا نشد.');
  }
  const outstanding = totals.revenue - paidAmount;
  if (outstanding > 0 && !customer) throw new Error('برای فروش نسیه، مشتری را انتخاب کنید.');
  for (const line of lines) next.products.find(p => p.id === line.productId).qty -= line.quantity;
  if (customer) customer.balance = Number(customer.balance || 0) + outstanding;
  next.cashbox = Number(next.cashbox || 0) + paidAmount;
  const sale = { id: input.id || id(), customerId: input.customerId || null, items: lines, subtotal: totals.subtotal, discount: totals.discount, revenue: totals.revenue, costOfGoods: totals.costOfGoods, profit: totals.grossProfit, paidAmount, outstanding, date: input.date || dateNow(), createdAt: new Date().toISOString() };
  next.sales.push(sale);
  if (paidAmount > 0) next.cashMovements.push({id:id(),type:'sale_receipt',direction:'in',kind:'دریافت فروش',description:'فاکتور فروش ' + sale.id,amount:paidAmount,saleId:sale.id,date:sale.date});
  next.activities.push({id:id(),type:'sale',entityId:sale.id,description:'ثبت فروش',createdAt:sale.createdAt});
  return { state: next, sale };
}

export function recordReceipt(state, input) {
  const next = clone(state);
  next.customers ??= []; next.cashMovements ??= []; next.activities ??= [];
  const customer = next.customers.find(c => c.id === input.customerId);
  if (!customer) throw new Error('مشتری پیدا نشد.');
  const value = amount(input.amount, 'مبلغ دریافتی');
  if (value <= 0) throw new Error('مبلغ دریافتی باید بیشتر از صفر باشد.');
  if (value > Number(customer.balance || 0)) throw new Error('مبلغ دریافتی از بدهی مشتری بیشتر است.');
  customer.balance = Number(customer.balance || 0) - value;
  next.cashbox = Number(next.cashbox || 0) + value;
  const date = input.date || dateNow();
  next.cashMovements.push({id:id(),type:'receipt',direction:'in',kind:'دریافت از مشتری',description:customer.name || 'مشتری',customerId:customer.id,amount:value,date});
  next.activities.push({id:id(),type:'receipt',description:'دریافت از مشتری',createdAt:new Date().toISOString()});
  return next;
}

export function recordPurchase(state, input) {
  const next = clone(state);
  next.products ??= []; next.suppliers ??= []; next.purchases ??= []; next.cashMovements ??= []; next.activities ??= [];
  const product = next.products.find(p => p.id === input.productId);
  if (!product) throw new Error('کالای خریداری‌شده پیدا نشد.');
  const supplier = input.supplierId ? next.suppliers.find(s => s.id === input.supplierId) : null;
  if (input.supplierId && !supplier) throw new Error('تأمین‌کننده پیدا نشد.');
  const quantity = Number(input.quantity), unitCost = amount(input.unitCost, 'قیمت خرید');
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('تعداد خرید باید عدد صحیح و بیشتر از صفر باشد.');
  const total = quantity * unitCost, paid = amount(input.paidAmount || 0, 'پرداخت');
  if (paid > total) throw new Error('پرداخت نمی‌تواند از مجموع خرید بیشتر باشد.');
  if (paid > Number(next.cashbox || 0)) throw new Error('موجودی صندوق برای این خرید کافی نیست.');
  const payable = total - paid;
  if (payable > 0 && !supplier) throw new Error('برای خرید نسیه، تأمین‌کننده را انتخاب کنید.');
  const oldQuantity = Number(product.qty || 0), oldUnitCost = Number(product.buy || 0);
  product.qty = oldQuantity + quantity;
  product.buy = product.qty > 0 ? ((oldQuantity * oldUnitCost) + (quantity * unitCost)) / product.qty : unitCost;
  if (supplier) supplier.balance = Number(supplier.balance || 0) + payable;
  next.cashbox = Number(next.cashbox || 0) - paid;
  const date = input.date || dateNow();
  const purchase = {id:input.id || id(),productId:product.id,supplierId:supplier?.id || null,quantity,unitCost,total,paidAmount:paid,payable,date,createdAt:new Date().toISOString()};
  next.purchases.push(purchase);
  if (paid > 0) next.cashMovements.push({id:id(),type:'purchase_payment',direction:'out',kind:'پرداخت خرید',description:product.name || 'خرید کالا',amount:paid,purchaseId:purchase.id,date});
  next.activities.push({id:id(),type:'purchase',description:'ثبت خرید: '+(product.name || ''),createdAt:purchase.createdAt});
  return next;
}

export function recordSupplierPayment(state, input) {
  const next = clone(state);
  next.suppliers ??= []; next.cashMovements ??= []; next.activities ??= [];
  const supplier = next.suppliers.find(s => s.id === input.supplierId);
  if (!supplier) throw new Error('تأمین‌کننده پیدا نشد.');
  const value = amount(input.amount, 'مبلغ پرداخت');
  if (value <= 0) throw new Error('مبلغ پرداخت باید بیشتر از صفر باشد.');
  if (value > Number(supplier.balance || 0)) throw new Error('مبلغ پرداخت از بدهی تأمین‌کننده بیشتر است.');
  if (value > Number(next.cashbox || 0)) throw new Error('موجودی صندوق کافی نیست.');
  supplier.balance = Number(supplier.balance || 0) - value;
  next.cashbox = Number(next.cashbox || 0) - value;
  const date = input.date || dateNow();
  next.cashMovements.push({id:id(),type:'supplier_payment',direction:'out',kind:'پرداخت به تأمین‌کننده',description:supplier.name || 'تأمین‌کننده',supplierId:supplier.id,amount:value,date});
  next.activities.push({id:id(),type:'supplier_payment',description:'پرداخت به تأمین‌کننده',createdAt:new Date().toISOString()});
  return next;
}

export function recordExpense(state, input) {
  const next = clone(state);
  next.transactions ??= []; next.cashMovements ??= []; next.activities ??= [];
  const title = String(input.title || '').trim();
  if (!title) throw new Error('شرح هزینه را وارد کنید.');
  const value = amount(input.amount, 'مبلغ هزینه');
  if (value <= 0) throw new Error('مبلغ هزینه باید بیشتر از صفر باشد.');
  if (value > Number(next.cashbox || 0)) throw new Error('موجودی صندوق کافی نیست.');
  next.cashbox = Number(next.cashbox || 0) - value;
  const date = input.date || dateNow();
  next.transactions.push({id:id(),type:'expense',title,amount:value,date});
  next.cashMovements.push({id:id(),type:'expense',direction:'out',kind:'هزینه',description:title,amount:value,date});
  next.activities.push({id:id(),type:'expense',description:'ثبت هزینه: '+title,createdAt:new Date().toISOString()});
  return next;
}
