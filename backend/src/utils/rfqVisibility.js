/**
 * Internal notes belong to ONE side of an RFQ discussion:
 *  - a note written by the B2B buyer's team is private to that team (hidden from PLE admin)
 *  - a note written by PLE admin is private to admins (hidden from the B2B buyer)
 * `viewer` is 'admin' (platform staff) or 'b2b' (the buyer's company).
 */
export const filterNegotiationMessages = (messages = [], viewer) =>
    (messages || []).filter((m) => {
        if (!m?.isInternalNote) return true;
        const fromAdmin = m.senderType === 'SuperAdmin';
        return viewer === 'admin' ? fromAdmin : !fromAdmin;
    });

export const rfqForViewer = (rfqDoc, viewer) => {
    if (!rfqDoc) return rfqDoc;
    const obj = typeof rfqDoc.toObject === 'function' ? rfqDoc.toObject() : { ...rfqDoc };
    obj.negotiationMessages = filterNegotiationMessages(obj.negotiationMessages, viewer);
    return obj;
};
