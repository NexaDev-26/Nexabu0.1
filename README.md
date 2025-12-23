# Nexabu - Business Management Platform

<div align="center">
  <img width="1200" height="475" alt="Nexabu Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
  [![Firebase](https://img.shields.io/badge/Firebase-12.6-orange.svg)](https://firebase.google.com/)
</div>

## Overview

Nexabu is a comprehensive business management platform designed for vendors, pharmacies, and retailers. It combines inventory management, order processing, customer management, financial tracking, and AI-powered business insights in one unified platform.

## Features

### 🏪 Store Management
- Multi-store and branch management
- Store profile customization
- Location-based services
- Custom domain support

### 📦 Inventory Management
- Product catalog management
- Bulk product import (CSV/Excel)
- Barcode scanning support
- Stock tracking and adjustments
- Low-stock alerts
- Category and unit management
- Warehouse transfers

### 💰 Financial Management
- Order processing and tracking
- Invoice generation (PDF)
- Bill tracking
- Expense management
- Profit & Loss reports
- Advanced analytics
- Wallet/Transaction management

### 👥 Customer & Staff Management
- Customer database
- Staff management with roles
- Role-based access control
- Customer analytics
- Prescription management (for pharmacies)

### 📊 Analytics & Reporting
- Dashboard with key metrics
- Sales analytics
- Customer analytics
- Inventory analytics
- Performance metrics
- Export to PDF/Excel

### 🤖 AI-Powered Features
- SmartBot for business insights
- AI-powered forecasting
- Voice commands
- Image analysis

### 🛒 E-Commerce
- Online storefront
- Shop builder
- Shareable store links
- Catalog publishing
- Abandoned cart recovery

### 🚚 Delivery & Logistics
- Delivery tracking
- Driver management
- Order status updates

### 📱 Additional Features
- Push notifications
- Marketing tools
- Procurement/Ghala integration
- Multi-currency support
- Audit logging
- Dark mode

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** TailwindCSS
- **Backend:** Firebase (Firestore, Auth, Storage)
- **AI:** Google Gemini API
- **Charts:** Recharts
- **PDF Generation:** jsPDF
- **Excel:** xlsx

## Setup checklist (reports & POS)
- Ensure orders include `branchId`, `channel`, `tax`, `discount`, and `refund` where applicable—these drive branch/channel filters and net sales in Daily Sales.
- For sales reps, create users with role `SALES_REP` and add `salesRepId`, `salesRepName`, and `commission` on orders to enable rep analytics/commissions.
- To deliver reports by schedule/email/WhatsApp, add a backend endpoint; UI already provides Export/Print and a stub Schedule button.
- If you need default timezones per org/user, store the preferred timezone and pass it into Daily Sales (the UI supports selectable offsets).
- Hardware receipt printers (ESC/POS/thermal) require a native bridge or print service; HTML/PDF print is supported now.

## Prerequisites

- Node.js 18+ and npm
- Firebase account
- Google Gemini API key (for SmartBot)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Nexabu
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_GEMINI_API_KEY=your_gemini_api_key
   ```
   
   See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for detailed instructions.

4. **Set up Firebase**
   - Create a Firebase project
   - Enable Authentication (Email/Password, Google)
   - Create Firestore database
   - Set up Firebase Storage
   - Deploy Firestore security rules:
     ```bash
     firebase deploy --only firestore:rules
     ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5173`

## Project Structure

```
Nexabu/
├── components/          # React components
├── contexts/           # React contexts
├── hooks/              # Custom React hooks
├── services/           # Business logic and API services
├── utils/              # Utility functions
├── types.ts            # TypeScript type definitions
├── firebaseConfig.ts   # Firebase configuration
├── firestore.rules     # Firestore security rules
└── vite.config.ts      # Vite configuration
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

## Deployment

See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy to Firebase Hosting

```bash
# Build the application
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

## Documentation

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- [Environment Variables](./ENVIRONMENT_VARIABLES.md)
- [Production Checklist](./PRODUCTION_CHECKLIST.md)
- [Database Optimization](./DATABASE_OPTIMIZATION.md)
- [System Analysis](./SYSTEM_ANALYSIS.md)
- [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md)

## User Roles

- **ADMIN:** Full system access, manage packages, wholesale catalog
- **VENDOR:** Own store management, products, orders, customers
- **PHARMACY:** Same as VENDOR + prescriptions
- **MANAGER:** Staff management for employer's store
- **SELLER:** Create orders, view inventory for employer
- **PHARMACIST:** Manage prescriptions for employer
- **STAFF:** Basic access for employer
- **CUSTOMER:** View storefront, place orders

## Security

- Firestore security rules enforce multi-tenancy
- Role-based access control (RBAC)
- Input validation
- Audit logging
- Secure authentication

## Performance

- Code splitting with React.lazy
- Optimized bundle size
- Lazy loading
- Performance utilities
- Database query optimization

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Testing

Tests are located in the `tests/` directory. Run tests with:

```bash
npm test
```

## License

This project is licensed under the MIT License.

## Support

For issues, questions, or contributions, please open an issue on GitHub.

## Acknowledgments

- Built with React and Firebase
- Powered by Google Gemini AI
- Icons by Lucide

---

**Status:** Production Ready ✅  
**Version:** 1.0.0  
**Last Updated:** 2024
