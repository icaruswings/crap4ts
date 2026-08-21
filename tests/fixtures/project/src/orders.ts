function placeOrder(total: number) {
  if (total > 100) {
    return 'large';
  }
  return 'small';
}
const receipt = () => 'receipt';
