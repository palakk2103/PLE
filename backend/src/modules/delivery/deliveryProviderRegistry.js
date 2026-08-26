import { shiprocketProvider } from './providers/shiprocket/shiprocketProvider.js';
import { internalDeliveryProvider } from './providers/internalDeliveryProvider.js';

class DeliveryProviderRegistry {
    constructor() {
        this.providers = new Map();
        // Register default providers
        this.register(shiprocketProvider);
        this.register(internalDeliveryProvider);
    }

    register(provider) {
        if (!provider || !provider.name) {
            throw new Error('Provider must have a valid name');
        }
        this.providers.set(provider.name.toLowerCase(), provider);
    }

    getProvider(name) {
        const targetName = (name || process.env.DELIVERY_PROVIDER || 'shiprocket').toLowerCase();

        if (targetName === 'auto') {
            // Auto fallback: return shiprocket if configured, else internal
            if (process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD) {
                return this.providers.get('shiprocket');
            }
            return this.providers.get('internal');
        }

        if (targetName === 'courier' || targetName === 'delivery') {
            return this.providers.get('shiprocket') || this.providers.get('internal');
        }

        const provider = this.providers.get(targetName);
        if (!provider) {
            console.warn(`[DeliveryProviderRegistry] Provider '${targetName}' not found. Falling back to internal.`);
            return this.providers.get('internal');
        }
        return provider;
    }

    listProviders() {
        return Array.from(this.providers.keys());
    }
}

export const deliveryProviderRegistry = new DeliveryProviderRegistry();
export default deliveryProviderRegistry;
