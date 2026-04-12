/** Human-readable delivery / order pipeline for pet owners. */
export function orderStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Awaiting payment";
    case "paid":
      return "Paid — preparing order";
    case "processing":
      return "Processing";
    case "shipped":
      return "Out for delivery";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
    default:
      return status;
  }
}
