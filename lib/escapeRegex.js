// Escapes regex metacharacters so user-supplied search text is matched
// literally instead of being interpreted as a (potentially catastrophic-
// backtracking) regular expression.
function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
