// Approval states that must never be visible to customers.
// Products without an approvalStatus field (legacy/admin-created) are treated as approved.
export const NON_PUBLIC_APPROVAL_STATUSES = ['draft', 'pending', 'rejected', 'archived'];

// Filter fragment to merge into any customer-facing Product query.
export const publicApprovalFilter = () => ({
    approvalStatus: { $nin: NON_PUBLIC_APPROVAL_STATUSES },
});

export const isProductPubliclyApproved = (product) =>
    !!product && !NON_PUBLIC_APPROVAL_STATUSES.includes(product.approvalStatus);

// Fields a seller must never set directly on their own product.
export const VENDOR_PROTECTED_PRODUCT_FIELDS = [
    'approvalStatus',
    'approvedBy',
    'approvalDate',
    'rejectionReason',
    'brandApprovalStatus',
    'categoryApprovalStatus',
    'publicationStatus',
    'isVisible',
    'vendorId',
    'shopId',
    'vendorUserId',
    'listingType',
    'isSourceProduct',
    'sourceProductId',
    'agreementId',
    'negotiatedSupplyPrice',
    'auditLog',
];
