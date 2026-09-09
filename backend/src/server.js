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
    
    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, () => {
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
