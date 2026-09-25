import { Server } from "socket.io";
import { verifyAccessToken } from "./jwt.js";
import VendorChatThread from "../models/VendorChatThread.model.js";
import { DirectRFQ } from "../models/DirectRFQ.model.js";
import RFQ from "../models/RFQ.model.js";

let io;

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*",
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
                }
            }
        } catch {
            socket.user = null;
        }
        next();
    });

    io.on("connection", (socket) => {
        // ── Join an RFQ room (Authorized participants only) ─────
        socket.on("join_rfq_room", async (rfqId) => {
            if (!socket.user) {
                return socket.emit("error", { message: "Authentication required to join RFQ room." });
            }

            try {
                // Check if user is admin
                if (socket.user.role === 'admin') {
                    socket.join(`rfq_${rfqId}`);
                    return;
                }

                // Check Direct RFQ
                const drfq = await DirectRFQ.findById(rfqId).select('employeeId vendorId companyId').lean();
                if (drfq) {
                    const isEmployee = drfq.employeeId?.toString() === socket.user.id;
                    const isVendor = drfq.vendorId?.toString() === socket.user.id;
                    const isCompany = socket.user.companyId && drfq.companyId && 
                        (socket.user.companyId.toString() === drfq.companyId.toString());

                    if (isEmployee || isVendor || isCompany || socket.user.role === 'b2bAdmin') {
                        socket.join(`rfq_${rfqId}`);
                        return;
                    }
                }

                // Check Standard RFQ if exists
                if (RFQ) {
                    const rfq = await RFQ.findById(rfqId).select('userId assignedVendors').lean();
                    if (rfq) {
                        const isBuyer = rfq.userId?.toString() === socket.user.id;
                        const isAssigned = (rfq.assignedVendors || []).some(
                            v => (v?.vendorId?.toString() || v?.toString()) === socket.user.id
                        );
                        if (isBuyer || isAssigned) {
                            socket.join(`rfq_${rfqId}`);
                            return;
                        }
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
                if (socket.user.role === 'admin') {
                    socket.join(`chat_${threadId}`);
                    return;
                }

                const thread = await VendorChatThread.findById(threadId).select('customerUserId vendorId').lean();
                if (!thread) {
                    return socket.emit("error", { message: "Chat thread not found." });
                }

                const isCustomer = thread.customerUserId?.toString() === socket.user.id;
                const isVendor = thread.vendorId?.toString() === socket.user.id;

                if (isCustomer || isVendor) {
                    socket.join(`chat_${threadId}`);
                } else {
                    socket.emit("error", { message: "Unauthorized to join this chat room." });
                }
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
