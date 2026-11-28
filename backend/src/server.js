import "./loadEnv.js";
import dns from "dns";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch (error) {
  // Ignore error if not supported in older Node versions
}

try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (error) {
  // Ignore error if DNS servers cannot be set
}

import http from "http";
import app from "./app.js";
import { initSocket } from "./config/socket.js";
import connectDB from "./config/db.js";
import { validateEnv } from "./config/env.js";

// Safety net: a stray rejected promise (e.g. a failed notification/email in a fire-and-forget call)
// must be logged, not allowed to take the whole API down for every user.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason instanceof Error ? reason.stack || reason.message : reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err?.stack || err);
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    validateEnv();
    await connectDB();
    
    // Run DB migrations
    const { migrateSalesChannel } = await import('./utils/migrateSalesChannel.js');
    await migrateSalesChannel();
    
    const { migrateBusinessVerification } = await import('./utils/migrateBusinessVerification.js');
    await migrateBusinessVerification();

    // Start vendor window expiry service (runs every 1 hour)
    const { startProductRequestExpiryService } = await import('./services/productRequestExpiry.service.js');
    startProductRequestExpiryService();

    // Give back stock held by online orders that were never paid (every 5 minutes)
    const { startAbandonedPaymentService } = await import('./services/abandonedPayment.service.js');
    startAbandonedPaymentService();
    
    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });

    // Trigger restart
  } catch (error) {
    console.error("📦 Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
