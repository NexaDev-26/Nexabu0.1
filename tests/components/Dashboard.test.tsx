/**
 * Dashboard Component Tests
 * Example test file demonstrating testing patterns
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from '../../components/Dashboard';
import { AppContextProvider } from '../../contexts/AppContext';

// Mock the analytics service
jest.mock('../../services/analyticsService', () => ({
  getSalesAnalytics: jest.fn().mockResolvedValue({
    totalSales: 1000,
    totalOrders: 10,
    averageOrderValue: 100,
  }),
  generateProfitLossReport: jest.fn().mockResolvedValue({
    totalRevenue: 1000,
    totalExpenses: 500,
    netProfit: 500,
  }),
}));

// Mock useAppContext
jest.mock('../../hooks/useAppContext', () => ({
  useAppContext: () => ({
    user: {
      uid: 'test-user-id',
      name: 'Test User',
      role: 'VENDOR',
    },
    orders: [],
    products: [],
    branches: [],
  }),
}));

describe('Dashboard Component', () => {
  it('renders dashboard title', async () => {
    render(
      <AppContextProvider>
        <Dashboard />
      </AppContextProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    render(
      <AppContextProvider>
        <Dashboard />
      </AppContextProvider>
    );

    // Check for loading indicator
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  // Add more tests as needed
});

