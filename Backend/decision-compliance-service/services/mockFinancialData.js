/**
 * Simulates a third-party Credit Bureau data node network
 * @param {string} maskedPan - The redacted PAN reference token
 */
export const fetchMockCreditProfile = async (maskedPan) => {
  // Simulates an API network delay
  await new Promise((resolve) => setTimeout(resolve, 150));

  return {
    credit_score: 745,
    total_active_loans: 2,
    delinquencies_24_months: 0,
    monthly_emi_outflow: 12000.00
  };
};

/**
 * Simulates a modern 6-month financial Account Aggregator data payload
 * @param {number} userId 
 */
export const fetchMockStatementLedger = async (userId) => {
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Generates a structural set of transactions with an intentional arithmetic footprint
  const transactions = [
    { date: '2026-01-10', type: 'CREDIT', amount: 80000.00, description: 'Salary Corp' },
    { date: '2026-01-15', type: 'DEBIT', amount: 12000.00, description: 'EMI Outflow' },
    { date: '2026-02-10', type: 'CREDIT', amount: 80000.00, description: 'Salary Corp' },
    { date: '2026-02-15', type: 'DEBIT', amount: 12000.00, description: 'EMI Outflow' },
    { date: '2026-03-10', type: 'CREDIT', amount: 85000.00, description: 'Salary Corp Increment' },
    { date: '2026-03-15', type: 'DEBIT', amount: 12000.00, description: 'EMI Outflow' }
  ];

  return {
    account_number: '999100200344',
    declared_opening_balance: 50000.00,
    declared_closing_balance: 209000.00, // 50k + 245k (credits) - 36k (debits) = 209k
    transaction_history: transactions
  };
};