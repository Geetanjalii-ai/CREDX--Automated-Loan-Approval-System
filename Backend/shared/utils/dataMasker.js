/**
 * Structurally masks identification numbers to ensure total financial data isolation.
 */
export const maskIdentifier = (idString, visibleCharacters = 4) => {
  if (!idString) return '';
  
  const formattedStr = idString.replace(/[\s-]/g, '');
  
  if (formattedStr.length <= visibleCharacters) {
    return 'X'.repeat(formattedStr.length);
  }
  
  const hiddenCount = formattedStr.length - visibleCharacters;
  const trailingPart = formattedStr.slice(hiddenCount);
  const hiddenPart = 'X'.repeat(hiddenCount).replace(/(.{4})/g, '$1-');
  
  const structuralPrefix = hiddenPart.endsWith('-') ? hiddenPart : `${hiddenPart}-`;
  return `${structuralPrefix}${trailingPart}`;
};

/**
 * Filters simple inputs against baseline string characters
 */
export const sanitizeInputString = (textInput) => {
  if (!textInput) return '';
  return textInput.trim().replace(/[<>]/g, '');
};