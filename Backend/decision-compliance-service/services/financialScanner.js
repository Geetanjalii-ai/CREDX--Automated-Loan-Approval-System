/**
 * Analyzes transaction histories against declared totals to flag document tempering fraud.
 */
export const verifyStatementIntegrity = (statementPayload) => {
  const { declared_opening_balance, declared_closing_balance, transaction_history } = statementPayload;
  
  let computedRunningTotal = parseFloat(declared_opening_balance);

  // Execute precise floating-point balance calculations
  transaction_history.forEach((tx) => {
    const amount = parseFloat(tx.amount);
    if (tx.type === 'CREDIT') {
      computedRunningTotal += amount;
    } else if (tx.type === 'DEBIT') {
      computedRunningTotal -= amount;
    }
  });

  const mathematicalMatch = Math.abs(computedRunningTotal - parseFloat(declared_closing_balance)) < 0.01;

  // Calculate average monthly net cash inflow metric for lending evaluation steps
  const totalCredits = transaction_history
    .filter(t => t.type === 'CREDIT')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  
  const estimatedMonthlyIncome = totalCredits / 3; // Evaluated over the active data window length

  return {
    is_authentic: mathematicalMatch,
    calculated_final_balance: computedRunningTotal,
    average_monthly_income: estimatedMonthlyIncome
  };
};