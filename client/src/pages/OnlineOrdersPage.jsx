import SalesPage from "./SalesPage.jsx";

// A dedicated storefront-orders destination, backed by the same order-management
// logic, modal and status/courier/tracking actions used in Sales & Analytics.
export default function OnlineOrdersPage(props) {
  return <SalesPage {...props} ordersOnly />;
}
