// e2e-server + one open SourceNow request assigned to Vera. Usage: node testing_scripts/e2e-sourcing-server.js [port] [seedOut]
await import('./e2e-server.js');
const { default: mongoose } = await import('mongoose');
const U = (await import('../src/models/User.model.js')).default;
const V = (await import('../src/models/Vendor.model.js')).default;
const PR = (await import('../src/models/ProductRequest.model.js')).default;
const c = await U.findOne({ email: 'cathy@example.com' });
const v = await V.findOne({ email: 'vera@example.com' });
await PR.create({
    requestId: 'PR-E2E-1', userId: c._id, requestType: 'GENERAL', productName: 'Studio Monitor', category: 'Electronics',
    quantity: 3, expectedBudget: 9000, description: 'Need 3 studio monitors', status: 'Vendor Window Open',
    windowStatus: 'OPEN', windowExpiresAt: new Date(Date.now() + 864e5), assignedVendors: [{ vendorId: v._id }],
});
console.log('SEED_REQUEST_READY', mongoose.connection.readyState);
