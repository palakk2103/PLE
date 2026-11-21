import Product from '../models/Product.model.js';
import { publicApprovalFilter } from '../utils/productVisibility.js';
import Category from '../models/Category.model.js';

export const getRobotsTxt = (req, res) => {
    const clientUrl = process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`;
    const robots = `User-agent: *
Allow: /
Allow: /home
Allow: /product/
Allow: /category/
Allow: /brand/
Allow: /seller/
Allow: /about
Allow: /services
Allow: /portfolio
Allow: /faq
Allow: /get-quote

# Block private application areas
Disallow: /admin/
Disallow: /vendor/
Disallow: /delivery/
Disallow: /login
Disallow: /register
Disallow: /checkout
Disallow: /cart

Sitemap: ${clientUrl}/sitemap.xml
`;
    res.type('text/plain');
    res.send(robots);
};

export const getSitemapXml = async (req, res) => {
    try {
        const clientUrl = process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`;
        
        // Static URLs
        const staticPaths = [
            '',
            '/home',
            '/about',
            '/services',
            '/portfolio',
            '/faq',
            '/get-quote',
            '/client/privacy-policy',
            '/client/terms-and-conditions',
            '/refund-and-billing-policy',
            '/cookie-policy',
            '/data-processing-agreement'
        ];

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

        const today = new Date().toISOString().split('T')[0];

        // Add static URLs
        staticPaths.forEach(path => {
            xml += `  <url>\n`;
            xml += `    <loc>${clientUrl}${path}</loc>\n`;
            xml += `    <lastmod>${today}</lastmod>\n`;
            xml += `    <changefreq>daily</changefreq>\n`;
            xml += `    <priority>${path === '' ? '1.0' : '0.8'}</priority>\n`;
            xml += `  </url>\n`;
        });

        // Add Categories
        const categories = await Category.find({ isActive: true }).select('_id updatedAt');
        categories.forEach(cat => {
            const lastmod = cat.updatedAt ? new Date(cat.updatedAt).toISOString().split('T')[0] : today;
            xml += `  <url>\n`;
            xml += `    <loc>${clientUrl}/category/${cat._id}</loc>\n`;
            xml += `    <lastmod>${lastmod}</lastmod>\n`;
            xml += `    <changefreq>weekly</changefreq>\n`;
            xml += `    <priority>0.7</priority>\n`;
            xml += `  </url>\n`;
        });

        // Add Products (Only approved & active products)
        const products = await Product.find({ 
            isActive: true, 
            ...publicApprovalFilter(),
            brandApprovalStatus: { $ne: 'pending' }
        }).select('_id updatedAt');
        
        products.forEach(prod => {
            const lastmod = prod.updatedAt ? new Date(prod.updatedAt).toISOString().split('T')[0] : today;
            xml += `  <url>\n`;
            xml += `    <loc>${clientUrl}/product/${prod._id}</loc>\n`;
            xml += `    <lastmod>${lastmod}</lastmod>\n`;
            xml += `    <changefreq>daily</changefreq>\n`;
            xml += `    <priority>0.6</priority>\n`;
            xml += `  </url>\n`;
        });

        xml += `</urlset>`;

        res.header('Content-Type', 'application/xml');
        res.status(200).send(xml);
    } catch (error) {
        console.error('Error generating sitemap:', error);
        res.status(500).end();
    }
};
