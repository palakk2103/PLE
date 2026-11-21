import { Server } from "socket.io";
import { verifyAccessToken } from "./jwt.js";
import VendorChatThread from "../models/VendorChatThread.model.js";
import AdminManagedVendorThread from "../models/AdminManagedVendorThread.model.js";
import { DirectRFQ } from "../models/DirectRFQ.model.js";
import RFQ from "../models/RFQ.model.js";
import User from "../models/User.model.js";

let io;

export const initSocket = (server) => {
    // Production: only our own web app (and the packaged mobile app shells) may open a socket.
    // Set SOCKET_ALLOWED_ORIGINS="https://a.com,https://b.com" to override. Development stays open.
    const extraOrigins = String(process.env.SOCKET_ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
    const clientUrl = String(process.env.CLIENT_URL || '').replace(/\/$/, '');
    const restrict = process.env.NODE_ENV === 'production' && (extraOrigins.length > 0 || clientUrl);
    const allowedOrigins = restrict
        ? [...new Set([...extraOrigins, clientUrl, 'capacitor://localhost', 'ionic://localhost', 'https://localhost', 'http://localhost'].filter(Boolean))]
        : '*';

    io = new Server(server, {
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"]
        }
    });

    // ── Authentication Middleware ──────────────────────────────
    io.use((socket, next) => {
        try {
            const token = socket.handshake?.auth?.token || 
                          socket.handshake?.headers?.authorization?.replace(/^Bearer\s+/i, '');
            if (token) {
                const decoded = verifyAccessToken(token);
                if (decoded && decoded.type !== '2fa_pending') {
                    socket.user = decoded; // { id, role, email }
                    socket.data.user = decoded; // also visible to io.in(room).fetchSockets()
                }
            }
        } catch {
            socket.user = null;
        }
        next();
    });

    io.on("connection", (socket) => {
        // ── Join an RFQ room (Authorized participants only) ─────
        // rfq_<id>                 : admins + the B2B buyer side + (Direct RFQ) its vendor
        // rfq_<id>_admin           : admins only (vendor negotiation traffic)
        // rfq_<id>_vendor_<vid>    : one vendor's private line with the admin
        socket.on("join_rfq_room", async (rfqId) => {
            if (!socket.user) {
                return socket.emit("error", { message: "Authentication required to join RFQ room." });
            }

            try {
                const uid = String(socket.user.id);
                const role = String(socket.user.role || '');

                // Platform admins
                if (['admin', 'superadmin', 'account_team'].includes(role)) {
                    socket.join(`rfq_${rfqId}`);
                    socket.join(`rfq_${rfqId}_admin`);
                    return;
                }

                // The user's company comes from the database, never from a client-supplied value
                let myCompanyId = null;
                if (role === 'b2bAdmin' || role === 'b2bEmployee') {
                    const me = await User.findById(uid).select('companyId').lean();
                    myCompanyId = me?.companyId ? String(me.companyId) : null;
                }

                // Direct RFQ (employee <-> vendor)
                const drfq = await DirectRFQ.findById(rfqId).select('employeeId vendorId companyId').lean();
                if (drfq) {
                    const isCreator = String(drfq.employeeId || '') === uid;
                    const isCompanyAdmin = role === 'b2bAdmin' && myCompanyId && String(drfq.companyId || '') === myCompanyId;
                    const isVendor = role === 'vendor' && String(drfq.vendorId || '') === uid;
                    if (isCreator || isCompanyAdmin || isVendor) {
                        socket.join(`rfq_${rfqId}`);
                        return;
                    }
                }

                // Managed (B2B sourcing) RFQ
                const rfq = await RFQ.findById(rfqId).select('rfqType companyId createdByEmployeeId assignedVendorIds buyerId').lean();
                if (rfq && rfq.rfqType !== 'consumer') {
                    const isEmployeeOwner = role === 'b2bEmployee' && String(rfq.createdByEmployeeId || '') === uid;
                    const isCompanyAdmin = role === 'b2bAdmin' && myCompanyId && String(rfq.companyId || '') === myCompanyId;
                    if (isEmployeeOwner || isCompanyAdmin) {
                        socket.join(`rfq_${rfqId}`);
                        socket.join(`rfq_${rfqId}_b2b`); // buyer-team-only notes
                        return;
                    }
                    const isAssignedVendor = role === 'vendor'
                        && (rfq.assignedVendorIds || []).some((v) => String(v) === uid);
                    if (isAssignedVendor) {
                        // Vendors only ever get their own private line, never the shared RFQ room
                        socket.join(`rfq_${rfqId}_vendor_${uid}`);
                        return;
                    }
                }

                socket.emit("error", { message: "Unauthorized to join this RFQ room." });
            } catch (err) {
                socket.emit("error", { message: "Failed to join RFQ room." });
            }
        });

        // Leave an RFQ room
        socket.on("leave_rfq_room", (rfqId) => {
            socket.leave(`rfq_${rfqId}`);
            socket.leave(`rfq_${rfqId}_admin`);
            if (socket.user?.id) socket.leave(`rfq_${rfqId}_vendor_${socket.user.id}`);
        });

        // ── Join a User room (Personal user room) ───────────────
        socket.on("join_user_room", (userId) => {
            if (!socket.user) {
                return socket.emit("error", { message: "Authentication required to join user room." });
            }
            if (socket.user.id !== String(userId) && socket.user.role !== 'admin') {
                return socket.emit("error", { message: "Unauthorized to join another user's room." });
            }
            socket.join(`user_${userId}`);
        });

        // Leave a user room
        socket.on("leave_user_room", (userId) => {
            socket.leave(`user_${userId}`);
        });

        // ── Join a Chat thread room (Thread participants only) ──
        socket.on("join_chat_room", async (threadId) => {
            if (!socket.user) {
                return socket.emit("error", { message: "Authentication required to join chat room." });
            }

            try {
                if (['admin', 'superadmin'].includes(socket.user.role)) {
                    socket.join(`chat_${threadId}`);
                    return;
                }

                const thread = await VendorChatThread.findById(threadId).select('customerUserId vendorId').lean();
                if (thread) {
                    const isCustomer = thread.customerUserId?.toString() === socket.user.id;
                    const isVendor = thread.vendorId?.toString() === socket.user.id;

                    if (isCustomer || isVendor) {
                        socket.join(`chat_${threadId}`);
                    } else {
                        socket.emit("error", { message: "Unauthorized to join this chat room." });
                    }
                    return;
                }

                // Support AdminManagedVendorThread for vendor-admin conversations
                const amvThread = await AdminManagedVendorThread.findById(threadId).select('adminId managedVendorId').lean();
                if (amvThread) {
                    const isVendor = amvThread.managedVendorId?.toString() === socket.user.id;
                    const isAdmin = amvThread.adminId?.toString() === socket.user.id;

                    if (isVendor || isAdmin) {
                        socket.join(`chat_${threadId}`);
                    } else {
                        socket.emit("error", { message: "Unauthorized to join this admin chat room." });
                    }
                    return;
                }

                return socket.emit("error", { message: "Chat thread not found." });
            } catch (err) {
                socket.emit("error", { message: "Failed to join chat room." });
            }
        });

        // Leave a Chat thread room
        socket.on("leave_chat_room", (threadId) => {
            socket.leave(`chat_${threadId}`);
        });

        // ── Join admin room (Admins only) ───────────────────────
        socket.on("join_admin_room", () => {
            if (!socket.user || socket.user.role !== 'admin') {
                return socket.emit("error", { message: "Unauthorized to join admin room." });
            }
            socket.join(`admin_room`);
        });

        // Leave admin room
        socket.on("leave_admin_room", () => {
            socket.leave(`admin_room`);
        });

        socket.on("disconnect", () => {
            // Socket disconnected
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};
