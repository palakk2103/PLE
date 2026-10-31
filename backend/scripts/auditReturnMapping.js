/**
 * Audit (and optionally backfill) Return <-> Order <-> Invoice identifier mapping.
 *
 * Usage (from /backend):
 *   node scripts/auditReturnMapping.js            # DRY RUN - report only, writes nothing
 *   node scripts/auditReturnMapping.js --apply    # backfill ONLY safe, additive fields
 *
 * What --apply writes (additive only, never touches amounts/status/refund data):
 *   - ReturnRequest.returnId      (derived: RET-<last 8 of _id>, same value the API already shows)
 *   - ReturnRequest.orderNumber   (copy of Order.orderId)
 *   - ReturnRequest.items[].orderItemId / variantKey  (ONLY when exactly one order line matches
 *                                                       the productId -> unambiguous)
 *   - Invoice.items[].orderItemId (ONLY when it can be matched 1:1 by productId + variantKey)
 *
 * Records that are ambiguous (same product on several lines of one order) are LISTED for manual
 * review and are never modified.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import ReturnRequest from '../src/models/ReturnRequest.model.js';
import Order from '../src/models/Order.model.js';
import Invoice from '../src/models/Invoice.model.js';
import { legacyReturnId, matchOrderItem } from '../src/utils/returnMapping.js';

const APPLY = process.argv.includes('--apply');

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ple');
    console.log(`Mode: ${APPLY ? 'APPLY (additive backfill)' : 'DRY RUN (no writes)'}\n`);

    const report = {
        returnsTotal: 0,
        returnsMissingReturnId: 0,
        returnIdCollisions: [],
        returnsMissingOrder: [],
        itemsAmbiguous: [],
        itemsUnresolvable: [],
        itemsOverReturned: [],
        invoicesOrderNumberMismatch: [],
        invoicesWithoutOrder: [],
        invoicesMissingItemRef: 0,
        ordersWithoutInvoice: 0,
        applied: { returnId: 0, orderNumber: 0, returnItemRefs: 0, invoiceItemRefs: 0 },
    };

    // ---- Returns ----
    const usedIds = new Set((await ReturnRequest.find({ returnId: { $exists: true } }).select('returnId').lean()).map((r) => r.returnId));
    const claimed = new Map(); // orderItemId -> qty across non-rejected returns

    const returns = await ReturnRequest.find({}).sort({ createdAt: 1 });
    for (const ret of returns) {
        report.returnsTotal += 1;
        const order = await Order.findById(ret.orderId);
        if (!order) {
            report.returnsMissingOrder.push(String(ret._id));
            continue;
        }

        let changed = false;

        if (!ret.returnId) {
            report.returnsMissingReturnId += 1;
            const candidate = legacyReturnId(ret._id);
            if (usedIds.has(candidate)) {
                report.returnIdCollisions.push({ returnRequest: String(ret._id), candidate });
            } else if (APPLY) {
                ret.returnId = candidate;
                usedIds.add(candidate);
                report.applied.returnId += 1;
                changed = true;
            }
        }
        if (!ret.orderNumber && APPLY) {
            ret.orderNumber = order.orderId;
            report.applied.orderNumber += 1;
            changed = true;
        }

        for (const item of ret.items) {
            if (item.orderItemId) {
                const matched = matchOrderItem(order.items, item);
                if (!matched) report.itemsUnresolvable.push({ returnId: ret.returnId || legacyReturnId(ret._id), orderItemId: String(item.orderItemId) });
            } else {
                const sameProduct = (order.items || []).filter((it) => String(it.productId) === String(item.productId));
                if (sameProduct.length === 1) {
                    if (APPLY) {
                        item.orderItemId = sameProduct[0]._id;
                        item.variantKey = sameProduct[0].variantKey || '';
                        report.applied.returnItemRefs += 1;
                        changed = true;
                    }
                } else if (sameProduct.length > 1) {
                    report.itemsAmbiguous.push({ returnId: ret.returnId || legacyReturnId(ret._id), order: order.orderId, productId: String(item.productId), candidates: sameProduct.map((s) => String(s._id)) });
                } else {
                    report.itemsUnresolvable.push({ returnId: ret.returnId || legacyReturnId(ret._id), order: order.orderId, productId: String(item.productId) });
                }
            }

            if (!['rejected', 'claim_rejected'].includes(ret.status)) {
                const matched = matchOrderItem(order.items, item);
                if (matched) {
                    const key = String(matched._id);
                    const total = (claimed.get(key) || 0) + Number(item.quantity || 0);
                    claimed.set(key, total);
                    if (total > Number(matched.quantity || 0)) {
                        report.itemsOverReturned.push({ order: order.orderId, orderItemId: key, ordered: matched.quantity, returned: total });
                    }
                }
            }
        }

        if (changed) await ret.save();
    }

    // ---- Invoices ----
    const invoices = await Invoice.find({});
    const invoicedOrderIds = new Set();
    for (const inv of invoices) {
        invoicedOrderIds.add(String(inv.orderId));
        const order = await Order.findById(inv.orderId);
        if (!order) {
            report.invoicesWithoutOrder.push(inv.invoiceNumber);
            continue;
        }
        if (inv.orderNumber !== order.orderId) {
            // Financial document: report only, NEVER auto-fixed.
            report.invoicesOrderNumberMismatch.push({ invoiceNumber: inv.invoiceNumber, invoiceOrderNumber: inv.orderNumber, actualOrderId: order.orderId });
        }
        let changed = false;
        for (const item of inv.items) {
            if (item.orderItemId) continue;
            report.invoicesMissingItemRef += 1;
            const candidates = (order.items || []).filter(
                (it) => String(it.productId) === String(item.productId) && String(it.variantKey || '') === String(item.variantKey || '')
            );
            if (candidates.length === 1 && APPLY) {
                item.orderItemId = candidates[0]._id;
                report.applied.invoiceItemRefs += 1;
                changed = true;
            }
        }
        if (changed) await inv.save();
    }

    const deliveredOrders = await Order.find({ status: 'delivered' }).select('_id').lean();
    report.ordersWithoutInvoice = deliveredOrders.filter((o) => !invoicedOrderIds.has(String(o._id))).length;

    console.log(JSON.stringify(report, null, 2));
    await mongoose.disconnect();
};

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
